-- supabase/test_setup.sql
-- Idempotent Test User Setup & Fixture Script
-- Safely configures ONLY the 6 explicitly declared @autogroup.in test emails and fixed test fixture UUIDs.
-- Will NEVER touch unrelated production/real user profiles or bookings.

DO $$
DECLARE
    v_buyer_a_email      TEXT := 'test_buyer_a@autogroup.in';
    v_buyer_b_email      TEXT := 'test_buyer_b@autogroup.in';
    v_dealer_a_email     TEXT := 'test_dealer_a@autogroup.in';
    v_dealer_b_email     TEXT := 'test_dealer_b@autogroup.in';
    v_admin_email        TEXT := 'test_admin@autogroup.in';
    v_super_admin_email  TEXT := 'test_super_admin@autogroup.in';

    v_buyer_a_id         UUID;
    v_buyer_b_id         UUID;
    v_dealer_a_id        UUID;
    v_dealer_b_id        UUID;
    v_admin_id           UUID;
    v_super_admin_id     UUID;

    v_dealership_a_id    UUID := 'e1111111-1111-1111-1111-111111111101'::UUID;
    v_dealership_b_id    UUID := 'e1111111-1111-1111-1111-111111111102'::UUID;
    v_dealership_pend_id UUID := 'e1111111-1111-1111-1111-111111111103'::UUID;

    v_dist_urban         UUID := 'd1111111-1111-1111-1111-111111111101'::UUID;
    v_dist_rural         UUID := 'd1111111-1111-1111-1111-111111111102'::UUID;
BEGIN
    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    SELECT id INTO v_buyer_a_id     FROM auth.users WHERE LOWER(email) = LOWER(v_buyer_a_email);
    SELECT id INTO v_buyer_b_id     FROM auth.users WHERE LOWER(email) = LOWER(v_buyer_b_email);
    SELECT id INTO v_dealer_a_id    FROM auth.users WHERE LOWER(email) = LOWER(v_dealer_a_email);
    SELECT id INTO v_dealer_b_id    FROM auth.users WHERE LOWER(email) = LOWER(v_dealer_b_email);
    SELECT id INTO v_admin_id       FROM auth.users WHERE LOWER(email) = LOWER(v_admin_email);
    SELECT id INTO v_super_admin_id FROM auth.users WHERE LOWER(email) = LOWER(v_super_admin_email);

    -- Buyer A
    IF v_buyer_a_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, email, phone, district_id, consent_share_details, status, updated_at)
        VALUES (v_buyer_a_id, 'buyer', 'Test Buyer Alpha', v_buyer_a_email, '9845011111', v_dist_urban, true, 'ACTIVE', now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'buyer', full_name = 'Test Buyer Alpha', email = v_buyer_a_email,
            phone = '9845011111', district_id = v_dist_urban, consent_share_details = true, status = 'ACTIVE', updated_at = now();
    END IF;

    -- Buyer B
    IF v_buyer_b_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, email, phone, district_id, consent_share_details, status, updated_at)
        VALUES (v_buyer_b_id, 'buyer', 'Test Buyer Beta', v_buyer_b_email, '9845022222', v_dist_urban, true, 'ACTIVE', now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'buyer', full_name = 'Test Buyer Beta', email = v_buyer_b_email,
            phone = '9845022222', district_id = v_dist_urban, consent_share_details = true, status = 'ACTIVE', updated_at = now();
    END IF;

    -- Dealer A (Verified)
    IF v_dealer_a_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, email, phone, district_id, consent_share_details, status, updated_at)
        VALUES (v_dealer_a_id, 'dealer', 'Rajesh Rao (Apex Tata)', v_dealer_a_email, '9845033333', v_dist_urban, true, 'ACTIVE', now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'dealer', full_name = 'Rajesh Rao (Apex Tata)', email = v_dealer_a_email,
            phone = '9845033333', district_id = v_dist_urban, status = 'ACTIVE', updated_at = now();

        INSERT INTO public.dealerships (
            id, name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts, verified_at, updated_at
        ) VALUES (
            v_dealership_a_id, 'Apex Motors Bengaluru', 'VERIFIED', '100 Feet Ring Road, Indiranagar, Bengaluru',
            v_dist_urban, '9845033333', v_dealer_a_email, '29AAAAA1111A1Z1',
            ARRAY['Tata Motors', 'Mahindra'], ARRAY[v_dist_urban], now(), now()
        )
        ON CONFLICT (id) DO UPDATE SET
            status = 'VERIFIED', name = 'Apex Motors Bengaluru', brands = ARRAY['Tata Motors', 'Mahindra'],
            districts = ARRAY[v_dist_urban], verified_at = now(), updated_at = now();

        INSERT INTO public.dealer_users (dealership_id, user_id, role)
        VALUES (v_dealership_a_id, v_dealer_a_id, 'owner')
        ON CONFLICT (dealership_id, user_id) DO UPDATE SET role = 'owner';
    END IF;

    -- Dealer B (Verified)
    IF v_dealer_b_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, email, phone, district_id, consent_share_details, status, updated_at)
        VALUES (v_dealer_b_id, 'dealer', 'Suresh Kumar (Premier Hyundai)', v_dealer_b_email, '9845044444', v_dist_rural, true, 'ACTIVE', now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'dealer', full_name = 'Suresh Kumar (Premier Hyundai)', email = v_dealer_b_email,
            phone = '9845044444', district_id = v_dist_rural, status = 'ACTIVE', updated_at = now();

        INSERT INTO public.dealerships (
            id, name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts, verified_at, updated_at
        ) VALUES (
            v_dealership_b_id, 'Premier Motors Rural', 'VERIFIED', 'NH 44, Devanahalli Highway, Bengaluru Rural',
            v_dist_rural, '9845044444', v_dealer_b_email, '29BBBBB2222B2Z2',
            ARRAY['Hyundai', 'Kia'], ARRAY[v_dist_rural], now(), now()
        )
        ON CONFLICT (id) DO UPDATE SET
            status = 'VERIFIED', name = 'Premier Motors Rural', brands = ARRAY['Hyundai', 'Kia'],
            districts = ARRAY[v_dist_rural], verified_at = now(), updated_at = now();

        INSERT INTO public.dealer_users (dealership_id, user_id, role)
        VALUES (v_dealership_b_id, v_dealer_b_id, 'owner')
        ON CONFLICT (dealership_id, user_id) DO UPDATE SET role = 'owner';
    END IF;

    -- Test Pending Dealership fixture for admin review workflow
    INSERT INTO public.dealerships (
        id, name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts, updated_at
    ) VALUES (
        v_dealership_pend_id, 'Sunrise Auto E2E Pending', 'PENDING', '42 MG Road, Bengaluru',
        v_dist_urban, '9845055555', 'pending_e2e_dealer@autogroup.in', '29CCCCC3333C3Z3',
        ARRAY['Tata Motors'], ARRAY[v_dist_urban], now()
    )
    ON CONFLICT (id) DO UPDATE SET status = 'PENDING', updated_at = now();

    -- Regular Admin
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, email, phone, district_id, consent_share_details, status, must_change_password, updated_at)
        VALUES (v_admin_id, 'admin', 'Test Regular Admin', v_admin_email, '9845088888', v_dist_urban, true, 'ACTIVE', false, now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin', full_name = 'Test Regular Admin', email = v_admin_email,
            status = 'ACTIVE', must_change_password = false, updated_at = now();
    END IF;

    -- Super Admin
    IF v_super_admin_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, email, phone, district_id, consent_share_details, status, must_change_password, updated_at)
        VALUES (v_super_admin_id, 'super_admin', 'Test Super Admin', v_super_admin_email, '9845099999', v_dist_urban, true, 'ACTIVE', false, now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'super_admin', full_name = 'Test Super Admin', email = v_super_admin_email,
            status = 'ACTIVE', must_change_password = false, updated_at = now();
    END IF;

    PERFORM set_config('autogroup.internal_rpc', '', true);
    RAISE NOTICE 'Test setup execution finished safely.';
END $$;
