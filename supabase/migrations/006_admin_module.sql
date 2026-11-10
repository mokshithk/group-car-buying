-- 006_admin_module.sql
-- Admin Module: Roles (admin, super_admin), Audit Trail Enforcement,
-- SECURITY DEFINER RPCs, Admin Invites, Settings, Group Expiry, Moderation & RLS
-- Safe to re-run (idempotent). Does NOT run DROP TABLE, TRUNCATE, or DELETE on user data.

BEGIN;

-- ==============================================================================
-- 1. PROFILES & ROLE MODEL EXTENSIONS (admin, super_admin, status, password reset)
-- ==============================================================================

DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('buyer', 'dealer', 'admin', 'super_admin'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='status') THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='suspension_reason') THEN
        ALTER TABLE public.profiles ADD COLUMN suspension_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='must_change_password') THEN
        ALTER TABLE public.profiles ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='last_sign_in_at') THEN
        ALTER TABLE public.profiles ADD COLUMN last_sign_in_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='deletion_requested_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deletion_requested_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='deletion_reason') THEN
        ALTER TABLE public.profiles ADD COLUMN deletion_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='deletion_status') THEN
        ALTER TABLE public.profiles ADD COLUMN deletion_status TEXT NOT NULL DEFAULT 'NONE' CHECK (deletion_status IN ('NONE', 'PENDING', 'PROCESSED', 'REJECTED'));
    END IF;
END $$;

-- Non-destructive backfill of missing email & last_sign_in_at from auth.users
UPDATE public.profiles p
SET email = LOWER(TRIM(u.email)),
    last_sign_in_at = COALESCE(p.last_sign_in_at, u.last_sign_in_at)
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '' OR p.last_sign_in_at IS DISTINCT FROM u.last_sign_in_at);

-- ==============================================================================
-- 2. ADMIN HELPER FUNCTIONS (SECURITY DEFINER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
          AND status = 'ACTIVE'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'super_admin'
          AND status = 'ACTIVE'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

-- Keep signup trigger strict: signup forms may ONLY create 'buyer' or 'dealer'
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
    -- Strictly restrict client metadata roles to 'buyer' or 'dealer'.
    -- Any other value (including 'admin' or 'super_admin') becomes 'buyer'.
    v_raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'));
    IF v_raw_role = 'dealer' THEN
        v_role := 'dealer';
    ELSE
        v_role := 'buyer';
    END IF;

    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1)
    );
    v_phone := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''), '');

    BEGIN
        IF NEW.raw_user_meta_data->>'district_id' IS NOT NULL AND NEW.raw_user_meta_data->>'district_id' <> '' THEN
            v_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
        ELSE
            v_district_id := NULL;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_district_id := NULL;
    END;

    BEGIN
        v_consent := COALESCE((NEW.raw_user_meta_data->>'consent_share_details')::BOOLEAN, false);
    EXCEPTION WHEN OTHERS THEN
        v_consent := false;
    END;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    INSERT INTO public.profiles (
        id, role, full_name, phone, email, district_id, consent_share_details, created_at, updated_at
    ) VALUES (
        NEW.id, v_role, v_full_name, v_phone, LOWER(TRIM(NEW.email)), v_district_id, v_consent, now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        email = COALESCE(EXCLUDED.email, public.profiles.email),
        district_id = COALESCE(EXCLUDED.district_id, public.profiles.district_id),
        role = CASE WHEN public.profiles.role IN ('admin', 'super_admin') THEN public.profiles.role ELSE EXCLUDED.role END,
        consent_share_details = EXCLUDED.consent_share_details,
        updated_at = now();

    IF v_role = 'dealer' THEN
        SELECT dealership_id INTO v_dealership_id
        FROM public.dealer_users
        WHERE user_id = NEW.id
        LIMIT 1;

        IF v_dealership_id IS NULL THEN
            BEGIN
                IF NEW.raw_user_meta_data->'brands' IS NOT NULL THEN
                    SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'brands')) INTO v_brands;
                ELSE
                    v_brands := ARRAY['Tata Motors'];
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_brands := ARRAY['Tata Motors'];
            END;

            v_dealership_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'dealership_name'), ''), v_full_name || ' Dealership');
            v_dealership_address := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'dealership_address'), ''), 'Showroom Address Pending');
            v_gst_number := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'gst_number'), ''), 'PENDING_VERIFICATION');

            INSERT INTO public.dealerships (
                name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts, created_at, updated_at
            ) VALUES (
                v_dealership_name, 'PENDING', v_dealership_address, v_district_id, v_phone, LOWER(TRIM(NEW.email)),
                v_gst_number, COALESCE(v_brands, ARRAY['Tata Motors']),
                CASE WHEN v_district_id IS NOT NULL THEN ARRAY[v_district_id] ELSE ARRAY[]::UUID[] END,
                now(), now()
            )
            RETURNING id INTO v_dealership_id;

            INSERT INTO public.dealer_users (dealership_id, user_id, role)
            VALUES (v_dealership_id, NEW.id, 'owner')
            ON CONFLICT (dealership_id, user_id) DO NOTHING;

            -- Notify active admins of new dealership registration
            INSERT INTO public.notifications (user_id, title, message, type, link_url)
            SELECT p.id,
                   'New Dealership Pending Approval',
                   v_dealership_name || ' (' || LOWER(TRIM(NEW.email)) || ') registered and awaits verification.',
                   'ADMIN_ALERT',
                   '/admin/dealers/' || v_dealership_id::text
            FROM public.profiles p
            WHERE p.role IN ('admin', 'super_admin') AND p.status = 'ACTIVE';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Protect profile role, status, and last super_admin at trigger level
CREATE OR REPLACE FUNCTION public.fn_protect_profile_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_remaining_super_admins INTEGER;
    v_is_internal BOOLEAN;
BEGIN
    v_is_internal := (current_setting('autogroup.internal_rpc', true) = 'true') OR (auth.uid() IS NULL);

    -- Prevent last super_admin from ever being demoted, suspended, or deactivated
    IF OLD.role = 'super_admin' AND OLD.status = 'ACTIVE' AND (NEW.role <> 'super_admin' OR NEW.status <> 'ACTIVE') THEN
        SELECT COUNT(*) INTO v_remaining_super_admins
        FROM public.profiles
        WHERE role = 'super_admin' AND status = 'ACTIVE' AND id <> OLD.id;

        IF v_remaining_super_admins = 0 THEN
            RAISE EXCEPTION 'Cannot demote, suspend, or deactivate the last active super_admin account.';
        END IF;
    END IF;

    -- Block direct API mutations to sensitive columns unless inside trusted RPC or postgres session
    IF NOT v_is_internal THEN
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'Forbidden: role cannot be changed directly via client API.';
        END IF;
        IF OLD.status IS DISTINCT FROM NEW.status OR OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason THEN
            RAISE EXCEPTION 'Forbidden: account status cannot be modified directly via client API.';
        END IF;
        IF OLD.must_change_password IS DISTINCT FROM NEW.must_change_password THEN
            RAISE EXCEPTION 'Forbidden: must_change_password can only be cleared via password RPC.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security ON public.profiles;
CREATE TRIGGER trg_protect_profile_security
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_protect_profile_security();

-- Prevent deleting the last active super_admin row
CREATE OR REPLACE FUNCTION public.fn_prevent_delete_last_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_remaining INTEGER;
BEGIN
    IF OLD.role = 'super_admin' AND OLD.status = 'ACTIVE' THEN
        SELECT COUNT(*) INTO v_remaining
        FROM public.profiles
        WHERE role = 'super_admin' AND status = 'ACTIVE' AND id <> OLD.id;
        IF v_remaining = 0 THEN
            RAISE EXCEPTION 'Cannot delete the last active super_admin.';
        END IF;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_last_super_admin ON public.profiles;
CREATE TRIGGER trg_prevent_delete_last_super_admin
    BEFORE DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_delete_last_super_admin();

-- ==============================================================================
-- 3. AUDIT LOG EXTENSIONS & APPEND-ONLY ENFORCEMENT
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_log' AND column_name='reason') THEN
        ALTER TABLE public.audit_log ADD COLUMN reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_log' AND column_name='before_summary') THEN
        ALTER TABLE public.audit_log ADD COLUMN before_summary JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_log' AND column_name='after_summary') THEN
        ALTER TABLE public.audit_log ADD COLUMN after_summary JSONB;
    END IF;
END $$;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Remove any mutable policies; audit_log is strictly read-only via API for admins,
-- writes happen inside SECURITY DEFINER functions only.
DROP POLICY IF EXISTS "Admin read audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Admin insert audit log" ON public.audit_log;
CREATE POLICY "Admin read audit log" ON public.audit_log
    FOR SELECT TO authenticated
    USING (public.is_admin());

REVOKE UPDATE, DELETE ON public.audit_log FROM anon, authenticated;

-- Helper to insert an audit record inside any SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.fn_write_audit_log(
    p_actor_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_before JSONB DEFAULT NULL,
    p_after JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.audit_log (
        entity_type, entity_id, action, actor_id, before_summary, after_summary, reason, payload, created_at
    ) VALUES (
        p_entity_type, p_entity_id, p_action, p_actor_id, p_before, p_after, p_reason,
        COALESCE(p_payload, jsonb_build_object('before', p_before, 'after', p_after, 'reason', p_reason)),
        now()
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- ==============================================================================
-- 4. ADMIN INVITES TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')),
    token_hash TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')) DEFAULT 'PENDING',
    convert_existing BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin read invites" ON public.admin_invites;
CREATE POLICY "Super admin read invites" ON public.admin_invites
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_admin_invites_email ON public.admin_invites (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_admin_invites_status ON public.admin_invites (status);

-- ==============================================================================
-- 5. DOMAIN TABLE EXTENSIONS & SETTINGS SEED
-- ==============================================================================

DO $$
BEGIN
    -- Active flags on catalog & districts (soft deactivation; never hard delete in use)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='manufacturers' AND column_name='is_active') THEN
        ALTER TABLE public.manufacturers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='models' AND column_name='is_active') THEN
        ALTER TABLE public.models ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='variants' AND column_name='is_active') THEN
        ALTER TABLE public.variants ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='districts' AND column_name='is_active') THEN
        ALTER TABLE public.districts ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;

    -- Groups suspicious flag & expiry tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='is_suspicious') THEN
        ALTER TABLE public.groups ADD COLUMN is_suspicious BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='suspicious_reason') THEN
        ALTER TABLE public.groups ADD COLUMN suspicious_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='admin_notes') THEN
        ALTER TABLE public.groups ADD COLUMN admin_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='expired_at') THEN
        ALTER TABLE public.groups ADD COLUMN expired_at TIMESTAMPTZ;
    END IF;

    -- Quotations active flag (deactivated when dealer suspended)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quotations' AND column_name='is_active') THEN
        ALTER TABLE public.quotations ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quotations' AND column_name='deactivated_reason') THEN
        ALTER TABLE public.quotations ADD COLUMN deactivated_reason TEXT;
    END IF;

    -- Bookings dealer suspension flag & fallback tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='dealer_suspended') THEN
        ALTER TABLE public.bookings ADD COLUMN dealer_suspended BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='fallback_delivered_by_admin') THEN
        ALTER TABLE public.bookings ADD COLUMN fallback_delivered_by_admin UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='cancellation_reason') THEN
        ALTER TABLE public.bookings ADD COLUMN cancellation_reason TEXT;
    END IF;

    -- Dealerships suspension reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dealerships' AND column_name='suspension_reason') THEN
        ALTER TABLE public.dealerships ADD COLUMN suspension_reason TEXT;
    END IF;

    -- Ratings moderation (hidden reviews excluded from public/dealer averages)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dealer_ratings' AND column_name='is_hidden') THEN
        ALTER TABLE public.dealer_ratings ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dealer_ratings' AND column_name='hidden_reason') THEN
        ALTER TABLE public.dealer_ratings ADD COLUMN hidden_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dealer_ratings' AND column_name='hidden_by') THEN
        ALTER TABLE public.dealer_ratings ADD COLUMN hidden_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dealer_ratings' AND column_name='hidden_at') THEN
        ALTER TABLE public.dealer_ratings ADD COLUMN hidden_at TIMESTAMPTZ;
    END IF;

    -- Reports & disputes workflow
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reports' AND column_name='status') THEN
        ALTER TABLE public.reports ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reports' AND column_name='admin_notes') THEN
        ALTER TABLE public.reports ADD COLUMN admin_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reports' AND column_name='action_taken') THEN
        ALTER TABLE public.reports ADD COLUMN action_taken TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reports' AND column_name='resolved_by') THEN
        ALTER TABLE public.reports ADD COLUMN resolved_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reports' AND column_name='resolved_at') THEN
        ALTER TABLE public.reports ADD COLUMN resolved_at TIMESTAMPTZ;
    END IF;
END $$;

-- Seed all requested platform settings idempotently
INSERT INTO public.settings (key, value, description)
VALUES
    ('booking_amount', '5000', 'Fixed refundable deposit amount in INR (booking_amount + platform_fee < 10000)'),
    ('platform_fee', '100', 'Platform processing fee in INR (booking_amount + platform_fee < 10000)'),
    ('buyer_cancel_retention_percent', '5', 'Percentage of booking deposit retained by dealership on buyer-initiated cancellation'),
    ('fee_refund_on_dealer_fault', 'true', 'Whether platform fee is refunded alongside deposit on dealer-fault cancellation'),
    ('visibility_member_threshold', '3', 'Minimum active members required for immediate dealer visibility'),
    ('group_visibility_days_for_2_members', '20', 'Elapsed days required before a 2-member group becomes visible to dealers'),
    ('group_expiry_days_for_1_member', '45', 'Days after which an unformed 1-member group is automatically expired'),
    ('default_group_target', '10', 'Default target member count when buyers form a new group'),
    ('dealer_delivery_fallback_days', '14', 'Days elapsed after booking before admin or showroom delivery fallback applies'),
    ('quote_validity_default_days', '14', 'Default quotation validity window in days'),
    ('suspicious_group_member_threshold', '5', 'Member joins within time window that triggers automatic suspicious-group flag'),
    ('suspicious_group_window_minutes', '60', 'Window in minutes for suspicious rapid member join detection'),
    ('quote_outlier_threshold_percent', '15', 'Percentage deviation from group median on-road price flagged as quote outlier')
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- 6. UPDATED RLS POLICIES (Admin reads, block direct client admin writes, dealer suspension & hidden ratings)
-- ==============================================================================

-- Update check_dealership_status_change to allow super_admin/admin and SECURITY DEFINER internal RPCs
CREATE OR REPLACE FUNCTION public.check_dealership_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_is_internal BOOLEAN;
BEGIN
    v_is_internal := (current_setting('autogroup.internal_rpc', true) = 'true') OR (auth.uid() IS NULL);

    IF (OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason)
       OR (OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason)
       OR (OLD.verified_at IS DISTINCT FROM NEW.verified_at) THEN
        v_is_admin := public.is_admin();
        IF NOT v_is_admin AND NOT v_is_internal THEN
            RAISE EXCEPTION 'Only administrators may alter dealership verification status, reason, or verified_at timestamp.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Replace permissive "Admin full access ..." FOR ALL policies from 002 with strict READ policies for admins;
-- all writes must use the SECURITY DEFINER RPCs below.
DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users and admins read profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin full access dealerships" ON public.dealerships;
DROP POLICY IF EXISTS "Admin manage all dealerships" ON public.dealerships;
CREATE POLICY "Admin read all dealerships" ON public.dealerships
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage all dealer_users" ON public.dealer_users;
CREATE POLICY "Admin read all dealer_users" ON public.dealer_users
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin full access groups" ON public.groups;
CREATE POLICY "Admin read all groups" ON public.groups
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin read all group_members" ON public.group_members;
CREATE POLICY "Admin read all group_members" ON public.group_members
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin full access bookings" ON public.bookings;
CREATE POLICY "Admin read all bookings" ON public.bookings
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin read all payments" ON public.payments;
CREATE POLICY "Admin read all payments" ON public.payments
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin read all refunds" ON public.refunds;
CREATE POLICY "Admin read all refunds" ON public.refunds
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin read all interests" ON public.interests;
CREATE POLICY "Admin read all interests" ON public.interests
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin read all reports" ON public.reports;
CREATE POLICY "Admin read all reports" ON public.reports
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin read all notifications" ON public.notifications;
CREATE POLICY "Admin read all notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage settings" ON public.settings;

-- Quotations: buyers only see ACTIVE quotations; dealers see their own + visible active; admins see all
DROP POLICY IF EXISTS "Buyers view group quotes" ON public.quotations;
CREATE POLICY "Buyers view group quotes" ON public.quotations
    FOR SELECT TO authenticated
    USING (
        is_active = true
        AND group_id IN (SELECT id FROM public.groups WHERE district_id = public.current_user_district())
    );

DROP POLICY IF EXISTS "Verified dealers view eligible quotes" ON public.quotations;
CREATE POLICY "Verified dealers view eligible quotes" ON public.quotations
    FOR SELECT TO authenticated
    USING (
        (public.is_dealer_verified() AND is_active = true AND public.fn_is_group_visible_to_dealers(group_id))
        OR dealership_id = public.current_dealer_dealership_id()
    );

DROP POLICY IF EXISTS "Admin read all quotations" ON public.quotations;
CREATE POLICY "Admin read all quotations" ON public.quotations
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "View quote versions" ON public.quotation_versions;
CREATE POLICY "View quote versions" ON public.quotation_versions
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR quotation_id IN (SELECT id FROM public.quotations)
    );

-- Dealer ratings: public & non-admins cannot read hidden reviews
DROP POLICY IF EXISTS "Public view ratings" ON public.dealer_ratings;
CREATE POLICY "Public view non-hidden ratings" ON public.dealer_ratings
    FOR SELECT TO public
    USING (is_hidden = false OR public.is_admin());

-- Suspended dealer trigger: block new interests & bookings against suspended dealers or inactive quotes
CREATE OR REPLACE FUNCTION public.fn_enforce_active_quote_and_dealer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quote_active BOOLEAN;
    v_dealer_status TEXT;
BEGIN
    SELECT q.is_active, d.status INTO v_quote_active, v_dealer_status
    FROM public.quotations q
    JOIN public.dealerships d ON d.id = q.dealership_id
    WHERE q.id = NEW.quotation_id;

    IF v_quote_active IS DISTINCT FROM true OR v_dealer_status <> 'VERIFIED' THEN
        RAISE EXCEPTION 'Cannot create interest or booking: dealership is suspended/unverified or quotation is inactive.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_interest_suspended_dealer ON public.interests;
CREATE TRIGGER trg_block_interest_suspended_dealer
    BEFORE INSERT ON public.interests
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_active_quote_and_dealer();

DROP TRIGGER IF EXISTS trg_block_booking_suspended_dealer ON public.bookings;
CREATE TRIGGER trg_block_booking_suspended_dealer
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_active_quote_and_dealer();

-- Automatic suspicious group detection trigger when rapid joins exceed configured setting
CREATE OR REPLACE FUNCTION public.fn_detect_suspicious_group_joins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_threshold INTEGER;
    v_window_mins INTEGER;
    v_recent_count INTEGER;
BEGIN
    SELECT COALESCE(NULLIF(value, '')::INTEGER, 5) INTO v_threshold
    FROM public.settings WHERE key = 'suspicious_group_member_threshold';
    v_threshold := COALESCE(v_threshold, 5);

    SELECT COALESCE(NULLIF(value, '')::INTEGER, 60) INTO v_window_mins
    FROM public.settings WHERE key = 'suspicious_group_window_minutes';
    v_window_mins := COALESCE(v_window_mins, 60);

    SELECT COUNT(*) INTO v_recent_count
    FROM public.group_members
    WHERE group_id = NEW.group_id
      AND status = 'ACTIVE'
      AND joined_at >= now() - make_interval(mins => v_window_mins);

    IF v_recent_count >= v_threshold THEN
        UPDATE public.groups
        SET is_suspicious = true,
            suspicious_reason = COALESCE(suspicious_reason, v_recent_count || ' members joined within ' || v_window_mins || ' minutes (threshold: ' || v_threshold || ').'),
            updated_at = now()
        WHERE id = NEW.group_id AND is_suspicious = false;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_suspicious_group_joins ON public.group_members;
CREATE TRIGGER trg_detect_suspicious_group_joins
    AFTER INSERT OR UPDATE ON public.group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_detect_suspicious_group_joins();

-- Update group visibility function to honor configurable visibility_member_threshold
CREATE OR REPLACE FUNCTION public.fn_is_group_visible_to_dealers(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_member_count INTEGER;
    v_created_at TIMESTAMPTZ;
    v_min_members INTEGER;
    v_visibility_days INTEGER;
    v_days_elapsed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_member_count
    FROM public.group_members
    WHERE group_id = p_group_id AND status = 'ACTIVE';

    SELECT COALESCE(NULLIF(value, '')::INTEGER, 3) INTO v_min_members
    FROM public.settings WHERE key = 'visibility_member_threshold';
    v_min_members := COALESCE(v_min_members, 3);

    IF v_member_count >= v_min_members THEN
        RETURN true;
    ELSIF v_member_count = 2 THEN
        SELECT created_at INTO v_created_at FROM public.groups WHERE id = p_group_id;
        SELECT COALESCE(NULLIF(value, '')::INTEGER, 20) INTO v_visibility_days
        FROM public.settings WHERE key = 'group_visibility_days_for_2_members';
        v_visibility_days := COALESCE(v_visibility_days, 20);
        v_days_elapsed := EXTRACT(DAY FROM (now() - v_created_at));
        RETURN v_days_elapsed >= v_visibility_days;
    END IF;
    RETURN false;
END;
$$;

-- ==============================================================================
-- 7. SECURITY DEFINER ADMIN RPCS (All admin writes go here + atomic audit log)
-- ==============================================================================

-- 7.1 Sync last_sign_in_at and return admin status safely
CREATE OR REPLACE FUNCTION public.sync_user_sign_in()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN; END IF;
    PERFORM set_config('autogroup.internal_rpc', 'true', true);
    UPDATE public.profiles p
    SET last_sign_in_at = u.last_sign_in_at,
        email = LOWER(TRIM(u.email)),
        updated_at = now()
    FROM auth.users u
    WHERE p.id = auth.uid() AND u.id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_user_sign_in() TO authenticated;

-- 7.2 Clear must_change_password & log password change (Section B.4 & E)
CREATE OR REPLACE FUNCTION public.admin_complete_password_change(p_is_initial_forced BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: administrator privileges required.';
    END IF;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    IF p_is_initial_forced THEN
        UPDATE public.profiles
        SET must_change_password = false,
            updated_at = now()
        WHERE id = auth.uid();
    END IF;

    PERFORM public.fn_write_audit_log(
        auth.uid(),
        CASE WHEN p_is_initial_forced THEN 'ADMIN_FIRST_PASSWORD_SET' ELSE 'ADMIN_PASSWORD_CHANGED' END,
        'profile',
        auth.uid()::text,
        NULL,
        jsonb_build_object('must_change_password', false),
        'Password updated via admin security screen'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_complete_password_change(BOOLEAN) TO authenticated;

-- 7.3 Dealership Verification & Suspension (Approve, Reject, Suspend, Reactivate)
CREATE OR REPLACE FUNCTION public.admin_set_dealership_status(
    p_dealership_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dealer RECORD;
    v_new_status TEXT;
    v_du RECORD;
    v_paid_booking RECORD;
    v_affected_bookings INTEGER := 0;
    v_deactivated_quotes INTEGER := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: administrator privileges required.';
    END IF;

    SELECT * INTO v_dealer FROM public.dealerships WHERE id = p_dealership_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dealership not found.';
    END IF;

    p_action := UPPER(TRIM(p_action));
    IF p_action NOT IN ('APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE') THEN
        RAISE EXCEPTION 'Invalid action: %', p_action;
    END IF;

    IF p_action IN ('REJECT', 'SUSPEND') AND (p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5) THEN
        RAISE EXCEPTION 'A specific reason (at least 5 characters) is required when rejecting or suspending a dealership.';
    END IF;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    IF p_action = 'APPROVE' OR p_action = 'REACTIVATE' THEN
        v_new_status := 'VERIFIED';
        UPDATE public.dealerships
        SET status = v_new_status,
            verified_at = COALESCE(verified_at, now()),
            rejection_reason = NULL,
            suspension_reason = NULL,
            updated_at = now()
        WHERE id = p_dealership_id;

        IF p_action = 'REACTIVATE' THEN
            UPDATE public.quotations
            SET is_active = true, deactivated_reason = NULL, updated_at = now()
            WHERE dealership_id = p_dealership_id AND validity_date > now();

            UPDATE public.bookings
            SET dealer_suspended = false, updated_at = now()
            WHERE dealership_id = p_dealership_id AND status = 'PAID';
        END IF;
    ELSIF p_action = 'REJECT' THEN
        v_new_status := 'REJECTED';
        UPDATE public.dealerships
        SET status = v_new_status,
            rejection_reason = TRIM(p_reason),
            updated_at = now()
        WHERE id = p_dealership_id;
    ELSIF p_action = 'SUSPEND' THEN
        v_new_status := 'SUSPENDED';
        UPDATE public.dealerships
        SET status = v_new_status,
            suspension_reason = TRIM(p_reason),
            rejection_reason = TRIM(p_reason),
            updated_at = now()
        WHERE id = p_dealership_id;

        -- Deactivate live quotations & hide from buyers
        UPDATE public.quotations
        SET is_active = false,
            deactivated_reason = 'Dealership suspended: ' || TRIM(p_reason),
            updated_at = now()
        WHERE dealership_id = p_dealership_id AND is_active = true;
        GET DIAGNOSTICS v_deactivated_quotes = ROW_COUNT;

        -- Flag existing PAID bookings as dealer_suspended and notify affected buyers
        FOR v_paid_booking IN
            SELECT id, buyer_id, booking_code FROM public.bookings
            WHERE dealership_id = p_dealership_id AND status = 'PAID'
        LOOP
            UPDATE public.bookings SET dealer_suspended = true, updated_at = now() WHERE id = v_paid_booking.id;
            v_affected_bookings := v_affected_bookings + 1;

            INSERT INTO public.notifications (user_id, title, message, type, link_url)
            VALUES (
                v_paid_booking.buyer_id,
                'Notice Regarding Booked Dealership',
                'Dealership ' || v_dealer.name || ' for booking ' || v_paid_booking.booking_code ||
                ' has been suspended by administration. Your deposit remains protected; support can process a 100% dealer-fault refund if needed.',
                'BOOKING_CANCELLED',
                '/buyer/bookings'
            );
        END LOOP;
    END IF;

    -- Notify dealership users
    FOR v_du IN SELECT user_id FROM public.dealer_users WHERE dealership_id = p_dealership_id LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            v_du.user_id,
            CASE p_action
                WHEN 'APPROVE' THEN 'Dealership Verification Approved'
                WHEN 'REACTIVATE' THEN 'Dealership Account Reactivated'
                WHEN 'REJECT' THEN 'Dealership Application Rejected'
                WHEN 'SUSPEND' THEN 'Dealership Account Suspended'
            END,
            CASE p_action
                WHEN 'APPROVE' THEN 'Your showroom credentials have been verified. You can now quote eligible district groups.'
                WHEN 'REACTIVATE' THEN 'Your dealership has been reactivated by administration.'
                WHEN 'REJECT' THEN 'Your showroom application was rejected. Reason: ' || TRIM(p_reason)
                WHEN 'SUSPEND' THEN 'Your dealership has been suspended. Reason: ' || TRIM(p_reason)
            END,
            CASE WHEN p_action IN ('APPROVE', 'REACTIVATE') THEN 'DEALER_APPROVAL' ELSE 'SYSTEM' END
        );
    END LOOP;

    PERFORM public.fn_write_audit_log(
        auth.uid(),
        'DEALER_' || p_action,
        'dealership',
        p_dealership_id::text,
        jsonb_build_object('status', v_dealer.status),
        jsonb_build_object('status', v_new_status, 'deactivated_quotes', v_deactivated_quotes, 'flagged_paid_bookings', v_affected_bookings),
        TRIM(COALESCE(p_reason, 'Admin dealership action')),
        jsonb_build_object('showroom_name', v_dealer.name, 'previous_status', v_dealer.status, 'new_status', v_new_status)
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_status', v_new_status,
        'deactivated_quotes', v_deactivated_quotes,
        'flagged_bookings', v_affected_bookings
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_dealership_status(UUID, TEXT, TEXT) TO authenticated;

-- 7.4 Buyer Status Management & Account Deletion Requests
CREATE OR REPLACE FUNCTION public.buyer_request_account_deletion(p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    UPDATE public.profiles
    SET deletion_requested_at = now(),
        deletion_reason = NULLIF(TRIM(p_reason), ''),
        deletion_status = 'PENDING',
        updated_at = now()
    WHERE id = auth.uid();

    INSERT INTO public.notifications (user_id, title, message, type, link_url)
    SELECT id, 'Account Deletion Request',
           'A buyer account (' || auth.uid()::text || ') requested account deletion.',
           'ADMIN_ALERT',
           '/admin/buyers/' || auth.uid()::text
    FROM public.profiles
    WHERE role IN ('admin', 'super_admin') AND status = 'ACTIVE';

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.buyer_request_account_deletion(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_buyer_status(
    p_buyer_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prof RECORD;
    v_new_status TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: administrator privileges required.';
    END IF;

    SELECT * INTO v_prof FROM public.profiles WHERE id = p_buyer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;

    IF v_prof.role IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Forbidden: cannot modify admin accounts through buyer management.';
    END IF;

    p_action := UPPER(TRIM(p_action));
    IF p_action NOT IN ('SUSPEND', 'REACTIVATE', 'DEACTIVATE', 'PROCESS_DELETION', 'REJECT_DELETION') THEN
        RAISE EXCEPTION 'Invalid buyer action: %', p_action;
    END IF;

    IF p_action IN ('SUSPEND', 'DEACTIVATE') AND (p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5) THEN
        RAISE EXCEPTION 'A reason (minimum 5 characters) is required for suspension or deactivation.';
    END IF;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    IF p_action = 'SUSPEND' THEN
        v_new_status := 'SUSPENDED';
        UPDATE public.profiles
        SET status = 'SUSPENDED', suspension_reason = TRIM(p_reason), updated_at = now()
        WHERE id = p_buyer_id;
    ELSIF p_action = 'REACTIVATE' THEN
        v_new_status := 'ACTIVE';
        UPDATE public.profiles
        SET status = 'ACTIVE', suspension_reason = NULL, updated_at = now()
        WHERE id = p_buyer_id;
    ELSIF p_action = 'DEACTIVATE' THEN
        v_new_status := 'DEACTIVATED';
        UPDATE public.profiles
        SET status = 'DEACTIVATED', suspension_reason = TRIM(p_reason), consent_share_details = false, updated_at = now()
        WHERE id = p_buyer_id;
    ELSIF p_action = 'PROCESS_DELETION' THEN
        v_new_status := 'DEACTIVATED';
        UPDATE public.profiles
        SET status = 'DEACTIVATED',
            deletion_status = 'PROCESSED',
            full_name = 'Deleted User',
            phone = '',
            consent_share_details = false,
            suspension_reason = COALESCE(TRIM(p_reason), 'Deletion request processed'),
            updated_at = now()
        WHERE id = p_buyer_id;

        UPDATE public.group_members
        SET status = 'LEFT', left_at = now()
        WHERE user_id = p_buyer_id AND status = 'ACTIVE';
    ELSIF p_action = 'REJECT_DELETION' THEN
        v_new_status := v_prof.status;
        UPDATE public.profiles
        SET deletion_status = 'REJECTED', updated_at = now()
        WHERE id = p_buyer_id;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_buyer_id,
        'Account Status Update',
        'Your account action (' || p_action || ') was processed by AutoGroup administration.' ||
        CASE WHEN p_reason IS NOT NULL THEN ' Notes: ' || TRIM(p_reason) ELSE '' END,
        'SYSTEM'
    );

    PERFORM public.fn_write_audit_log(
        auth.uid(),
        'BUYER_' || p_action,
        'profile',
        p_buyer_id::text,
        jsonb_build_object('status', v_prof.status, 'deletion_status', v_prof.deletion_status),
        jsonb_build_object('status', v_new_status),
        TRIM(COALESCE(p_reason, p_action))
    );

    RETURN jsonb_build_object('success', true, 'new_status', v_new_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_buyer_status(UUID, TEXT, TEXT) TO authenticated;

-- 7.5 Catalogue Management RPCs (never hard-delete rows in use)
CREATE OR REPLACE FUNCTION public.admin_upsert_manufacturer(
    p_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_old RECORD;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 2 THEN RAISE EXCEPTION 'Manufacturer name is required.'; END IF;

    IF p_id IS NOT NULL THEN
        SELECT * INTO v_old FROM public.manufacturers WHERE id = p_id;
        UPDATE public.manufacturers
        SET name = TRIM(p_name), logo_url = NULLIF(TRIM(p_logo_url), ''), is_active = COALESCE(p_is_active, true)
        WHERE id = p_id
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'CATALOG_UPDATE_MANUFACTURER', 'manufacturer', v_id::text,
            jsonb_build_object('name', v_old.name, 'is_active', v_old.is_active),
            jsonb_build_object('name', TRIM(p_name), 'is_active', COALESCE(p_is_active, true)));
    ELSE
        INSERT INTO public.manufacturers (name, logo_url, is_active)
        VALUES (TRIM(p_name), NULLIF(TRIM(p_logo_url), ''), COALESCE(p_is_active, true))
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'CATALOG_CREATE_MANUFACTURER', 'manufacturer', v_id::text,
            NULL, jsonb_build_object('name', TRIM(p_name), 'is_active', COALESCE(p_is_active, true)));
    END IF;
    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_manufacturer(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_model(
    p_id UUID DEFAULT NULL,
    p_manufacturer_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_body_type TEXT DEFAULT NULL,
    p_fuel_types TEXT[] DEFAULT '{}',
    p_image_url TEXT DEFAULT NULL,
    p_starting_price NUMERIC DEFAULT 0,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_old RECORD;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 2 THEN RAISE EXCEPTION 'Model name is required.'; END IF;
    IF p_body_type NOT IN ('Hatchback', 'Sedan', 'SUV', 'MUV', 'EV') THEN RAISE EXCEPTION 'Invalid body type.'; END IF;
    IF p_starting_price < 0 THEN RAISE EXCEPTION 'Starting price cannot be negative.'; END IF;

    IF p_id IS NOT NULL THEN
        SELECT * INTO v_old FROM public.models WHERE id = p_id;
        UPDATE public.models
        SET manufacturer_id = COALESCE(p_manufacturer_id, manufacturer_id),
            name = TRIM(p_name),
            body_type = p_body_type,
            fuel_types = COALESCE(p_fuel_types, '{}'),
            image_url = NULLIF(TRIM(p_image_url), ''),
            starting_price = p_starting_price,
            is_active = COALESCE(p_is_active, true)
        WHERE id = p_id
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'CATALOG_UPDATE_MODEL', 'model', v_id::text,
            jsonb_build_object('name', v_old.name, 'starting_price', v_old.starting_price, 'is_active', v_old.is_active),
            jsonb_build_object('name', TRIM(p_name), 'starting_price', p_starting_price, 'is_active', COALESCE(p_is_active, true)));
    ELSE
        INSERT INTO public.models (manufacturer_id, name, body_type, fuel_types, image_url, starting_price, is_active)
        VALUES (p_manufacturer_id, TRIM(p_name), p_body_type, COALESCE(p_fuel_types, '{}'), NULLIF(TRIM(p_image_url), ''), p_starting_price, COALESCE(p_is_active, true))
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'CATALOG_CREATE_MODEL', 'model', v_id::text,
            NULL, jsonb_build_object('name', TRIM(p_name), 'starting_price', p_starting_price));
    END IF;
    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_model(UUID, UUID, TEXT, TEXT, TEXT[], TEXT, NUMERIC, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_variant(
    p_id UUID DEFAULT NULL,
    p_model_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_transmission TEXT DEFAULT NULL,
    p_fuel_type TEXT DEFAULT NULL,
    p_engine_cc INTEGER DEFAULT NULL,
    p_ex_showroom_price NUMERIC DEFAULT 0,
    p_features TEXT[] DEFAULT '{}',
    p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_old RECORD;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN RAISE EXCEPTION 'Variant name is required.'; END IF;
    IF p_transmission NOT IN ('Manual', 'Automatic', 'iMT', 'DCT', 'CVT') THEN RAISE EXCEPTION 'Invalid transmission.'; END IF;
    IF p_fuel_type NOT IN ('Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid') THEN RAISE EXCEPTION 'Invalid fuel type.'; END IF;
    IF p_ex_showroom_price < 0 THEN RAISE EXCEPTION 'Ex-showroom price cannot be negative.'; END IF;

    IF p_id IS NOT NULL THEN
        SELECT * INTO v_old FROM public.variants WHERE id = p_id;
        UPDATE public.variants
        SET model_id = COALESCE(p_model_id, model_id),
            name = TRIM(p_name),
            transmission = p_transmission,
            fuel_type = p_fuel_type,
            engine_cc = p_engine_cc,
            ex_showroom_price = p_ex_showroom_price,
            features = COALESCE(p_features, '{}'),
            is_active = COALESCE(p_is_active, true)
        WHERE id = p_id
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'CATALOG_UPDATE_VARIANT', 'variant', v_id::text,
            jsonb_build_object('name', v_old.name, 'ex_showroom_price', v_old.ex_showroom_price, 'is_active', v_old.is_active),
            jsonb_build_object('name', TRIM(p_name), 'ex_showroom_price', p_ex_showroom_price, 'is_active', COALESCE(p_is_active, true)));
    ELSE
        INSERT INTO public.variants (model_id, name, transmission, fuel_type, engine_cc, ex_showroom_price, features, is_active)
        VALUES (p_model_id, TRIM(p_name), p_transmission, p_fuel_type, p_engine_cc, p_ex_showroom_price, COALESCE(p_features, '{}'), COALESCE(p_is_active, true))
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'CATALOG_CREATE_VARIANT', 'variant', v_id::text,
            NULL, jsonb_build_object('name', TRIM(p_name), 'ex_showroom_price', p_ex_showroom_price));
    END IF;
    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_variant(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT[], BOOLEAN) TO authenticated;

-- 7.6 Districts Management RPC
CREATE OR REPLACE FUNCTION public.admin_upsert_district(
    p_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_code TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_old RECORD;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 2 THEN RAISE EXCEPTION 'District name is required.'; END IF;
    IF p_state IS NULL OR LENGTH(TRIM(p_state)) < 2 THEN RAISE EXCEPTION 'State name is required.'; END IF;

    IF p_id IS NOT NULL THEN
        SELECT * INTO v_old FROM public.districts WHERE id = p_id;
        UPDATE public.districts
        SET name = TRIM(p_name),
            state = TRIM(p_state),
            code = UPPER(TRIM(COALESCE(p_code, code))),
            is_active = COALESCE(p_is_active, true)
        WHERE id = p_id
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'DISTRICT_UPDATE', 'district', v_id::text,
            jsonb_build_object('name', v_old.name, 'state', v_old.state, 'is_active', v_old.is_active),
            jsonb_build_object('name', TRIM(p_name), 'state', TRIM(p_state), 'is_active', COALESCE(p_is_active, true)));
    ELSE
        INSERT INTO public.districts (name, state, code, is_active)
        VALUES (TRIM(p_name), TRIM(p_state), UPPER(TRIM(p_code)), COALESCE(p_is_active, true))
        RETURNING id INTO v_id;

        PERFORM public.fn_write_audit_log(auth.uid(), 'DISTRICT_CREATE', 'district', v_id::text,
            NULL, jsonb_build_object('name', TRIM(p_name), 'state', TRIM(p_state), 'code', UPPER(TRIM(p_code))));
    END IF;
    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_district(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 7.7 Group Management & Automated 1-Member Expiry RPCs
CREATE OR REPLACE FUNCTION public.admin_manage_group(
    p_group_id UUID,
    p_action TEXT,
    p_member_user_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group RECORD;
    v_next_creator UUID;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;

    SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Group not found.'; END IF;

    p_action := UPPER(TRIM(p_action));
    IF p_action NOT IN ('CANCEL', 'EXPIRE', 'REMOVE_MEMBER', 'FLAG_SUSPICIOUS', 'UNFLAG_SUSPICIOUS') THEN
        RAISE EXCEPTION 'Invalid group action: %', p_action;
    END IF;

    IF p_action IN ('REMOVE_MEMBER', 'FLAG_SUSPICIOUS', 'CANCEL') AND (p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3) THEN
        RAISE EXCEPTION 'A reason is required for this group action.';
    END IF;

    IF p_action = 'CANCEL' THEN
        UPDATE public.groups SET status = 'CANCELLED', admin_notes = TRIM(p_reason), updated_at = now() WHERE id = p_group_id;
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        SELECT user_id, 'Buying Group Cancelled', 'Your group was cancelled by administration. Reason: ' || TRIM(p_reason), 'SYSTEM', '/buyer/groups'
        FROM public.group_members WHERE group_id = p_group_id AND status = 'ACTIVE';
    ELSIF p_action = 'EXPIRE' THEN
        UPDATE public.groups SET status = 'EXPIRED', expired_at = now(), admin_notes = NULLIF(TRIM(p_reason), ''), updated_at = now() WHERE id = p_group_id;
    ELSIF p_action = 'REMOVE_MEMBER' THEN
        IF p_member_user_id IS NULL THEN RAISE EXCEPTION 'Member user ID is required.'; END IF;
        UPDATE public.group_members SET status = 'LEFT', left_at = now() WHERE group_id = p_group_id AND user_id = p_member_user_id AND status = 'ACTIVE';
        SELECT id INTO v_next_creator FROM public.group_members WHERE group_id = p_group_id AND status = 'ACTIVE' ORDER BY joined_at ASC LIMIT 1;
        IF v_next_creator IS NOT NULL THEN
            UPDATE public.group_members SET is_creator = true WHERE id = v_next_creator;
        END IF;
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (p_member_user_id, 'Removed from Buying Group', 'An administrator removed you from a buying group. Reason: ' || TRIM(p_reason), 'SYSTEM');
    ELSIF p_action = 'FLAG_SUSPICIOUS' THEN
        UPDATE public.groups SET is_suspicious = true, suspicious_reason = TRIM(p_reason), updated_at = now() WHERE id = p_group_id;
    ELSIF p_action = 'UNFLAG_SUSPICIOUS' THEN
        UPDATE public.groups SET is_suspicious = false, suspicious_reason = NULL, updated_at = now() WHERE id = p_group_id;
    END IF;

    PERFORM public.fn_write_audit_log(
        auth.uid(),
        'GROUP_' || p_action,
        'group',
        p_group_id::text,
        jsonb_build_object('status', v_group.status, 'is_suspicious', v_group.is_suspicious),
        jsonb_build_object('action', p_action, 'member_user_id', p_member_user_id),
        TRIM(COALESCE(p_reason, p_action))
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_manage_group(UUID, TEXT, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_expire_1_member_groups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expiry_days INTEGER;
    v_expired_count INTEGER := 0;
    v_group_ids UUID[];
    v_actor UUID;
BEGIN
    v_actor := auth.uid();
    -- Callable either by pg_cron/postgres (auth.uid() IS NULL) or by an authenticated admin
    IF v_actor IS NOT NULL AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: administrator privileges required to execute group expiry job.';
    END IF;

    SELECT COALESCE(NULLIF(value, '')::INTEGER, 45) INTO v_expiry_days
    FROM public.settings WHERE key = 'group_expiry_days_for_1_member';
    v_expiry_days := COALESCE(v_expiry_days, 45);

    WITH target_groups AS (
        SELECT g.id
        FROM public.groups g
        WHERE g.status = 'FORMING'
          AND g.created_at <= now() - make_interval(days => v_expiry_days)
          AND (SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id AND gm.status = 'ACTIVE') <= 1
    ),
    updated AS (
        UPDATE public.groups g
        SET status = 'EXPIRED', expired_at = now(), updated_at = now()
        FROM target_groups tg
        WHERE g.id = tg.id
        RETURNING g.id
    )
    SELECT ARRAY_AGG(id), COUNT(*) INTO v_group_ids, v_expired_count FROM updated;

    v_expired_count := COALESCE(v_expired_count, 0);

    IF v_expired_count > 0 THEN
        PERFORM public.fn_write_audit_log(
            v_actor,
            'GROUPS_AUTO_EXPIRED',
            'group',
            'batch',
            NULL,
            jsonb_build_object('expired_count', v_expired_count, 'expiry_days', v_expiry_days, 'group_ids', v_group_ids),
            'Expired 1-member groups older than ' || v_expiry_days || ' days'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'expired_count', v_expired_count, 'expiry_days', v_expiry_days);
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_expire_1_member_groups() TO authenticated;

-- 7.8 Bookings & Refunds RPC (Force dealer-fault cancellation or delivery fallback)
CREATE OR REPLACE FUNCTION public.admin_manage_booking(
    p_booking_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_b RECORD;
    v_fee_refund BOOLEAN;
    v_fallback_days INTEGER;
    v_elapsed_days INTEGER;
    v_fee_refunded NUMERIC := 0;
    v_total_refunded NUMERIC := 0;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;

    SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;

    p_action := UPPER(TRIM(p_action));

    IF p_action = 'FORCE_DEALER_FAULT_CANCEL' THEN
        IF v_b.status NOT IN ('PAID', 'PENDING') THEN
            RAISE EXCEPTION 'Only PAID or PENDING bookings can be cancelled for dealer fault (current: %).', v_b.status;
        END IF;
        IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
            RAISE EXCEPTION 'A specific reason is required to force a dealer-fault cancellation.';
        END IF;

        SELECT (COALESCE(value, 'true') = 'true') INTO v_fee_refund
        FROM public.settings WHERE key = 'fee_refund_on_dealer_fault';
        v_fee_refund := COALESCE(v_fee_refund, true);

        v_fee_refunded := CASE WHEN v_fee_refund THEN v_b.platform_fee ELSE 0 END;
        v_total_refunded := v_b.booking_amount + v_fee_refunded;

        UPDATE public.bookings
        SET status = 'CANCELLED_BY_DEALER', cancellation_reason = TRIM(p_reason), updated_at = now()
        WHERE id = p_booking_id;

        INSERT INTO public.refunds (
            booking_id, reason, booking_amount_refunded, dealer_retained_amount, platform_fee_refunded, total_refunded, status
        ) VALUES (
            p_booking_id, 'DEALER_FAULT', v_b.booking_amount, 0, v_fee_refunded, v_total_refunded, 'PROCESSED'
        );

        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        VALUES (
            v_b.buyer_id,
            'Booking Cancelled — 100% Refund Issued',
            'Booking ' || v_b.booking_code || ' was cancelled by administration (dealer fault). Full refund of ₹' || v_total_refunded || ' processed.',
            'BOOKING_CANCELLED',
            '/buyer/bookings'
        );

        PERFORM public.fn_write_audit_log(
            auth.uid(), 'BOOKING_FORCE_DEALER_CANCEL', 'booking', p_booking_id::text,
            jsonb_build_object('status', v_b.status),
            jsonb_build_object('status', 'CANCELLED_BY_DEALER', 'total_refunded', v_total_refunded, 'fee_refunded', v_fee_refunded),
            TRIM(p_reason)
        );

        RETURN jsonb_build_object('success', true, 'total_refunded', v_total_refunded, 'platform_fee_refunded', v_fee_refunded);

    ELSIF p_action = 'MARK_DELIVERED_FALLBACK' THEN
        IF v_b.status <> 'PAID' THEN
            RAISE EXCEPTION 'Only PAID bookings can be marked delivered under fallback rule.';
        END IF;

        SELECT COALESCE(NULLIF(value, '')::INTEGER, 14) INTO v_fallback_days
        FROM public.settings WHERE key = 'dealer_delivery_fallback_days';
        v_fallback_days := COALESCE(v_fallback_days, 14);
        v_elapsed_days := EXTRACT(DAY FROM (now() - v_b.created_at));

        IF v_elapsed_days < v_fallback_days THEN
            RAISE EXCEPTION 'Fallback delivery requires at least % days elapsed since booking (currently % days).', v_fallback_days, v_elapsed_days;
        END IF;

        UPDATE public.bookings
        SET status = 'DELIVERED', delivered_at = now(), fallback_delivered_by_admin = auth.uid(), updated_at = now()
        WHERE id = p_booking_id;

        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        VALUES (
            v_b.buyer_id,
            'Booking Marked Delivered (Fallback Rule)',
            'Booking ' || v_b.booking_code || ' was closed as DELIVERED after the ' || v_fallback_days || '-day confirmation period.',
            'GENERAL',
            '/buyer/bookings'
        );

        PERFORM public.fn_write_audit_log(
            auth.uid(), 'BOOKING_FALLBACK_DELIVERED', 'booking', p_booking_id::text,
            jsonb_build_object('status', v_b.status),
            jsonb_build_object('status', 'DELIVERED', 'elapsed_days', v_elapsed_days),
            TRIM(COALESCE(p_reason, 'Admin delivery fallback applied'))
        );

        RETURN jsonb_build_object('success', true, 'status', 'DELIVERED');
    ELSE
        RAISE EXCEPTION 'Invalid booking action: %', p_action;
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_manage_booking(UUID, TEXT, TEXT) TO authenticated;

-- 7.9 Reports & Disputes Workflow RPC
CREATE OR REPLACE FUNCTION public.admin_manage_report(
    p_report_id UUID,
    p_status TEXT,
    p_admin_notes TEXT DEFAULT NULL,
    p_action TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rep RECORD;
    v_dealer_name TEXT;
    v_du RECORD;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;

    SELECT * INTO v_rep FROM public.reports WHERE id = p_report_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Report not found.'; END IF;

    p_status := UPPER(TRIM(p_status));
    IF p_status NOT IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED') THEN
        RAISE EXCEPTION 'Invalid report status.';
    END IF;

    SELECT name INTO v_dealer_name FROM public.dealerships WHERE id = v_rep.dealership_id;

    UPDATE public.reports
    SET status = p_status,
        admin_notes = COALESCE(NULLIF(TRIM(p_admin_notes), ''), admin_notes),
        action_taken = COALESCE(NULLIF(UPPER(TRIM(p_action)), ''), action_taken),
        resolved_by = CASE WHEN p_status IN ('RESOLVED', 'REJECTED') THEN auth.uid() ELSE resolved_by END,
        resolved_at = CASE WHEN p_status IN ('RESOLVED', 'REJECTED') THEN now() ELSE resolved_at END
    WHERE id = p_report_id;

    -- Handle enforcement actions
    IF UPPER(COALESCE(p_action, '')) = 'SUSPEND_DEALER' THEN
        PERFORM public.admin_set_dealership_status(
            v_rep.dealership_id,
            'SUSPEND',
            COALESCE(NULLIF(TRIM(p_admin_notes), ''), 'Suspended following buyer dispute report #' || p_report_id::text)
        );
    ELSIF UPPER(COALESCE(p_action, '')) = 'WARN_DEALER' THEN
        FOR v_du IN SELECT user_id FROM public.dealer_users WHERE dealership_id = v_rep.dealership_id LOOP
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                v_du.user_id,
                'Compliance Warning from AutoGroup Administration',
                'An official warning has been logged against ' || COALESCE(v_dealer_name, 'your dealership') ||
                '. Notes: ' || COALESCE(NULLIF(TRIM(p_admin_notes), ''), 'Please strictly honor locked on-road quotations.'),
                'SYSTEM'
            );
        END LOOP;
    END IF;

    -- Notify reporting buyer when investigating, resolved, rejected, or actioned
    IF p_status IN ('INVESTIGATING', 'RESOLVED', 'REJECTED') OR p_action IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            v_rep.buyer_id,
            'Update on Your Dealership Report',
            'Your report against ' || COALESCE(v_dealer_name, 'dealership') || ' is now ' || p_status ||
            CASE WHEN p_admin_notes IS NOT NULL AND TRIM(p_admin_notes) <> '' THEN '. Admin note: ' || TRIM(p_admin_notes) ELSE '' END,
            'GENERAL'
        );
    END IF;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'REPORT_' || COALESCE(NULLIF(UPPER(TRIM(p_action)), ''), p_status),
        'report', p_report_id::text,
        jsonb_build_object('status', v_rep.status),
        jsonb_build_object('status', p_status, 'action', p_action),
        TRIM(COALESCE(p_admin_notes, p_status))
    );

    RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_manage_report(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 7.10 Ratings Hide / Unhide Moderation RPC
CREATE OR REPLACE FUNCTION public.admin_toggle_rating_visibility(
    p_rating_id UUID,
    p_hide BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rat RECORD;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;

    SELECT * INTO v_rat FROM public.dealer_ratings WHERE id = p_rating_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rating record not found.'; END IF;

    IF p_hide AND (p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3) THEN
        RAISE EXCEPTION 'A moderation reason is required to hide a review.';
    END IF;

    UPDATE public.dealer_ratings
    SET is_hidden = p_hide,
        hidden_reason = CASE WHEN p_hide THEN TRIM(p_reason) ELSE NULL END,
        hidden_by = CASE WHEN p_hide THEN auth.uid() ELSE NULL END,
        hidden_at = CASE WHEN p_hide THEN now() ELSE NULL END
    WHERE id = p_rating_id;

    PERFORM public.fn_write_audit_log(
        auth.uid(),
        CASE WHEN p_hide THEN 'RATING_HIDE' ELSE 'RATING_UNHIDE' END,
        'dealer_rating', p_rating_id::text,
        jsonb_build_object('is_hidden', v_rat.is_hidden),
        jsonb_build_object('is_hidden', p_hide),
        TRIM(COALESCE(p_reason, CASE WHEN p_hide THEN 'Hidden by admin' ELSE 'Unhidden by admin' END))
    );

    RETURN jsonb_build_object('success', true, 'is_hidden', p_hide);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_rating_visibility(UUID, BOOLEAN, TEXT) TO authenticated;

-- 7.11 Settings Update RPC (super_admin ONLY, server-side validation, old/new audit log)
CREATE OR REPLACE FUNCTION public.admin_update_setting(
    p_key TEXT,
    p_value TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_value TEXT;
    v_num NUMERIC;
    v_booking_amt NUMERIC;
    v_platform_fee NUMERIC;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: only super_admin may alter platform settings.';
    END IF;

    SELECT value INTO v_old_value FROM public.settings WHERE key = p_key;
    IF NOT FOUND THEN RAISE EXCEPTION 'Setting key "%" does not exist.', p_key; END IF;

    p_value := TRIM(p_value);

    IF p_key IN ('fee_refund_on_dealer_fault') THEN
        IF p_value NOT IN ('true', 'false') THEN
            RAISE EXCEPTION 'Setting "%" must be true or false.', p_key;
        END IF;
    ELSE
        BEGIN
            v_num := p_value::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Setting "%" must be a valid numeric value.', p_key;
        END;

        IF v_num < 0 THEN
            RAISE EXCEPTION 'Setting "%" cannot be negative.', p_key;
        END IF;

        IF p_key = 'buyer_cancel_retention_percent' AND (v_num < 0 OR v_num > 100) THEN
            RAISE EXCEPTION 'Retention percent must be between 0 and 100.';
        END IF;

        IF p_key IN ('visibility_member_threshold', 'default_group_target') AND v_num < 1 THEN
            RAISE EXCEPTION 'Threshold "%" must be at least 1.', p_key;
        END IF;

        -- Validate booking_amount + platform_fee < 10000
        IF p_key = 'booking_amount' THEN
            SELECT COALESCE(value::NUMERIC, 0) INTO v_platform_fee FROM public.settings WHERE key = 'platform_fee';
            IF (v_num + v_platform_fee) >= 10000 THEN
                RAISE EXCEPTION 'booking_amount (%) + platform_fee (%) must remain strictly below ₹10,000.', v_num, v_platform_fee;
            END IF;
        ELSIF p_key = 'platform_fee' THEN
            SELECT COALESCE(value::NUMERIC, 0) INTO v_booking_amt FROM public.settings WHERE key = 'booking_amount';
            IF (v_booking_amt + v_num) >= 10000 THEN
                RAISE EXCEPTION 'booking_amount (%) + platform_fee (%) must remain strictly below ₹10,000.', v_booking_amt, v_num;
            END IF;
        END IF;
    END IF;

    UPDATE public.settings SET value = p_value, updated_at = now() WHERE key = p_key;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'SETTING_UPDATED', 'setting', p_key,
        jsonb_build_object('key', p_key, 'value', v_old_value),
        jsonb_build_object('key', p_key, 'value', p_value),
        'Platform setting updated from "' || v_old_value || '" to "' || p_value || '"'
    );

    RETURN jsonb_build_object('success', true, 'key', p_key, 'old_value', v_old_value, 'new_value', p_value);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(TEXT, TEXT) TO authenticated;

-- 7.12 Broadcast Announcements & Export Audit Logging RPCs
CREATE OR REPLACE FUNCTION public.admin_send_announcement(
    p_target TEXT,
    p_district_id UUID DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_link_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;
    IF p_title IS NULL OR LENGTH(TRIM(p_title)) < 3 THEN RAISE EXCEPTION 'Announcement title is required.'; END IF;
    IF p_message IS NULL OR LENGTH(TRIM(p_message)) < 5 THEN RAISE EXCEPTION 'Announcement message is required.'; END IF;

    p_target := UPPER(TRIM(p_target));
    IF p_target NOT IN ('ALL_BUYERS', 'ALL_DEALERS', 'DISTRICT_BUYERS', 'DISTRICT_ALL') THEN
        RAISE EXCEPTION 'Invalid announcement target: %', p_target;
    END IF;
    IF p_target IN ('DISTRICT_BUYERS', 'DISTRICT_ALL') AND p_district_id IS NULL THEN
        RAISE EXCEPTION 'District selection is required for district-targeted announcements.';
    END IF;

    IF p_target = 'ALL_BUYERS' THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        SELECT id, TRIM(p_title), TRIM(p_message), 'GENERAL', NULLIF(TRIM(p_link_url), '')
        FROM public.profiles WHERE role = 'buyer' AND status = 'ACTIVE';
    ELSIF p_target = 'ALL_DEALERS' THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        SELECT id, TRIM(p_title), TRIM(p_message), 'GENERAL', NULLIF(TRIM(p_link_url), '')
        FROM public.profiles WHERE role = 'dealer' AND status = 'ACTIVE';
    ELSIF p_target = 'DISTRICT_BUYERS' THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        SELECT id, TRIM(p_title), TRIM(p_message), 'GENERAL', NULLIF(TRIM(p_link_url), '')
        FROM public.profiles WHERE role = 'buyer' AND status = 'ACTIVE' AND district_id = p_district_id;
    ELSIF p_target = 'DISTRICT_ALL' THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        SELECT id, TRIM(p_title), TRIM(p_message), 'GENERAL', NULLIF(TRIM(p_link_url), '')
        FROM public.profiles WHERE role IN ('buyer', 'dealer') AND status = 'ACTIVE' AND district_id = p_district_id;
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'ANNOUNCEMENT_SENT', 'notification', p_target,
        NULL,
        jsonb_build_object('target', p_target, 'district_id', p_district_id, 'title', TRIM(p_title), 'recipient_count', v_count),
        'Broadcast announcement delivered'
    );

    RETURN jsonb_build_object('success', true, 'recipient_count', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_send_announcement(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_log_export(
    p_export_type TEXT,
    p_row_count INTEGER DEFAULT 0,
    p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'CSV_EXPORT_' || UPPER(TRIM(p_export_type)), 'export', LOWER(TRIM(p_export_type)),
        NULL,
        jsonb_build_object('row_count', p_row_count, 'filters', p_filters),
        'Exported ' || p_row_count || ' rows'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_log_export(TEXT, INTEGER, JSONB) TO authenticated;

-- 7.13 Admin Invites & Admin Management RPCs (super_admin only + invite validation/acceptance)
CREATE OR REPLACE FUNCTION public.admin_create_invite(
    p_email TEXT,
    p_role TEXT,
    p_token_hash TEXT,
    p_convert_existing BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email TEXT;
    v_recent_count INTEGER;
    v_invite_id UUID;
    v_expires_at TIMESTAMPTZ := now() + interval '7 days';
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: only super_admin can invite administrators.';
    END IF;

    v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
    IF v_clean_email = '' OR v_clean_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
        RAISE EXCEPTION 'Please provide a valid email address.';
    END IF;

    IF p_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Role must be admin or super_admin.';
    END IF;

    IF p_token_hash IS NULL OR LENGTH(TRIM(p_token_hash)) < 32 THEN
        RAISE EXCEPTION 'Invalid invite token digest.';
    END IF;

    -- Rate limit: max 10 invite creations per hour per super_admin
    SELECT COUNT(*) INTO v_recent_count
    FROM public.admin_invites
    WHERE invited_by = auth.uid() AND created_at > now() - interval '1 hour';

    IF v_recent_count >= 10 THEN
        RAISE EXCEPTION 'Rate limit exceeded: maximum 10 admin invites allowed per hour.';
    END IF;

    -- Revoke prior PENDING invites for the same email to keep one clean active invite
    UPDATE public.admin_invites
    SET status = 'REVOKED'
    WHERE LOWER(email) = v_clean_email AND status = 'PENDING';

    INSERT INTO public.admin_invites (
        email, role, token_hash, invited_by, status, convert_existing, expires_at
    ) VALUES (
        v_clean_email, p_role, p_token_hash, auth.uid(), 'PENDING', COALESCE(p_convert_existing, false), v_expires_at
    )
    RETURNING id INTO v_invite_id;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'ADMIN_INVITE_CREATED', 'admin_invite', v_invite_id::text,
        NULL,
        jsonb_build_object('email', v_clean_email, 'role', p_role, 'convert_existing', COALESCE(p_convert_existing, false), 'expires_at', v_expires_at),
        'Created admin invite'
    );

    RETURN jsonb_build_object('success', true, 'id', v_invite_id, 'email', v_clean_email, 'role', p_role, 'expires_at', v_expires_at);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_invite(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resend_invite(
    p_invite_id UUID,
    p_new_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv RECORD;
    v_recent_count INTEGER;
    v_expires_at TIMESTAMPTZ := now() + interval '7 days';
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: only super_admin can resend invites.';
    END IF;

    SELECT * INTO v_inv FROM public.admin_invites WHERE id = p_invite_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found.'; END IF;
    IF v_inv.status = 'ACCEPTED' THEN RAISE EXCEPTION 'Cannot resend an already accepted invite.'; END IF;

    SELECT COUNT(*) INTO v_recent_count
    FROM public.admin_invites
    WHERE invited_by = auth.uid() AND created_at > now() - interval '1 hour';
    IF v_recent_count >= 10 THEN
        RAISE EXCEPTION 'Rate limit exceeded: maximum 10 admin invites allowed per hour.';
    END IF;

    UPDATE public.admin_invites
    SET token_hash = p_new_token_hash,
        status = 'PENDING',
        expires_at = v_expires_at,
        created_at = now()
    WHERE id = p_invite_id;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'ADMIN_INVITE_RESENT', 'admin_invite', p_invite_id::text,
        jsonb_build_object('status', v_inv.status),
        jsonb_build_object('status', 'PENDING', 'expires_at', v_expires_at),
        'Resent admin invite with rotated token'
    );

    RETURN jsonb_build_object('success', true, 'id', p_invite_id, 'email', v_inv.email, 'role', v_inv.role, 'expires_at', v_expires_at);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_resend_invite(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_invite(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: only super_admin can revoke invites.';
    END IF;

    SELECT * INTO v_inv FROM public.admin_invites WHERE id = p_invite_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found.'; END IF;
    IF v_inv.status = 'ACCEPTED' THEN RAISE EXCEPTION 'Cannot revoke an already accepted invite.'; END IF;

    UPDATE public.admin_invites SET status = 'REVOKED' WHERE id = p_invite_id;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'ADMIN_INVITE_REVOKED', 'admin_invite', p_invite_id::text,
        jsonb_build_object('status', v_inv.status),
        jsonb_build_object('status', 'REVOKED'),
        'Revoked admin invite for ' || v_inv.email
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_revoke_invite(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_admin_status(
    p_target_user_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target RECORD;
    v_remaining_super INTEGER;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: only super_admin can manage administrator accounts.';
    END IF;

    IF p_target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Forbidden: administrators cannot modify their own role or deactivate themselves.';
    END IF;

    SELECT * INTO v_target FROM public.profiles WHERE id = p_target_user_id;
    IF NOT FOUND OR v_target.role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Target administrator profile not found.';
    END IF;

    p_action := UPPER(TRIM(p_action));
    IF p_action NOT IN ('DEACTIVATE', 'REACTIVATE', 'PROMOTE_SUPER', 'DEMOTE_ADMIN') THEN
        RAISE EXCEPTION 'Invalid admin action: %', p_action;
    END IF;

    -- Last super_admin guard
    IF v_target.role = 'super_admin' AND v_target.status = 'ACTIVE' AND p_action IN ('DEACTIVATE', 'DEMOTE_ADMIN') THEN
        SELECT COUNT(*) INTO v_remaining_super
        FROM public.profiles WHERE role = 'super_admin' AND status = 'ACTIVE' AND id <> p_target_user_id;
        IF v_remaining_super = 0 THEN
            RAISE EXCEPTION 'Cannot demote or deactivate the last active super_admin.';
        END IF;
    END IF;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    IF p_action = 'DEACTIVATE' THEN
        UPDATE public.profiles SET status = 'DEACTIVATED', suspension_reason = TRIM(COALESCE(p_reason, 'Deactivated by super_admin')), updated_at = now() WHERE id = p_target_user_id;
    ELSIF p_action = 'REACTIVATE' THEN
        UPDATE public.profiles SET status = 'ACTIVE', suspension_reason = NULL, updated_at = now() WHERE id = p_target_user_id;
    ELSIF p_action = 'PROMOTE_SUPER' THEN
        UPDATE public.profiles SET role = 'super_admin', updated_at = now() WHERE id = p_target_user_id;
    ELSIF p_action = 'DEMOTE_ADMIN' THEN
        UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE id = p_target_user_id;
    END IF;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'ADMIN_ACCOUNT_' || p_action, 'profile', p_target_user_id::text,
        jsonb_build_object('role', v_target.role, 'status', v_target.status),
        jsonb_build_object('action', p_action),
        TRIM(COALESCE(p_reason, p_action))
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_status(UUID, TEXT, TEXT) TO authenticated;

-- Public invite validation (returns only valid/invalid + invited email/role + existing-account status)
CREATE OR REPLACE FUNCTION public.validate_admin_invite(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_inv RECORD;
    v_account_exists BOOLEAN := false;
    v_existing_role TEXT;
BEGIN
    IF p_token_hash IS NULL OR TRIM(p_token_hash) = '' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Missing invite token.');
    END IF;

    SELECT * INTO v_inv FROM public.admin_invites WHERE token_hash = TRIM(p_token_hash);
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'status', 'INVALID', 'reason', 'Invalid invite token.');
    END IF;

    IF v_inv.status = 'PENDING' AND v_inv.expires_at <= now() THEN
        UPDATE public.admin_invites SET status = 'EXPIRED' WHERE id = v_inv.id;
        v_inv.status := 'EXPIRED';
    END IF;

    IF v_inv.status <> 'PENDING' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'status', v_inv.status,
            'email', v_inv.email,
            'reason', 'Invite is ' || LOWER(v_inv.status) || '.'
        );
    END IF;

    -- Check if an existing non-admin account already exists prior to this invite acceptance
    SELECT EXISTS (
        SELECT 1 FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE LOWER(u.email) = LOWER(v_inv.email)
          AND COALESCE(p.role, '') NOT IN ('admin', 'super_admin')
          AND (
              u.created_at < v_inv.created_at
              OR COALESCE(u.raw_user_meta_data->>'role', '') IN ('buyer', 'dealer')
          )
    ) INTO v_account_exists;

    IF v_account_exists THEN
        SELECT p.role INTO v_existing_role
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.id
        WHERE LOWER(u.email) = LOWER(v_inv.email)
        LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'status', 'PENDING',
        'email', v_inv.email,
        'role', v_inv.role,
        'convert_existing', v_inv.convert_existing,
        'account_exists', v_account_exists,
        'existing_role', v_existing_role,
        'expires_at', v_inv.expires_at
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_admin_invite(TEXT) TO anon, authenticated;

-- Accept admin invite (requires verified auth session matching invite email + OTP check)
CREATE OR REPLACE FUNCTION public.accept_admin_invite(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_inv RECORD;
    v_user_email TEXT;
    v_user_confirmed TIMESTAMPTZ;
    v_user_created TIMESTAMPTZ;
    v_user_meta_role TEXT;
    v_profile RECORD;
    v_is_preexisting_non_admin BOOLEAN := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must verify your email with the 6-digit OTP code before accepting an admin invite.';
    END IF;

    SELECT email, email_confirmed_at, created_at, COALESCE(raw_user_meta_data->>'role', '')
    INTO v_user_email, v_user_confirmed, v_user_created, v_user_meta_role
    FROM auth.users WHERE id = auth.uid();

    IF v_user_email IS NULL OR v_user_confirmed IS NULL THEN
        RAISE EXCEPTION 'Your email address must be verified before accepting this invitation.';
    END IF;

    SELECT * INTO v_inv FROM public.admin_invites WHERE token_hash = TRIM(p_token_hash);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid admin invitation token.';
    END IF;

    IF v_inv.status = 'PENDING' AND v_inv.expires_at <= now() THEN
        UPDATE public.admin_invites SET status = 'EXPIRED' WHERE id = v_inv.id;
        RAISE EXCEPTION 'This admin invitation has expired.';
    END IF;

    IF v_inv.status <> 'PENDING' THEN
        RAISE EXCEPTION 'This admin invitation is already % and cannot be reused.', LOWER(v_inv.status);
    END IF;

    IF LOWER(TRIM(v_user_email)) <> LOWER(TRIM(v_inv.email)) THEN
        RAISE EXCEPTION 'Email mismatch: signed-in email (%) does not match invited email (%).', v_user_email, v_inv.email;
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

    v_is_preexisting_non_admin := (
        (v_user_created < v_inv.created_at)
        OR (v_user_meta_role IN ('buyer', 'dealer'))
        OR EXISTS (SELECT 1 FROM public.dealer_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.group_members WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.bookings WHERE buyer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.interests WHERE user_id = auth.uid())
    ) AND COALESCE(v_profile.role, '') NOT IN ('admin', 'super_admin');

    IF v_is_preexisting_non_admin AND NOT v_inv.convert_existing THEN
        RAISE EXCEPTION 'An existing buyer or dealer account uses this email. Ask a super_admin to mark "convert existing account" on the invite.';
    END IF;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    INSERT INTO public.profiles (id, role, full_name, phone, email, status, must_change_password, created_at, updated_at)
    VALUES (
        auth.uid(), v_inv.role,
        COALESCE(v_profile.full_name, split_part(v_user_email, '@', 1)),
        COALESCE(v_profile.phone, ''),
        LOWER(TRIM(v_user_email)),
        'ACTIVE',
        false,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        role = v_inv.role,
        email = LOWER(TRIM(v_user_email)),
        status = 'ACTIVE',
        must_change_password = false,
        updated_at = now();

    UPDATE public.admin_invites
    SET status = 'ACCEPTED', accepted_at = now()
    WHERE id = v_inv.id;

    -- Notify the inviter + write audit log
    IF v_inv.invited_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        VALUES (
            v_inv.invited_by,
            'Admin Invite Accepted',
            v_inv.email || ' accepted your ' || v_inv.role || ' invitation.',
            'ADMIN_ALERT',
            '/admin/admins'
        );
    END IF;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'ADMIN_INVITE_ACCEPTED', 'admin_invite', v_inv.id::text,
        jsonb_build_object('previous_role', COALESCE(v_profile.role, 'new')),
        jsonb_build_object('new_role', v_inv.role, 'email', v_inv.email),
        'Accepted invite with verified email OTP'
    );

    RETURN jsonb_build_object('success', true, 'role', v_inv.role, 'email', v_inv.email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_admin_invite(TEXT) TO authenticated;

-- Optional: schedule daily pg_cron job if pg_cron extension is available on Supabase
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autogroup_expire_1_member_groups') THEN
            PERFORM cron.schedule(
                'autogroup_expire_1_member_groups',
                '0 2 * * *',
                'SELECT public.fn_expire_1_member_groups();'
            );
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

COMMIT;
