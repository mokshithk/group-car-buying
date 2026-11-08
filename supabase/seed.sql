-- supabase/seed.sql
-- Seed Data for Group Car Buying Platform

-- 1. DISTRICTS (15 districts across Karnataka, Maharashtra, Tamil Nadu, Delhi NCR, Telangana)
INSERT INTO public.districts (id, name, state, code) VALUES
    ('d1111111-1111-1111-1111-111111111101', 'Bengaluru Urban', 'Karnataka', 'KA-01'),
    ('d1111111-1111-1111-1111-111111111102', 'Bengaluru Rural', 'Karnataka', 'KA-02'),
    ('d1111111-1111-1111-1111-111111111103', 'Mysuru', 'Karnataka', 'KA-09'),
    ('d1111111-1111-1111-1111-111111111104', 'Dakshina Kannada', 'Karnataka', 'KA-19'),
    ('d1111111-1111-1111-1111-111111111105', 'Mumbai City', 'Maharashtra', 'MH-01'),
    ('d1111111-1111-1111-1111-111111111106', 'Pune', 'Maharashtra', 'MH-12'),
    ('d1111111-1111-1111-1111-111111111107', 'Thane', 'Maharashtra', 'MH-04'),
    ('d1111111-1111-1111-1111-111111111108', 'Chennai', 'Tamil Nadu', 'TN-01'),
    ('d1111111-1111-1111-1111-111111111109', 'Coimbatore', 'Tamil Nadu', 'TN-38'),
    ('d1111111-1111-1111-1111-111111111110', 'Hyderabad', 'Telangana', 'TS-09'),
    ('d1111111-1111-1111-1111-111111111111', 'Central Delhi', 'Delhi', 'DL-01'),
    ('d1111111-1111-1111-1111-111111111112', 'Gurugram', 'Haryana', 'HR-26'),
    ('d1111111-1111-1111-1111-111111111113', 'Gautam Buddha Nagar', 'Uttar Pradesh', 'UP-16'),
    ('d1111111-1111-1111-1111-111111111114', 'Ahmedabad', 'Gujarat', 'GJ-01'),
    ('d1111111-1111-1111-1111-111111111115', 'Ernakulam', 'Kerala', 'KL-07')
ON CONFLICT (code) DO NOTHING;

-- 2. MANUFACTURERS
INSERT INTO public.manufacturers (id, name, logo_url) VALUES
    ('m1111111-1111-1111-1111-111111111101', 'Tata Motors', '/brands/tata.svg'),
    ('m1111111-1111-1111-1111-111111111102', 'Hyundai', '/brands/hyundai.svg'),
    ('m1111111-1111-1111-1111-111111111103', 'Mahindra', '/brands/mahindra.svg'),
    ('m1111111-1111-1111-1111-111111111104', 'Maruti Suzuki', '/brands/maruti.svg'),
    ('m1111111-1111-1111-1111-111111111105', 'Kia', '/brands/kia.svg'),
    ('m1111111-1111-1111-1111-111111111106', 'Toyota', '/brands/toyota.svg'),
    ('m1111111-1111-1111-1111-111111111107', 'Volkswagen', '/brands/vw.svg'),
    ('m1111111-1111-1111-1111-111111111108', 'Skoda', '/brands/skoda.svg'),
    ('m1111111-1111-1111-1111-111111111109', 'Honda', '/brands/honda.svg'),
    ('m1111111-1111-1111-1111-111111111110', 'MG', '/brands/mg.svg')
ON CONFLICT (name) DO NOTHING;

-- 3. MODELS (12 Models)
INSERT INTO public.models (id, manufacturer_id, name, body_type, fuel_types, starting_price) VALUES
    ('c1111111-1111-1111-1111-111111111101', 'm1111111-1111-1111-1111-111111111101', 'Tata Nexon', 'SUV', ARRAY['Petrol', 'Diesel', 'Electric'], 799000),
    ('c1111111-1111-1111-1111-111111111102', 'm1111111-1111-1111-1111-111111111101', 'Tata Harrier', 'SUV', ARRAY['Diesel'], 1499000),
    ('c1111111-1111-1111-1111-111111111103', 'm1111111-1111-1111-1111-111111111102', 'Hyundai Creta', 'SUV', ARRAY['Petrol', 'Diesel'], 1099000),
    ('c1111111-1111-1111-1111-111111111104', 'm1111111-1111-1111-1111-111111111102', 'Hyundai Verna', 'Sedan', ARRAY['Petrol'], 1100000),
    ('c1111111-1111-1111-1111-111111111105', 'm1111111-1111-1111-1111-111111111103', 'Mahindra XUV700', 'SUV', ARRAY['Petrol', 'Diesel'], 1399000),
    ('c1111111-1111-1111-1111-111111111106', 'm1111111-1111-1111-1111-111111111103', 'Mahindra Scorpio-N', 'SUV', ARRAY['Petrol', 'Diesel'], 1360000),
    ('c1111111-1111-1111-1111-111111111107', 'm1111111-1111-1111-1111-111111111104', 'Maruti Grand Vitara', 'SUV', ARRAY['Petrol', 'Hybrid', 'CNG'], 1080000),
    ('c1111111-1111-1111-1111-111111111108', 'm1111111-1111-1111-1111-111111111104', 'Maruti Baleno', 'Hatchback', ARRAY['Petrol', 'CNG'], 666000),
    ('c1111111-1111-1111-1111-111111111109', 'm1111111-1111-1111-1111-111111111105', 'Kia Seltos', 'SUV', ARRAY['Petrol', 'Diesel'], 1090000),
    ('c1111111-1111-1111-1111-111111111110', 'm1111111-1111-1111-1111-111111111106', 'Toyota Hyryder', 'SUV', ARRAY['Petrol', 'Hybrid'], 1114000),
    ('c1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111107', 'Volkswagen Virtus', 'Sedan', ARRAY['Petrol'], 1156000),
    ('c1111111-1111-1111-1111-111111111112', 'm1111111-1111-1111-1111-111111111108', 'Skoda Slavia', 'Sedan', ARRAY['Petrol'], 1163000)
ON CONFLICT (id) DO NOTHING;

-- 4. VARIANTS (3 variants per model)
INSERT INTO public.variants (id, model_id, name, transmission, fuel_type, engine_cc, ex_showroom_price, features) VALUES
    -- Tata Nexon Variants
    ('v1111111-1111-1111-1111-111111111101', 'c1111111-1111-1111-1111-111111111101', 'Smart (O) 1.2 Petrol', 'Manual', 'Petrol', 1199, 799000, ARRAY['LED DRLs', '6 Airbags', 'ESP', 'Drive Modes']),
    ('v1111111-1111-1111-1111-111111111102', 'c1111111-1111-1111-1111-111111111101', 'Creative Plus 1.2 Petrol DCA', 'DCT', 'Petrol', 1199, 1220000, ARRAY['10.25-inch Touchscreen', '360 Camera', 'Wireless CarPlay', 'Ventilated Seats']),
    ('v1111111-1111-1111-1111-111111111103', 'c1111111-1111-1111-1111-111111111101', 'Fearless Plus S 1.5 Diesel', 'Manual', 'Diesel', 1497, 1490000, ARRAY['Sunroof', 'JBL Audio', 'Air Purifier', 'Connected Car Tech']),
    
    -- Hyundai Creta Variants
    ('v1111111-1111-1111-1111-111111111104', 'c1111111-1111-1111-1111-111111111103', 'EX 1.5 Petrol', 'Manual', 'Petrol', 1497, 1221000, ARRAY['8-inch Touchscreen', 'Steering Controls', 'Rear AC Vents']),
    ('v1111111-1111-1111-1111-111111111105', 'c1111111-1111-1111-1111-111111111103', 'SX (O) 1.5 Turbo Petrol DCT', 'DCT', 'Petrol', 1482, 2000000, ARRAY['Level 2 ADAS', 'Panoramic Sunroof', 'Bose 8-speaker Audio', 'Ventilated Seats']),
    ('v1111111-1111-1111-1111-111111111106', 'c1111111-1111-1111-1111-111111111103', 'SX 1.5 Diesel AT', 'Automatic', 'Diesel', 1493, 1900000, ARRAY['Electric Driver Seat', 'BlueLink', 'Dual Zone Climate']),

    -- Mahindra XUV700 Variants
    ('v1111111-1111-1111-1111-111111111107', 'c1111111-1111-1111-1111-111111111105', 'AX5 2.0 Petrol MT 7-Str', 'Manual', 'Petrol', 1999, 1749000, ARRAY['Skyroof', 'Dual 10.25 HD Screens', 'Curtain Airbags']),
    ('v1111111-1111-1111-1111-111111111108', 'c1111111-1111-1111-1111-111111111105', 'AX7 L 2.2 Diesel AT AWD', 'Automatic', 'Diesel', 2184, 2699000, ARRAY['ADAS L2', 'Sony 12-Speaker 3D Sound', 'Blind View Monitor', 'AWD']),

    -- Volkswagen Virtus Variants
    ('v1111111-1111-1111-1111-111111111109', 'c1111111-1111-1111-1111-111111111111', 'Highline 1.0 TSI MT', 'Manual', 'Petrol', 999, 1338000, ARRAY['Wireless App Connect', 'Rear Camera', 'Cruise Control']),
    ('v1111111-1111-1111-1111-111111111110', 'c1111111-1111-1111-1111-111111111111', 'GT Plus 1.5 TSI DSG', 'DCT', 'Petrol', 1498, 1940000, ARRAY['1.5 EVO Engine with ACT', 'Digital Cockpit', 'Red Ambient Lighting', 'Sunroof'])
ON CONFLICT (id) DO NOTHING;

-- 5. TEST DEALERSHIPS (Clearly fake dealerships)
INSERT INTO public.dealerships (id, name, status, address, district_id, contact_phone, contact_email, gst_number, brands, districts) VALUES
    (
        'dl111111-1111-1111-1111-111111111101',
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
        'dl111111-1111-1111-1111-111111111102',
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
        'dl111111-1111-1111-1111-111111111103',
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
        'dl111111-1111-1111-1111-111111111104',
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

-- 6. GROUPS WITH MULTIPLE VISIBILITY SCENARIOS
-- Group 1: 3 members -> Visible immediately to dealers!
INSERT INTO public.groups (id, variant_id, district_id, target_members, status, created_at) VALUES
    (
        'g1111111-1111-1111-1111-111111111101',
        'v1111111-1111-1111-1111-111111111102', -- Nexon Creative Plus DCA
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'OPEN_FOR_QUOTES',
        now() - INTERVAL '5 days'
    ),
    -- Group 2: 2 members, created 25 days ago (> 20 days) -> Visible by 20-day rule!
    (
        'g1111111-1111-1111-1111-111111111102',
        'v1111111-1111-1111-1111-111111111105', -- Creta SX(O) Turbo DCT
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'OPEN_FOR_QUOTES',
        now() - INTERVAL '25 days'
    ),
    -- Group 3: 2 members, created 2 days ago (< 20 days) -> NOT YET VISIBLE (Waiting text shown)
    (
        'g1111111-1111-1111-1111-111111111103',
        'v1111111-1111-1111-1111-111111111107', -- XUV700 AX5
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'FORMING',
        now() - INTERVAL '2 days'
    ),
    -- Group 4: 1 member -> NEVER visible to dealers
    (
        'g1111111-1111-1111-1111-111111111104',
        'v1111111-1111-1111-1111-111111111110', -- Virtus GT Plus DSG
        'd1111111-1111-1111-1111-111111111101', -- Bengaluru Urban
        10,
        'FORMING',
        now() - INTERVAL '1 day'
    )
ON CONFLICT (id) DO NOTHING;

-- 7. QUOTATIONS ON GROUP 1 (Nexon)
-- Dealership 1: Apex Motors (Valid, complete, competitive)
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'q1111111-1111-1111-1111-111111111101',
    'g1111111-1111-1111-1111-111111111101',
    'dl111111-1111-1111-1111-111111111101', -- Apex Motors
    1220000,
    44000,
    183000,
    35000,  -- discount
    12000,  -- accessories
    1424000, -- on road
    now() + INTERVAL '15 days',
    'Includes 3-year extended warranty and zero depreciation cover. Delivery within 21 days.',
    true
) ON CONFLICT (group_id, dealership_id) DO NOTHING;

-- Dealership 2: Southern Star Auto (Valid, complete, slightly lower price)
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'q1111111-1111-1111-1111-111111111102',
    'g1111111-1111-1111-1111-111111111101',
    'dl111111-1111-1111-1111-111111111102', -- Southern Star
    1220000,
    42000,
    183000,
    45000,  -- discount
    8000,   -- accessories
    1408000, -- on road (Best price)
    now() + INTERVAL '20 days',
    'Special corporate group rate. Free basic accessories kit and fast-track delivery.',
    true
) ON CONFLICT (group_id, dealership_id) DO NOTHING;

-- Dealership 3: EXPIRED quote (validity in the past, must be greyed out & disabled)
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'q1111111-1111-1111-1111-111111111103',
    'g1111111-1111-1111-1111-111111111101',
    'dl111111-1111-1111-1111-111111111103', -- Metro Velocity
    1220000,
    46000,
    183000,
    20000,
    15000,
    1444000,
    now() - INTERVAL '5 days', -- EXPIRED!
    'Previous festival promo pricing. Expired offer.',
    true
) ON CONFLICT (group_id, dealership_id) DO NOTHING;

-- INCOMPLETE QUOTE ON GROUP 2 (Missing mandatory registration & insurance estimates)
-- Must be flagged and EXCLUDED from "lowest price" and savings calculation
INSERT INTO public.quotations (
    id, group_id, dealership_id, ex_showroom_price, insurance, registration_charges,
    discounts, accessories_extras, on_road_price, validity_date, terms, is_complete
) VALUES (
    'q1111111-1111-1111-1111-111111111104',
    'g1111111-1111-1111-1111-111111111102',
    'dl111111-1111-1111-1111-111111111101', -- Apex Motors
    2000000,
    0, -- Missing insurance
    0, -- Missing registration
    50000,
    0,
    1950000, -- incomplete on road
    now() + INTERVAL '10 days',
    'Estimated ex-showroom only; insurance and RTO charges to be added upon registration.',
    false -- INCOMPLETE!
) ON CONFLICT (group_id, dealership_id) DO NOTHING;
