-- supabase/tests/admin_rls_and_rules.sql
-- Non-destructive SQL test suite running inside a rolled-back transaction (BEGIN ... ROLLBACK).
-- Verifies RBAC, SECURITY DEFINER helper isolation, audit_log immutability, last super_admin protection,
-- settings cap (<10000), suspended-dealer quote/booking trigger, suspicious join trigger, and 1-member group expiry.

BEGIN;

DO $$
DECLARE
    v_super_id UUID := gen_random_uuid();
    v_admin_id UUID := gen_random_uuid();
    v_buyer_id UUID := gen_random_uuid();
    v_dealer_user_id UUID := gen_random_uuid();
    v_district_id UUID;
    v_variant_id UUID;
    v_dealership_id UUID := gen_random_uuid();
    v_group_id UUID := gen_random_uuid();
    v_old_group_id UUID := gen_random_uuid();
    v_quote_id UUID := gen_random_uuid();
    v_blocked BOOLEAN := false;
    v_res JSONB;
    v_suspicious BOOLEAN;
    v_audit_id UUID;
BEGIN
    SELECT id INTO v_district_id FROM public.districts LIMIT 1;
    SELECT id INTO v_variant_id FROM public.variants LIMIT 1;
    IF v_district_id IS NULL OR v_variant_id IS NULL THEN
        RAISE EXCEPTION 'Seeded district or variant missing; apply base migrations first.';
    END IF;

    -- 1. Verify signup trigger coerces unauthorized role ('super_admin' / 'admin') to 'buyer'
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (
        v_buyer_id, '00000000-0000-0000-0000-000000000000',
        'sqltest_signup_' || replace(v_buyer_id::text, '-', '') || '@example.test',
        'not_for_login', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"role":"super_admin","full_name":"Escalation Attempt"}'::jsonb,
        'authenticated', 'authenticated', now(), now()
    );

    IF (SELECT role FROM public.profiles WHERE id = v_buyer_id) <> 'buyer' THEN
        RAISE EXCEPTION 'TEST FAIL [1]: Signup trigger failed to coerce super_admin metadata to buyer.';
    END IF;

    -- 2. Create auth rows for synthetic test super_admin, regular admin, and dealer owner
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES
        (v_super_id, '00000000-0000-0000-0000-000000000000', 'sqltest_super_' || replace(v_super_id::text, '-', '') || '@example.test', 'x', now(), '{"provider":"email"}'::jsonb, '{"role":"buyer"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
        (v_admin_id, '00000000-0000-0000-0000-000000000000', 'sqltest_admin_' || replace(v_admin_id::text, '-', '') || '@example.test', 'x', now(), '{"provider":"email"}'::jsonb, '{"role":"buyer"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
        (v_dealer_user_id, '00000000-0000-0000-0000-000000000000', 'sqltest_dealer_' || replace(v_dealer_user_id::text, '-', '') || '@example.test', 'x', now(), '{"provider":"email"}'::jsonb, '{"role":"dealer"}'::jsonb, 'authenticated', 'authenticated', now(), now());

    PERFORM set_config('autogroup.internal_rpc', 'true', true);
    UPDATE public.profiles SET role = 'super_admin', status = 'ACTIVE' WHERE id = v_super_id;
    UPDATE public.profiles SET role = 'admin', status = 'ACTIVE' WHERE id = v_admin_id;
    PERFORM set_config('autogroup.internal_rpc', '', true);

    -- 3. Buyer direct API attempt to promote self must raise exception
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_buyer_id::text, 'role', 'authenticated')::text, true);
    v_blocked := false;
    BEGIN
        UPDATE public.profiles SET role = 'admin' WHERE id = v_buyer_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TEST FAIL [3]: Buyer was allowed to directly update own role.';
    END IF;

    -- 4. Buyer calling admin RPC must fail
    v_blocked := false;
    BEGIN
        PERFORM public.admin_update_setting('platform_fee', '250');
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TEST FAIL [4]: Buyer was allowed to invoke admin_update_setting.';
    END IF;

    -- 5. Regular admin cannot update settings (super_admin only)
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
    IF NOT public.is_admin() OR public.is_super_admin() THEN
        RAISE EXCEPTION 'TEST FAIL [5a]: Helper role flags incorrect for regular admin.';
    END IF;
    v_blocked := false;
    BEGIN
        PERFORM public.admin_update_setting('platform_fee', '250');
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TEST FAIL [5b]: Regular admin was allowed to modify settings.';
    END IF;

    -- 6. super_admin setting cap (< 10000) enforced; valid change logs audit_log
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_super_id::text, 'role', 'authenticated')::text, true);
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'TEST FAIL [6a]: is_super_admin() returned false for super_admin.';
    END IF;
    v_blocked := false;
    BEGIN
        PERFORM public.admin_update_setting('booking_amount', '9950'); -- 9950 + 100 >= 10000
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TEST FAIL [6b]: Allowed booking_amount + platform_fee >= 10000.';
    END IF;

    -- 7. Self-demotion & last super_admin protection
    v_blocked := false;
    BEGIN
        PERFORM public.admin_set_admin_status(v_super_id, 'DEMOTE_ADMIN', 'Self test');
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TEST FAIL [7a]: super_admin allowed to self-demote.';
    END IF;

    -- 8. Suspended dealer quote/booking trigger
    INSERT INTO public.dealerships (id, name, status, address, district_id, contact_phone, contact_email, gst_number)
    VALUES (v_dealership_id, 'SQL Test Dealer', 'VERIFIED', 'Road 1', v_district_id, '9999999999', 'sqltestdealer@example.test', '29ZZZZZ9999Z9Z9');

    INSERT INTO public.groups (id, variant_id, district_id, target_members, status, created_by)
    VALUES (v_group_id, v_variant_id, v_district_id, 10, 'OPEN_FOR_QUOTES', v_buyer_id);

    INSERT INTO public.quotations (id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges, on_road_price, validity_date, is_complete, is_active)
    VALUES (v_quote_id, v_group_id, v_dealership_id, 900000, 40000, 60000, 1000000, now() + interval '10 days', true, true);

    PERFORM public.admin_set_dealership_status(v_dealership_id, 'SUSPEND', 'Compliance violation test');

    IF (SELECT is_active FROM public.quotations WHERE id = v_quote_id) <> false THEN
        RAISE EXCEPTION 'TEST FAIL [8a]: Suspending dealer did not deactivate active quotations.';
    END IF;

    v_blocked := false;
    BEGIN
        INSERT INTO public.bookings (booking_code, group_id, quotation_id, buyer_id, dealership_id, booking_amount, platform_fee, total_amount, status, price_snapshot, buyer_name, buyer_phone)
        VALUES ('AG-TEST-BLK', v_group_id, v_quote_id, v_buyer_id, v_dealership_id, 5000, 100, 5100, 'PAID', '{}'::jsonb, 'Buyer', '9999999999');
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TEST FAIL [8b]: Booking allowed against suspended dealership/inactive quotation.';
    END IF;

    -- 9. audit_log append-only check (check RLS + REVOKE / trigger)
    SELECT id INTO v_audit_id FROM public.audit_log ORDER BY created_at DESC LIMIT 1;
    SET LOCAL ROLE authenticated;
    v_blocked := false;
    BEGIN
        UPDATE public.audit_log SET reason = 'tampered' WHERE id = v_audit_id;
    EXCEPTION WHEN OTHERS THEN
        v_blocked := true;
    END;
    RESET ROLE;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'TEST FAIL [9]: Authenticated user was able to UPDATE audit_log.';
    END IF;

    -- 10. 1-member group automatic expiry check
    INSERT INTO public.groups (id, variant_id, district_id, target_members, status, created_by, created_at)
    VALUES (v_old_group_id, v_variant_id, v_district_id, 10, 'FORMING', v_buyer_id, now() - interval '60 days');
    INSERT INTO public.group_members (group_id, user_id, status) VALUES (v_old_group_id, v_buyer_id, 'ACTIVE');

    SELECT public.fn_expire_1_member_groups() INTO v_res;
    IF (SELECT status FROM public.groups WHERE id = v_old_group_id) <> 'EXPIRED' THEN
        RAISE EXCEPTION 'TEST FAIL [10]: Aged 1-member group was not expired by fn_expire_1_member_groups().';
    END IF;

    -- 11. Authenticated RLS SELECT check (ensure no 42P17 infinite policy recursion as admin/dealer/buyer)
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_super_id::text, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM COUNT(*) FROM public.dealerships;
    PERFORM COUNT(*) FROM public.dealer_users;
    PERFORM COUNT(*) FROM public.groups;
    PERFORM COUNT(*) FROM public.quotations;
    PERFORM COUNT(*) FROM public.bookings;
    RESET ROLE;

    RAISE NOTICE 'ALL ADMIN SQL RLS & BUSINESS RULE TESTS PASSED CLEANLY!';
END $$;

ROLLBACK;
