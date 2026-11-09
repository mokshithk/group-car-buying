-- supabase/seed.sql
-- Real Car Catalog & Districts for Group Car Buying Platform
-- Re-runnable: all inserts use ON CONFLICT DO NOTHING

-- 1. DISTRICTS (15 districts across Karnataka, Maharashtra, Tamil Nadu, Delhi NCR, Telangana, Gujarat, Kerala)
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
ON CONFLICT (id) DO NOTHING;

-- 2. MANUFACTURERS (Valid hex IDs: a1111111-...)
INSERT INTO public.manufacturers (id, name, logo_url) VALUES
    ('a1111111-1111-1111-1111-111111111101', 'Tata Motors', '/brands/tata.svg'),
    ('a1111111-1111-1111-1111-111111111102', 'Hyundai', '/brands/hyundai.svg'),
    ('a1111111-1111-1111-1111-111111111103', 'Mahindra', '/brands/mahindra.svg'),
    ('a1111111-1111-1111-1111-111111111104', 'Maruti Suzuki', '/brands/maruti.svg'),
    ('a1111111-1111-1111-1111-111111111105', 'Kia', '/brands/kia.svg'),
    ('a1111111-1111-1111-1111-111111111106', 'Toyota', '/brands/toyota.svg'),
    ('a1111111-1111-1111-1111-111111111107', 'Volkswagen', '/brands/vw.svg'),
    ('a1111111-1111-1111-1111-111111111108', 'Skoda', '/brands/skoda.svg'),
    ('a1111111-1111-1111-1111-111111111109', 'Honda', '/brands/honda.svg'),
    ('a1111111-1111-1111-1111-111111111110', 'MG', '/brands/mg.svg')
ON CONFLICT (id) DO NOTHING;

-- 3. MODELS (Valid hex IDs: b1111111-...)
INSERT INTO public.models (id, manufacturer_id, name, body_type, fuel_types, starting_price) VALUES
    ('b1111111-1111-1111-1111-111111111101', 'a1111111-1111-1111-1111-111111111101', 'Tata Nexon', 'SUV', ARRAY['Petrol', 'Diesel', 'Electric'], 799000),
    ('b1111111-1111-1111-1111-111111111102', 'a1111111-1111-1111-1111-111111111101', 'Tata Harrier', 'SUV', ARRAY['Diesel'], 1499000),
    ('b1111111-1111-1111-1111-111111111103', 'a1111111-1111-1111-1111-111111111102', 'Hyundai Creta', 'SUV', ARRAY['Petrol', 'Diesel'], 1099000),
    ('b1111111-1111-1111-1111-111111111104', 'a1111111-1111-1111-1111-111111111102', 'Hyundai Verna', 'Sedan', ARRAY['Petrol'], 1100000),
    ('b1111111-1111-1111-1111-111111111105', 'a1111111-1111-1111-1111-111111111103', 'Mahindra XUV700', 'SUV', ARRAY['Petrol', 'Diesel'], 1399000),
    ('b1111111-1111-1111-1111-111111111106', 'a1111111-1111-1111-1111-111111111103', 'Mahindra Scorpio-N', 'SUV', ARRAY['Petrol', 'Diesel'], 1360000),
    ('b1111111-1111-1111-1111-111111111107', 'a1111111-1111-1111-1111-111111111104', 'Maruti Grand Vitara', 'SUV', ARRAY['Petrol', 'Hybrid', 'CNG'], 1080000),
    ('b1111111-1111-1111-1111-111111111108', 'a1111111-1111-1111-1111-111111111104', 'Maruti Baleno', 'Hatchback', ARRAY['Petrol', 'CNG'], 666000),
    ('b1111111-1111-1111-1111-111111111109', 'a1111111-1111-1111-1111-111111111105', 'Kia Seltos', 'SUV', ARRAY['Petrol', 'Diesel'], 1090000),
    ('b1111111-1111-1111-1111-111111111110', 'a1111111-1111-1111-1111-111111111106', 'Toyota Hyryder', 'SUV', ARRAY['Petrol', 'Hybrid'], 1114000),
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111107', 'Volkswagen Virtus', 'Sedan', ARRAY['Petrol'], 1156000),
    ('b1111111-1111-1111-1111-111111111112', 'a1111111-1111-1111-1111-111111111108', 'Skoda Slavia', 'Sedan', ARRAY['Petrol'], 1163000)
ON CONFLICT (id) DO NOTHING;

-- 4. VARIANTS (Valid hex IDs: c1111111-...)
INSERT INTO public.variants (id, model_id, name, transmission, fuel_type, engine_cc, ex_showroom_price, features) VALUES
    -- Tata Nexon Variants (Model: b1111111-...01)
    ('c1111111-1111-1111-1111-111111111101', 'b1111111-1111-1111-1111-111111111101', 'Smart (O) 1.2 Petrol', 'Manual', 'Petrol', 1199, 799000, ARRAY['LED DRLs', '6 Airbags', 'ESP', 'Drive Modes']),
    ('c1111111-1111-1111-1111-111111111102', 'b1111111-1111-1111-1111-111111111101', 'Creative Plus 1.2 Petrol DCA', 'DCT', 'Petrol', 1199, 1220000, ARRAY['10.25-inch Touchscreen', '360 Camera', 'Wireless CarPlay', 'Ventilated Seats']),
    ('c1111111-1111-1111-1111-111111111103', 'b1111111-1111-1111-1111-111111111101', 'Fearless Plus S 1.5 Diesel', 'Manual', 'Diesel', 1497, 1490000, ARRAY['Sunroof', 'JBL Audio', 'Air Purifier', 'Connected Car Tech']),
    
    -- Hyundai Creta Variants (Model: b1111111-...03)
    ('c1111111-1111-1111-1111-111111111104', 'b1111111-1111-1111-1111-111111111103', 'EX 1.5 Petrol', 'Manual', 'Petrol', 1497, 1221000, ARRAY['8-inch Touchscreen', 'Steering Controls', 'Rear AC Vents']),
    ('c1111111-1111-1111-1111-111111111105', 'b1111111-1111-1111-1111-111111111103', 'SX (O) 1.5 Turbo Petrol DCT', 'DCT', 'Petrol', 1482, 2000000, ARRAY['Level 2 ADAS', 'Panoramic Sunroof', 'Bose 8-speaker Audio', 'Ventilated Seats']),
    ('c1111111-1111-1111-1111-111111111106', 'b1111111-1111-1111-1111-111111111103', 'SX 1.5 Diesel AT', 'Automatic', 'Diesel', 1493, 1900000, ARRAY['Electric Driver Seat', 'BlueLink', 'Dual Zone Climate']),

    -- Mahindra XUV700 Variants (Model: b1111111-...05)
    ('c1111111-1111-1111-1111-111111111107', 'b1111111-1111-1111-1111-111111111105', 'AX5 2.0 Petrol MT 7-Str', 'Manual', 'Petrol', 1999, 1749000, ARRAY['Skyroof', 'Dual 10.25 HD Screens', 'Curtain Airbags']),
    ('c1111111-1111-1111-1111-111111111108', 'b1111111-1111-1111-1111-111111111105', 'AX7 L 2.2 Diesel AT AWD', 'Automatic', 'Diesel', 2184, 2699000, ARRAY['ADAS L2', 'Sony 12-Speaker 3D Sound', 'Blind View Monitor', 'AWD']),

    -- Volkswagen Virtus Variants (Model: b1111111-...11)
    ('c1111111-1111-1111-1111-111111111109', 'b1111111-1111-1111-1111-111111111111', 'Highline 1.0 TSI MT', 'Manual', 'Petrol', 999, 1338000, ARRAY['Wireless App Connect', 'Rear Camera', 'Cruise Control']),
    ('c1111111-1111-1111-1111-111111111110', 'b1111111-1111-1111-1111-111111111111', 'GT Plus 1.5 TSI DSG', 'DCT', 'Petrol', 1498, 1940000, ARRAY['1.5 EVO Engine with ACT', 'Digital Cockpit', 'Red Ambient Lighting', 'Sunroof'])
ON CONFLICT (id) DO NOTHING;
