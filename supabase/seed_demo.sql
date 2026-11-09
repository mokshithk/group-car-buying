-- supabase/seed_demo.sql
-- Optional Test / Demo Data for Group Car Buying Platform
-- Contains sample dealerships, groups with visibility edge cases, quotations, and offers
-- Re-runnable: all inserts use ON CONFLICT DO NOTHING with valid hex UUIDs

-- 1. DEMO DEALERSHIPS (Valid hex IDs: e1111111-...)
INSERT INTO public.dealerships (id, name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts) VALUES
    (
        'e1111111-1111-1111-1111-111111111101',
        'Apex Motors (Bengaluru)',
        'VERIFIED',
        '45 Outer Ring Road, Marathahalli, Bengaluru - 560037',
        'd1111111-1111-1111-1111-111111111101',
        '+91 98450 11223',
        'contact@apexmotors-fake.com',
        '29AAAAA0000A1Z5',
        ARRAY['Tata Motors', 'Hyundai'],
        ARRAY['d1111111-1111-1111-1111-111111111101'::uuid, 'd1111111-1111-1111-1111-111111111102'::uuid]
    ),
    (
        'e1111111-1111-1111-1111-111111111102',
        'Southern Star Auto (Bengaluru)',
        'VERIFIED',
        '88 Hosur Main Road, Koramangala, Bengaluru - 560095',
        'd1111111-1111-1111-1111-111111111101',
        '+91 98450 44556',
        'sales@southernstar-fake.com',
        '29BBBBB0000B1Z6',
        ARRAY['Tata Motors', 'Mahindra', 'Volkswagen'],
        ARRAY['d1111111-1111-1111-1111-111111111101'::uuid]
    ),
    (
        'e1111111-1111-1111-1111-111111111103',
        'Metro Velocity Cars (Bengaluru)',
        'VERIFIED',
        '12 Bellary Road, Hebbal, Bengaluru - 560024',
        'd1111111-1111-1111-1111-111111111101',
        '+91 98450 77889',
        'info@metrovelocity-fake.com',
        '29CCCCC0000C1Z7',
        ARRAY['Hyundai', 'Kia'],
        ARRAY['d1111111-1111-1111-1111-111111111101'::uuid]
    ),
    (
        'e1111111-1111-1111-1111-111111111104',
        'Pioneer Wheelcraft (Pending Approval)',
        'PENDING',
        '201 Bannerghatta Road, Bengaluru - 560076',
        'd1111111-1111-1111-1111-111111111101',
        '+91 98450 99001',
        'owner@pioneerwheelcraft-fake.com',
        '29DDDDD0000D1Z8',
        ARRAY['Mahindra'],
        ARRAY['d1111111-1111-1111-1111-111111111101'::uuid]
    )
ON CONFLICT (id) DO NOTHING;

-- 2. DEMO GROUPS (Valid hex IDs: f1111111-...)
-- Group 1: 3 members -> Visible immediately to dealers
INSERT INTO public.groups (id, variant_id, district_id, target_members, status, created_at) VALUES
    (
        'f1111111-1111-1111-1111-111111111101',
        'c1111111-1111-1111-1111-111111111102', -- Nexon Creative Plus DCA
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'OPEN_FOR_QUOTES',
        now() - INTERVAL '5 days'
    ),
    -- Group 2: 2 members, created 25 days ago (> 20 days) -> Visible by 20-day rule
    (
        'f1111111-1111-1111-1111-111111111102',
        'c1111111-1111-1111-1111-111111111105', -- Creta SX(O) Turbo DCT
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'OPEN_FOR_QUOTES',
        now() - INTERVAL '25 days'
    ),
    -- Group 3: 2 members, created 2 days ago (< 20 days) -> NOT YET VISIBLE (Waiting text shown)
    (
        'f1111111-1111-1111-1111-111111111103',
        'c1111111-1111-1111-1111-111111111107', -- XUV700 AX5
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'FORMING',
        now() - INTERVAL '2 days'
    ),
    -- Group 4: 1 member -> NEVER visible to dealers
    (
        'f1111111-1111-1111-1111-111111111104',
        'c1111111-1111-1111-1111-111111111110', -- Virtus GT Plus DSG
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'FORMING',
        now() - INTERVAL '1 day'
    )
ON CONFLICT (id) DO NOTHING;

-- 3. DEMO QUOTATIONS ON GROUP 1 (Nexon) (Valid hex IDs: fa111111-...)
-- Dealership 1: Apex Motors (Valid, complete, competitive)
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'fa111111-1111-1111-1111-111111111101',
    'f1111111-1111-1111-1111-111111111101',
    'e1111111-1111-1111-1111-111111111101', -- Apex Motors
    1220000,
    44000,
    183000,
    35000,  -- discount
    12000,  -- accessories
    1424000, -- on road
    now() + INTERVAL '15 days',
    'Includes 3-year extended warranty and zero depreciation cover. Delivery within 21 days.',
    true
) ON CONFLICT (id) DO NOTHING;

-- Dealership 2: Southern Star Auto (Valid, complete, lowest on-road price)
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'fa111111-1111-1111-1111-111111111102',
    'f1111111-1111-1111-1111-111111111101',
    'e1111111-1111-1111-1111-111111111102', -- Southern Star
    1220000,
    42000,
    183000,
    45000,  -- discount
    8000,   -- accessories
    1408000, -- on road (Best price)
    now() + INTERVAL '20 days',
    'Special corporate group rate. Free basic accessories kit and fast-track delivery.',
    true
) ON CONFLICT (id) DO NOTHING;

-- Dealership 3: EXPIRED quote (validity in the past, greyed out & disabled)
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'fa111111-1111-1111-1111-111111111103',
    'f1111111-1111-1111-1111-111111111101',
    'e1111111-1111-1111-1111-111111111103', -- Metro Velocity
    1220000,
    46000,
    183000,
    20000,
    15000,
    1444000,
    now() - INTERVAL '5 days', -- EXPIRED
    'Previous festival promo pricing. Expired offer.',
    true
) ON CONFLICT (id) DO NOTHING;

-- INCOMPLETE QUOTE ON GROUP 2 (Missing mandatory registration & insurance estimates)
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'fa111111-1111-1111-1111-111111111104',
    'f1111111-1111-1111-1111-111111111102',
    'e1111111-1111-1111-1111-111111111101', -- Apex Motors
    2000000,
    0, -- Missing insurance
    0, -- Missing registration
    50000,
    0,
    1950000, -- incomplete on road
    now() + INTERVAL '10 days',
    'Estimated ex-showroom only; insurance and RTO charges to be added upon registration.',
    false -- INCOMPLETE: excluded from best price & savings calculations
) ON CONFLICT (id) DO NOTHING;
