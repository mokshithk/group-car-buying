-- supabase/migrations/004_reliable_profile_trigger.sql
-- Server-side Profile & Dealership Creation Trigger with Security Boundaries & RLS Enforcement
-- Re-runnable: safe to execute multiple times

-- 1. Trigger Function: creates profile & dealership securely from auth.users signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_raw_role TEXT;
    v_role TEXT;
    v_full_name TEXT;
    v_phone TEXT;
    v_district_id UUID;
    v_consent BOOLEAN;
    v_dealership_id UUID;
    v_brands TEXT[];
    v_dealership_name TEXT;
    v_dealership_address TEXT;
    v_gst_number TEXT;
BEGIN
    -- SECURITY RULE (Section D.2):
    -- Accept ONLY 'buyer' or 'dealer' from client metadata.
    -- Anything else, including 'admin' or null/empty, MUST become 'buyer'. Never trust client metadata for admin!
    v_raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'));
    IF v_raw_role = 'dealer' THEN
        v_role := 'dealer';
    ELSE
        v_role := 'buyer';
    END IF;

    -- Extract full name (fallback to email username)
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1)
    );

    -- Extract mobile phone
    v_phone := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''), '');

    -- Resolve valid district UUID safely (default to Bengaluru Urban)
    BEGIN
        IF NEW.raw_user_meta_data->>'district_id' IS NOT NULL AND NEW.raw_user_meta_data->>'district_id' <> '' THEN
            v_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
        ELSE
            v_district_id := 'd1111111-1111-1111-1111-111111111101'::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_district_id := 'd1111111-1111-1111-1111-111111111101'::UUID;
    END;

    -- Extract consent to share contact details
    BEGIN
        v_consent := COALESCE((NEW.raw_user_meta_data->>'consent_share_details')::BOOLEAN, false);
    EXCEPTION WHEN OTHERS THEN
        v_consent := false;
    END;

    -- A. Insert or update public.profiles
    -- Preserve existing 'admin' role if already assigned in database
    INSERT INTO public.profiles (
        id,
        role,
        full_name,
        phone,
        district_id,
        consent_share_details,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_role,
        v_full_name,
        v_phone,
        v_district_id,
        v_consent,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        district_id = EXCLUDED.district_id,
        role = CASE WHEN public.profiles.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
        consent_share_details = EXCLUDED.consent_share_details,
        updated_at = now();

    -- B. For dealers, create the dealerships row with status PENDING and link owner in dealer_users
    IF v_role = 'dealer' THEN
        -- Check if dealer user already has a linked dealership
        SELECT dealership_id INTO v_dealership_id
        FROM public.dealer_users
        WHERE user_id = NEW.id
        LIMIT 1;

        IF v_dealership_id IS NULL THEN
            -- Extract brands array if provided (JSON array -> TEXT[])
            BEGIN
                IF NEW.raw_user_meta_data->'brands' IS NOT NULL THEN
                    SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'brands')) INTO v_brands;
                ELSE
                    v_brands := ARRAY['Tata Motors'];
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_brands := ARRAY['Tata Motors'];
            END IF;

            v_dealership_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'dealership_name'), ''), v_full_name || ' Dealership');
            v_dealership_address := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'dealership_address'), ''), 'Showroom Address Pending');
            v_gst_number := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'gst_number'), ''), 'PENDING_VERIFICATION');

            INSERT INTO public.dealerships (
                name,
                status,
                address,
                district_id,
                contact_phone,
                contact_email,
                gst_number,
                brands,
                districts,
                created_at,
                updated_at
            ) VALUES (
                v_dealership_name,
                'PENDING',
                v_dealership_address,
                v_district_id,
                v_phone,
                NEW.email,
                v_gst_number,
                COALESCE(v_brands, ARRAY['Tata Motors']),
                ARRAY[v_district_id],
                now(),
                now()
            )
            RETURNING id INTO v_dealership_id;

            INSERT INTO public.dealer_users (
                dealership_id,
                user_id,
                role
            ) VALUES (
                v_dealership_id,
                NEW.id,
                'owner'
            )
            ON CONFLICT (dealership_id, user_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Trigger on auth.users table (re-runnable)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Row Level Security: users can read and update ONLY their own profile
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 4. Clearly commented backfill query: create missing profiles for existing auth.users
-- This ensures any existing unconfirmed or prior users receive a valid profile record
INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    district_id,
    consent_share_details,
    created_at,
    updated_at
)
SELECT 
    u.id,
    CASE 
        WHEN LOWER(COALESCE(u.raw_user_meta_data->>'role', 'buyer')) = 'dealer' THEN 'dealer' 
        ELSE 'buyer' 
    END AS role,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)) AS full_name,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''), '') AS phone,
    'd1111111-1111-1111-1111-111111111101'::UUID AS district_id,
    COALESCE((u.raw_user_meta_data->>'consent_share_details')::BOOLEAN, false) AS consent_share_details,
    u.created_at,
    now()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
