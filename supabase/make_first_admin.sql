-- supabase/make_first_admin.sql
-- Provision or promote the first super_admin account (documentation & fallback script).
-- Safe to re-run (idempotent). Replace '<ADMIN_EMAIL>' with your admin account email
-- after creating the auth user in Supabase Authentication -> Users.

DO $$
DECLARE
    v_admin_email TEXT := '<ADMIN_EMAIL>';
    v_user_id UUID;
    v_full_name TEXT;
    v_prev_role TEXT;
BEGIN
    IF v_admin_email = '<ADMIN_EMAIL>' OR TRIM(v_admin_email) = '' THEN
        RAISE EXCEPTION 'Please replace <ADMIN_EMAIL> with the target first admin email before running.';
    END IF;

    SELECT id, COALESCE(NULLIF(TRIM(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1))
    INTO v_user_id, v_full_name
    FROM auth.users
    WHERE LOWER(email) = LOWER(TRIM(v_admin_email))
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Auth user with email % was not found in auth.users. Create or register the auth user first.', v_admin_email;
    END IF;

    SELECT role INTO v_prev_role FROM public.profiles WHERE id = v_user_id;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    INSERT INTO public.profiles (
        id, role, full_name, phone, email, status, must_change_password, consent_share_details, created_at, updated_at
    ) VALUES (
        v_user_id, 'super_admin', v_full_name, '', LOWER(TRIM(v_admin_email)), 'ACTIVE', true, false, now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'super_admin',
        email = LOWER(TRIM(v_admin_email)),
        status = 'ACTIVE',
        must_change_password = true,
        updated_at = now();

    INSERT INTO public.audit_log (
        entity_type, entity_id, action, actor_id, before_summary, after_summary, reason, payload, created_at
    ) VALUES (
        'profile',
        v_user_id::text,
        'FIRST_SUPER_ADMIN_PROVISIONED',
        v_user_id,
        jsonb_build_object('previous_role', v_prev_role),
        jsonb_build_object('role', 'super_admin', 'must_change_password', true, 'email', LOWER(TRIM(v_admin_email))),
        'Initial super_admin bootstrap script',
        jsonb_build_object('email', LOWER(TRIM(v_admin_email)), 'role', 'super_admin', 'must_change_password', true),
        now()
    );
END $$;
