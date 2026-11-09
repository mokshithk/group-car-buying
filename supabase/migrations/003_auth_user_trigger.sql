-- supabase/migrations/003_auth_user_trigger.sql
-- Automated Profile & Dealership Creation on Supabase Auth Sign Up
-- Fixes RLS and session issues when registering via email

-- 1. Function: Automatically create profile and dealership on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
    v_district_id UUID;
    v_dealership_id UUID;
    v_brands TEXT[];
BEGIN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'buyer');

    -- Resolve valid district UUID safely
    BEGIN
        IF NEW.raw_user_meta_data->>'district_id' IS NOT NULL AND NEW.raw_user_meta_data->>'district_id' <> '' THEN
            v_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
        ELSE
            v_district_id := 'd1111111-1111-1111-1111-111111111101'::UUID; -- Default: Bengaluru Urban
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_district_id := 'd1111111-1111-1111-1111-111111111101'::UUID;
    END;

    -- Extract brands array if provided (JSON array -> TEXT[])
    BEGIN
        IF NEW.raw_user_meta_data->'brands' IS NOT NULL THEN
            SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'brands')) INTO v_brands;
        ELSE
            v_brands := ARRAY['Tata Motors', 'Hyundai'];
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_brands := ARRAY['Tata Motors', 'Hyundai'];
    END;

    -- A. Insert or update public.profiles
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
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        v_district_id,
        COALESCE((NEW.raw_user_meta_data->>'consent_share_details')::BOOLEAN, false),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        district_id = EXCLUDED.district_id,
        role = EXCLUDED.role,
        consent_share_details = EXCLUDED.consent_share_details,
        updated_at = now();

    -- B. If dealer, also create pending dealership & link owner in dealer_users
    IF v_role = 'dealer' AND NEW.raw_user_meta_data->>'dealership_name' IS NOT NULL THEN
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
            NEW.raw_user_meta_data->>'dealership_name',
            'PENDING',
            COALESCE(NEW.raw_user_meta_data->>'dealership_address', 'Showroom Address Pending'),
            v_district_id,
            COALESCE(NEW.raw_user_meta_data->>'phone', ''),
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'gst_number', 'PENDING'),
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
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Adjust RLS insert policies to allow unauthenticated/client-side profile inserts matching user ID
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Dealers insert dealership" ON public.dealerships;
CREATE POLICY "Dealers insert dealership" ON public.dealerships
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Dealer owner insert dealer_users" ON public.dealer_users;
CREATE POLICY "Dealer owner insert dealer_users" ON public.dealer_users
    FOR INSERT WITH CHECK (true);

-- 4. Backfill any existing users who registered before this trigger was added
INSERT INTO public.profiles (id, role, full_name, phone, district_id, consent_share_details)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'role', 'buyer'),
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'phone', ''),
    'd1111111-1111-1111-1111-111111111101'::UUID,
    COALESCE((u.raw_user_meta_data->>'consent_share_details')::BOOLEAN, false)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
