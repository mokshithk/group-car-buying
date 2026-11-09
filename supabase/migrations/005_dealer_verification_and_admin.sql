-- supabase/migrations/005_dealer_verification_and_admin.sql
-- Dealer Verification, Status Transitions, Admin Security & Email Registration Verification
-- Re-runnable: safe to execute multiple times

-- ==============================================================================
-- 1. UPDATE DEALERSHIP STATUSES (PENDING, VERIFIED, REJECTED, SUSPENDED)
-- ==============================================================================

-- Drop existing status check constraint if present and re-create with 'REJECTED'
DO $$
BEGIN
    ALTER TABLE public.dealerships DROP CONSTRAINT IF EXISTS dealerships_status_check;
    ALTER TABLE public.dealerships ADD CONSTRAINT dealerships_status_check 
        CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Add rejection_reason and verified_at columns if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'dealerships' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.dealerships ADD COLUMN rejection_reason TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'dealerships' AND column_name = 'verified_at'
    ) THEN
        ALTER TABLE public.dealerships ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;
END $$;

-- ==============================================================================
-- 2. HARDEN USER PROFILE TRIGGER (Section C.2)
-- Default missing metadata to 'buyer' with NULL district without failing
-- Accept ONLY 'buyer' or 'dealer'; anything else (including 'admin') becomes 'buyer'
-- ==============================================================================

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
    -- SECURITY RULE (Section C.2):
    -- Accept ONLY 'buyer' or 'dealer' from client metadata.
    -- Anything else, including 'admin' or null/empty, MUST become 'buyer'.
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

    -- Resolve district UUID safely (default to NULL if missing or invalid, per Section C.2)
    BEGIN
        IF NEW.raw_user_meta_data->>'district_id' IS NOT NULL AND NEW.raw_user_meta_data->>'district_id' <> '' THEN
            v_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
        ELSE
            v_district_id := NULL;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_district_id := NULL;
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
        district_id = COALESCE(EXCLUDED.district_id, public.profiles.district_id),
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
                COALESCE(v_district_id, 'd1111111-1111-1111-1111-111111111101'::UUID),
                v_phone,
                NEW.email,
                v_gst_number,
                COALESCE(v_brands, ARRAY['Tata Motors']),
                CASE WHEN v_district_id IS NOT NULL THEN ARRAY[v_district_id] ELSE ARRAY['d1111111-1111-1111-1111-111111111101'::UUID] END,
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

-- Drop and recreate the auth trigger to bind updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. ENFORCE STATUS CHANGE RESTRICTION: ONLY ADMIN MAY APPROVE/REJECT/SUSPEND
-- A dealer editing their own showroom cannot modify their own status
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_dealership_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF public.current_user_role() <> 'admin' THEN
            RAISE EXCEPTION 'Permission denied: Only platform administrators can change dealership status (attempted change from % to %)', OLD.status, NEW.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_dealership_status ON public.dealerships;
CREATE TRIGGER trg_protect_dealership_status
    BEFORE UPDATE OF status ON public.dealerships
    FOR EACH ROW EXECUTE FUNCTION public.check_dealership_status_change();

-- ==============================================================================
-- 4. EMAIL REGISTRATION CHECK FUNCTION (Section G.1)
-- Callable by anon/authenticated to securely check if email exists without exposing auth.users
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_email_registered(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM auth.users
        WHERE LOWER(email) = LOWER(TRIM(p_email))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_email_registered(TEXT) TO anon, authenticated;

-- ==============================================================================
-- 5. RLS POLICIES FOR ADMIN MANAGEMENT & OWN PROFILE SECURITY (Section C.2, F.3)
-- ==============================================================================

-- Profiles: Own profile read & update only; role change forbidden by regular users
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.current_user_role() = 'admin')
    WITH CHECK (
        -- Regular users cannot promote themselves to admin
        (id = auth.uid() AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid())))
        OR public.current_user_role() = 'admin'
    );

-- Dealerships: Admin can view and manage all dealerships
DROP POLICY IF EXISTS "Admin manage all dealerships" ON public.dealerships;
CREATE POLICY "Admin manage all dealerships" ON public.dealerships
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin');

-- Dealer Users: Admin can view and manage all dealer users
DROP POLICY IF EXISTS "Admin manage all dealer_users" ON public.dealer_users;
CREATE POLICY "Admin manage all dealer_users" ON public.dealer_users
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin');

-- Audit Log: Admin can read and write audit log entries
DROP POLICY IF EXISTS "Admin read audit log" ON public.audit_log;
CREATE POLICY "Admin read audit log" ON public.audit_log
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin insert audit log" ON public.audit_log;
CREATE POLICY "Admin insert audit log" ON public.audit_log
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() = 'admin');

-- Notifications: Admin can insert notification for dealers
DROP POLICY IF EXISTS "Admin insert notifications" ON public.notifications;
CREATE POLICY "Admin insert notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Ensure dealer users can read their own link in dealer_users
DROP POLICY IF EXISTS "Dealer users read own link" ON public.dealer_users;
CREATE POLICY "Dealer users read own link" ON public.dealer_users
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Ensure dealer users can read their own dealership directly
DROP POLICY IF EXISTS "Dealer users read own showroom" ON public.dealerships;
CREATE POLICY "Dealer users read own showroom" ON public.dealerships
    FOR SELECT TO authenticated
    USING (id IN (SELECT dealership_id FROM public.dealer_users WHERE user_id = auth.uid()));

-- ==============================================================================
-- 6. BACKFILL QUERY: RESTORE MISSING PROFILES FOR EXISTING USERS (Commented)
-- ==============================================================================
/*
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
    CASE WHEN LOWER(u.raw_user_meta_data->>'role') = 'dealer' THEN 'dealer' ELSE 'buyer' END,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''), ''),
    CASE 
        WHEN u.raw_user_meta_data->>'district_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN (u.raw_user_meta_data->>'district_id')::UUID 
        ELSE NULL 
    END,
    COALESCE((u.raw_user_meta_data->>'consent_share_details')::BOOLEAN, false),
    u.created_at,
    now()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/
