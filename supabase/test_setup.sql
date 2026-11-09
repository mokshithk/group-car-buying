-- supabase/test_setup.sql
-- Idempotent Test User Setup & Verification Script
-- Preconditions: Create the 5 users in Supabase Dashboard (Authentication -> Users -> Add User with "Auto Confirm" enabled)
--
-- Safety Guard: This script strictly operates ONLY on the 5 explicitly declared test emails below.
-- It will REFUSE to execute or modify any other accounts.

DO $$
DECLARE
    -- 1. DECLARE TEST USER EMAILS (Must match the emails created in your Supabase Auth dashboard)
    v_buyer_a_email   TEXT := 'test_buyer_a@autogroup.in';
    v_buyer_b_email   TEXT := 'test_buyer_b@autogroup.in';
    v_dealer_a_email  TEXT := 'test_dealer_a@autogroup.in';
    v_dealer_b_email  TEXT := 'test_dealer_b@autogroup.in';
    v_admin_email     TEXT := 'test_admin@autogroup.in';

    -- Target IDs
    v_buyer_a_id      UUID;
    v_buyer_b_id      UUID;
    v_dealer_a_id     UUID;
    v_dealer_b_id     UUID;
    v_admin_id        UUID;

    v_dealership_a_id UUID := 'e1111111-1111-1111-1111-111111111101'::UUID;
    v_dealership_b_id UUID := 'e1111111-1111-1111-1111-111111111102'::UUID;

    v_dist_bengaluru_urban UUID := 'd1111111-1111-1111-1111-111111111101'::UUID;
    v_dist_bengaluru_rural UUID := 'd1111111-1111-1111-1111-111111111102'::UUID;
BEGIN
    -- 2. SAFETY GUARD: Refuse to execute if test accounts do not exist in auth.users
    SELECT id INTO v_buyer_a_id  FROM auth.users WHERE LOWER(email) = LOWER(v_buyer_a_email);
    SELECT id INTO v_buyer_b_id  FROM auth.users WHERE LOWER(email) = LOWER(v_buyer_b_email);
    SELECT id INTO v_dealer_a_id FROM auth.users WHERE LOWER(email) = LOWER(v_dealer_a_email);
    SELECT id INTO v_dealer_b_id FROM auth.users WHERE LOWER(email) = LOWER(v_dealer_b_email);
    SELECT id INTO v_admin_id    FROM auth.users WHERE LOWER(email) = LOWER(v_admin_email);

    IF v_buyer_a_id IS NULL OR v_buyer_b_id IS NULL OR v_dealer_a_id IS NULL OR v_dealer_b_id IS NULL OR v_admin_id IS NULL THEN
        RAISE NOTICE 'Notice: One or more test emails have not been created yet in auth.users.';
        RAISE NOTICE 'Ensure you have added the 5 users in Authentication -> Users before running:';
        RAISE NOTICE '  - % (ID: %)', v_buyer_a_email, COALESCE(v_buyer_a_id::TEXT, 'MISSING');
        RAISE NOTICE '  - % (ID: %)', v_buyer_b_email, COALESCE(v_buyer_b_id::TEXT, 'MISSING');
        RAISE NOTICE '  - % (ID: %)', v_dealer_a_email, COALESCE(v_dealer_a_id::TEXT, 'MISSING');
        RAISE NOTICE '  - % (ID: %)', v_dealer_b_email, COALESCE(v_dealer_b_id::TEXT, 'MISSING');
        RAISE NOTICE '  - % (ID: %)', v_admin_email, COALESCE(v_admin_id::TEXT, 'MISSING');
    END IF;

    -- 3. SETUP BUYER A
    IF v_buyer_a_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, phone, district_id, consent_share_details, updated_at)
        VALUES (v_buyer_a_id, 'buyer', 'Test Buyer Alpha', '9845011111', v_dist_bengaluru_urban, true, now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'buyer',
            full_name = 'Test Buyer Alpha',
            phone = '9845011111',
            district_id = v_dist_bengaluru_urban,
            consent_share_details = true,
            updated_at = now();
        RAISE NOTICE 'Configured Buyer A: %', v_buyer_a_email;
    END IF;

    -- 4. SETUP BUYER B
    IF v_buyer_b_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, phone, district_id, consent_share_details, updated_at)
        VALUES (v_buyer_b_id, 'buyer', 'Test Buyer Beta', '9845022222', v_dist_bengaluru_urban, true, now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'buyer',
            full_name = 'Test Buyer Beta',
            phone = '9845022222',
            district_id = v_dist_bengaluru_urban,
            consent_share_details = true,
            updated_at = now();
        RAISE NOTICE 'Configured Buyer B: %', v_buyer_b_email;
    END IF;

    -- 5. SETUP DEALER A (Bengaluru Urban - Tata Motors & Mahindra)
    IF v_dealer_a_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, phone, district_id, consent_share_details, updated_at)
        VALUES (v_dealer_a_id, 'dealer', 'Rajesh Rao (Apex Tata)', '9845033333', v_dist_bengaluru_urban, true, now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'dealer',
            full_name = 'Rajesh Rao (Apex Tata)',
            phone = '9845033333',
            district_id = v_dist_bengaluru_urban,
            updated_at = now();

        -- Provision & Verify Dealership A
        INSERT INTO public.dealerships (
            id, name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts, verified_at, updated_at
        ) VALUES (
            v_dealership_a_id,
            'Apex Motors Bengaluru',
            'VERIFIED',
            '100 Feet Ring Road, Indiranagar, Bengaluru',
            v_dist_bengaluru_urban,
            '9845033333',
            v_dealer_a_email,
            '29AAAAA1111A1Z1',
            ARRAY['Tata Motors', 'Mahindra'],
            ARRAY[v_dist_bengaluru_urban],
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            status = 'VERIFIED',
            name = 'Apex Motors Bengaluru',
            brands = ARRAY['Tata Motors', 'Mahindra'],
            districts = ARRAY[v_dist_bengaluru_urban],
            verified_at = now(),
            updated_at = now();

        -- Link dealer A as owner
        INSERT INTO public.dealer_users (dealership_id, user_id, role)
        VALUES (v_dealership_a_id, v_dealer_a_id, 'owner')
        ON CONFLICT (dealership_id, user_id) DO UPDATE SET role = 'owner';

        RAISE NOTICE 'Configured & Verified Dealer A: %', v_dealer_a_email;
    END IF;

    -- 6. SETUP DEALER B (Bengaluru Rural - Hyundai & Kia)
    IF v_dealer_b_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, phone, district_id, consent_share_details, updated_at)
        VALUES (v_dealer_b_id, 'dealer', 'Suresh Kumar (Premier Hyundai)', '9845044444', v_dist_bengaluru_rural, true, now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'dealer',
            full_name = 'Suresh Kumar (Premier Hyundai)',
            phone = '9845044444',
            district_id = v_dist_bengaluru_rural,
            updated_at = now();

        -- Provision & Verify Dealership B
        INSERT INTO public.dealerships (
            id, name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts, verified_at, updated_at
        ) VALUES (
            v_dealership_b_id,
            'Premier Motors Rural',
            'VERIFIED',
            'NH 44, Devanahalli Highway, Bengaluru Rural',
            v_dist_bengaluru_rural,
            '9845044444',
            v_dealer_b_email,
            '29BBBBB2222B2Z2',
            ARRAY['Hyundai', 'Kia'],
            ARRAY[v_dist_bengaluru_rural],
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            status = 'VERIFIED',
            name = 'Premier Motors Rural',
            brands = ARRAY['Hyundai', 'Kia'],
            districts = ARRAY[v_dist_bengaluru_rural],
            verified_at = now(),
            updated_at = now();

        -- Link dealer B as owner
        INSERT INTO public.dealer_users (dealership_id, user_id, role)
        VALUES (v_dealership_b_id, v_dealer_b_id, 'owner')
        ON CONFLICT (dealership_id, user_id) DO UPDATE SET role = 'owner';

        RAISE NOTICE 'Configured & Verified Dealer B: %', v_dealer_b_email;
    END IF;

    -- 7. SETUP PLATFORM ADMIN
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, full_name, phone, district_id, consent_share_details, updated_at)
        VALUES (v_admin_id, 'admin', 'AutoGroup Platform Administrator', '9845099999', v_dist_bengaluru_urban, true, now())
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            full_name = 'AutoGroup Platform Administrator',
            updated_at = now();
        RAISE NOTICE 'Configured Admin Account: %', v_admin_email;
    END IF;

    RAISE NOTICE 'Test setup execution finished safely.';
END $$;
