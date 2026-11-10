-- 008_platform_integrity_and_fixes.sql
-- Comprehensive schema, RLS, trigger, RPC, and catalog completeness fixes across
-- Buyer, Dealer, and Admin modules. Safe & idempotent (BEGIN ... COMMIT).

BEGIN;

-- ==============================================================================
-- 1. CATALOG COMPLETENESS: Real variants for all remaining seeded models
--    (Only inserts when parent model exists in public.models; NO-OP on empty DB)
-- ==============================================================================

INSERT INTO public.variants (id, model_id, name, transmission, fuel_type, engine_cc, ex_showroom_price, features)
SELECT v.id, v.model_id, v.name, v.transmission, v.fuel_type, v.engine_cc, v.ex_showroom_price, v.features
FROM (
    VALUES
        -- Tata Harrier (b1111111-...02)
        ('c1111111-1111-1111-1111-111111111111'::uuid, 'b1111111-1111-1111-1111-111111111102'::uuid, 'Pure Plus 2.0 Diesel MT', 'Manual', 'Diesel', 1956, 1699000, ARRAY['10.25-inch Touchscreen', 'Rear View Camera', '6 Airbags']),
        ('c1111111-1111-1111-1111-111111111112'::uuid, 'b1111111-1111-1111-1111-111111111102'::uuid, 'Fearless Plus 2.0 Diesel AT', 'Automatic', 'Diesel', 1956, 2449000, ARRAY['ADAS L2', 'JBL 10-Speaker Audio', 'Panoramic Sunroof']),

        -- Hyundai Verna (b1111111-...04)
        ('c1111111-1111-1111-1111-111111111113'::uuid, 'b1111111-1111-1111-1111-111111111104'::uuid, 'SX 1.5 Petrol MT', 'Manual', 'Petrol', 1497, 1300000, ARRAY['Sunroof', 'Wireless Charger', 'Ambient Lighting']),
        ('c1111111-1111-1111-1111-111111111114'::uuid, 'b1111111-1111-1111-1111-111111111104'::uuid, 'SX (O) 1.5 Turbo Petrol DCT', 'DCT', 'Petrol', 1482, 1742000, ARRAY['ADAS L2', 'Heated & Ventilated Seats', 'Bose Audio']),

        -- Mahindra Scorpio-N (b1111111-...06)
        ('c1111111-1111-1111-1111-111111111115'::uuid, 'b1111111-1111-1111-1111-111111111106'::uuid, 'Z4 2.0 Petrol MT 7-Str', 'Manual', 'Petrol', 1997, 1525000, ARRAY['8-inch Touchscreen', 'Cruise Control', 'Rear AC']),
        ('c1111111-1111-1111-1111-111111111116'::uuid, 'b1111111-1111-1111-1111-111111111106'::uuid, 'Z8 L 2.2 Diesel AT 4WD', 'Automatic', 'Diesel', 2184, 2454000, ARRAY['4XPLOR Terrain Modes', 'Sony 12-Speaker Audio', 'Sunroof']),

        -- Maruti Grand Vitara (b1111111-...07)
        ('c1111111-1111-1111-1111-111111111117'::uuid, 'b1111111-1111-1111-1111-111111111107'::uuid, 'Delta 1.5 Smart Hybrid MT', 'Manual', 'Petrol', 1462, 1210000, ARRAY['Cruise Control', 'Auto Climate', 'Rear Camera']),
        ('c1111111-1111-1111-1111-111111111118'::uuid, 'b1111111-1111-1111-1111-111111111107'::uuid, 'Alpha Plus 1.5 Intelligent Electric Hybrid', 'CVT', 'Hybrid', 1490, 1993000, ARRAY['Strong Hybrid EV Mode', '360 Camera', 'HUD']),

        -- Maruti Baleno (b1111111-...08)
        ('c1111111-1111-1111-1111-111111111119'::uuid, 'b1111111-1111-1111-1111-111111111108'::uuid, 'Delta 1.2 Petrol MT', 'Manual', 'Petrol', 1197, 750000, ARRAY['7-inch SmartPlay Studio', 'Auto Climate', 'ESP']),
        ('c1111111-1111-1111-1111-111111111120'::uuid, 'b1111111-1111-1111-1111-111111111108'::uuid, 'Alpha 1.2 Petrol AMT', 'Automatic', 'Petrol', 1197, 988000, ARRAY['HUD Display', '360 Camera', '6 Airbags']),

        -- Kia Seltos (b1111111-...09)
        ('c1111111-1111-1111-1111-111111111121'::uuid, 'b1111111-1111-1111-1111-111111111109'::uuid, 'HTK Plus 1.5 Petrol iMT', 'iMT', 'Petrol', 1497, 1399000, ARRAY['Sunroof', 'Cruise Control', 'Keyless Entry']),
        ('c1111111-1111-1111-1111-111111111122'::uuid, 'b1111111-1111-1111-1111-111111111109'::uuid, 'GTX Plus 1.5 Diesel AT', 'Automatic', 'Diesel', 1493, 1999000, ARRAY['ADAS L2', 'Dual 10.25 Screens', 'Bose Audio']),

        -- Toyota Hyryder (b1111111-...10)
        ('c1111111-1111-1111-1111-111111111123'::uuid, 'b1111111-1111-1111-1111-111111111110'::uuid, 'S 1.5 NeoDrive AT', 'Automatic', 'Petrol', 1462, 1396000, ARRAY['Paddle Shifters', 'Cruise Control', 'Rear Camera']),
        ('c1111111-1111-1111-1111-111111111124'::uuid, 'b1111111-1111-1111-1111-111111111110'::uuid, 'V 1.5 Strong Hybrid e-Drive', 'CVT', 'Hybrid', 1490, 2019000, ARRAY['Panoramic Sunroof', '360 Camera', 'Ventilated Seats']),

        -- Skoda Slavia (b1111111-...12)
        ('c1111111-1111-1111-1111-111111111125'::uuid, 'b1111111-1111-1111-1111-111111111112'::uuid, 'Signature 1.0 TSI AT', 'Automatic', 'Petrol', 999, 1509000, ARRAY['5-Star GNCAP Safety', 'Cruise Control', '8-inch Touchscreen']),
        ('c1111111-1111-1111-1111-111111111126'::uuid, 'b1111111-1111-1111-1111-111111111112'::uuid, 'Prestige 1.5 TSI DSG', 'DCT', 'Petrol', 1498, 1869000, ARRAY['Active Cylinder Tech', 'Electric Sunroof', 'Subwoofer Audio'])
) AS v(id, model_id, name, transmission, fuel_type, engine_cc, ex_showroom_price, features)
WHERE EXISTS (SELECT 1 FROM public.models m WHERE m.id = v.model_id)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 2. FIX GROUP VISIBILITY RECURSION & CLOSED GROUP FILTERING
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_is_group_visible_to_dealers(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
    v_member_count INTEGER;
    v_created_at TIMESTAMPTZ;
    v_min_members INTEGER;
    v_visibility_days INTEGER;
    v_days_elapsed INTEGER;
BEGIN
    SELECT status, created_at INTO v_status, v_created_at
    FROM public.groups
    WHERE id = p_group_id;

    IF v_status IS NULL OR v_status NOT IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED') THEN
        RETURN false;
    END IF;

    SELECT COUNT(*) INTO v_member_count
    FROM public.group_members
    WHERE group_id = p_group_id AND status = 'ACTIVE';

    SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 3) INTO v_min_members
    FROM public.settings WHERE key = 'visibility_member_threshold';
    v_min_members := COALESCE(v_min_members, 3);

    IF v_member_count >= v_min_members THEN
        RETURN true;
    ELSIF v_member_count = 2 THEN
        SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 20) INTO v_visibility_days
        FROM public.settings WHERE key = 'group_visibility_days_for_2_members';
        v_visibility_days := COALESCE(v_visibility_days, 20);
        v_days_elapsed := EXTRACT(DAY FROM (now() - v_created_at));
        RETURN v_days_elapsed >= v_visibility_days;
    END IF;

    RETURN false;
END;
$$;

-- Fix group_members SELECT recursion & let dealers see groups they already quoted/booked
DROP POLICY IF EXISTS "View group members" ON public.group_members;
CREATE POLICY "View group members" ON public.group_members
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR user_id = auth.uid()
        OR (
            public.current_user_role() = 'buyer'
            AND group_id IN (SELECT id FROM public.groups WHERE district_id = public.current_user_district())
        )
        OR (
            public.is_dealer_verified()
            AND public.fn_is_group_visible_to_dealers(group_id)
        )
    );

DROP POLICY IF EXISTS "Verified dealers view eligible groups" ON public.groups;
CREATE POLICY "Verified dealers view eligible groups" ON public.groups
    FOR SELECT TO authenticated
    USING (
        (
            public.is_dealer_verified()
            AND status IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED')
            AND public.fn_is_group_visible_to_dealers(id)
            AND (
                district_id IN (
                    SELECT UNNEST(districts) FROM public.dealerships WHERE id = public.current_dealer_dealership_id()
                )
                OR district_id = (SELECT district_id FROM public.dealerships WHERE id = public.current_dealer_dealership_id())
            )
            AND variant_id IN (
                SELECT v.id
                FROM public.variants v
                JOIN public.models m ON v.model_id = m.id
                JOIN public.manufacturers mf ON m.manufacturer_id = mf.id
                WHERE mf.id::text = ANY(SELECT UNNEST(brands) FROM public.dealerships WHERE id = public.current_dealer_dealership_id())
                   OR mf.name = ANY(SELECT UNNEST(brands) FROM public.dealerships WHERE id = public.current_dealer_dealership_id())
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.quotations q
            WHERE q.group_id = groups.id AND q.dealership_id = public.current_dealer_dealership_id()
        )
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.group_id = groups.id AND b.dealership_id = public.current_dealer_dealership_id()
        )
    );

-- ==============================================================================
-- 3. FIX SECURITY HOLES ON PROFILES, DEALERSHIPS, DEALER_USERS, QUOTATIONS, QUOTE_ITEMS
-- ==============================================================================

-- Remove leftover permissive WITH CHECK (true) INSERT policies
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid() AND role = 'buyer');

DROP POLICY IF EXISTS "Dealers insert dealership" ON public.dealerships;
DROP POLICY IF EXISTS "Dealers insert self as owner on registration" ON public.dealer_users;
DROP POLICY IF EXISTS "Dealer owner insert dealer_users" ON public.dealer_users;

DROP POLICY IF EXISTS "Admin insert notifications" ON public.notifications;
CREATE POLICY "Admin insert notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- Enforce check_dealership_status_change across ALL columns (not only status)
DROP TRIGGER IF EXISTS trg_protect_dealership_status ON public.dealerships;
CREATE TRIGGER trg_protect_dealership_status
    BEFORE UPDATE ON public.dealerships
    FOR EACH ROW EXECUTE FUNCTION public.check_dealership_status_change();

-- Tighten quotation INSERT/UPDATE so dealers can only quote active, visible, matching groups
DROP POLICY IF EXISTS "Dealers insert own quote" ON public.quotations;
CREATE POLICY "Dealers insert own quote" ON public.quotations
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_dealer_verified()
        AND dealership_id = public.current_dealer_dealership_id()
        AND EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_id
              AND g.status IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED')
              AND public.fn_is_group_visible_to_dealers(g.id)
        )
    );

DROP POLICY IF EXISTS "Dealers update own quote" ON public.quotations;
CREATE POLICY "Dealers update own quote" ON public.quotations
    FOR UPDATE TO authenticated
    USING (
        public.is_dealer_verified()
        AND dealership_id = public.current_dealer_dealership_id()
        AND is_active = true
        AND EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_id
              AND g.status IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED')
        )
    )
    WITH CHECK (
        dealership_id = public.current_dealer_dealership_id()
    );

-- Fix public.quote_items (previously RLS enabled with 0 policies)
DROP POLICY IF EXISTS "Read visible quote items" ON public.quote_items;
CREATE POLICY "Read visible quote items" ON public.quote_items
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR quotation_id IN (SELECT id FROM public.quotations)
    );

DROP POLICY IF EXISTS "Dealers manage own quote items" ON public.quote_items;
CREATE POLICY "Dealers manage own quote items" ON public.quote_items
    FOR ALL TO authenticated
    USING (
        public.is_dealer_verified()
        AND quotation_id IN (
            SELECT id FROM public.quotations WHERE dealership_id = public.current_dealer_dealership_id()
        )
    )
    WITH CHECK (
        public.is_dealer_verified()
        AND quotation_id IN (
            SELECT id FROM public.quotations WHERE dealership_id = public.current_dealer_dealership_id()
        )
    );

-- ==============================================================================
-- 4. FIX QUOTATION VERSIONING TRIGGER & BOOKING AUTO-REMOVE TRIGGER (SECURITY DEFINER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trg_quotation_versioning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next_version INTEGER;
    v_buyer RECORD;
    v_dealership_name TEXT;
    v_variant_name TEXT;
    v_should_log_version BOOLEAN := false;
    v_price_changed BOOLEAN := false;
BEGIN
    SELECT name INTO v_dealership_name FROM public.dealerships WHERE id = NEW.dealership_id;
    SELECT v.name INTO v_variant_name
    FROM public.groups g
    JOIN public.variants v ON g.variant_id = v.id
    WHERE g.id = NEW.group_id;

    IF TG_OP = 'UPDATE' THEN
        v_price_changed :=
            (OLD.on_road_price IS DISTINCT FROM NEW.on_road_price)
            OR (OLD.is_complete IS DISTINCT FROM NEW.is_complete)
            OR (OLD.ex_showroom_price IS DISTINCT FROM NEW.ex_showroom_price)
            OR (OLD.insurance IS DISTINCT FROM NEW.insurance)
            OR (OLD.registration_charges IS DISTINCT FROM NEW.registration_charges)
            OR (OLD.discounts IS DISTINCT FROM NEW.discounts)
            OR (OLD.accessories_extras IS DISTINCT FROM NEW.accessories_extras);

        v_should_log_version :=
            v_price_changed
            OR (OLD.terms IS DISTINCT FROM NEW.terms)
            OR (OLD.validity_date IS DISTINCT FROM NEW.validity_date);

        IF v_should_log_version THEN
            SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
            FROM public.quotation_versions
            WHERE quotation_id = NEW.id;

            INSERT INTO public.quotation_versions (
                quotation_id, dealership_id, on_road_price, price_breakdown, changed_at, version_number
            ) VALUES (
                NEW.id,
                NEW.dealership_id,
                NEW.on_road_price,
                jsonb_build_object(
                    'ex_showroom_price', NEW.ex_showroom_price,
                    'insurance', NEW.insurance,
                    'registration_charges', NEW.registration_charges,
                    'discounts', NEW.discounts,
                    'accessories_extras', NEW.accessories_extras
                ),
                now(),
                v_next_version
            );

            IF v_price_changed THEN
                FOR v_buyer IN
                    SELECT user_id FROM public.group_members
                    WHERE group_id = NEW.group_id AND status = 'ACTIVE'
                LOOP
                    INSERT INTO public.notifications (user_id, title, message, type, link_url)
                    VALUES (
                        v_buyer.user_id,
                        'Quotation Updated',
                        COALESCE(v_dealership_name, 'A dealer') || ' updated their on-road quote for ' || COALESCE(v_variant_name, 'your car'),
                        'PRICE_CHANGE',
                        '/buyer/groups/' || NEW.group_id || '/offers'
                    );
                END LOOP;
            END IF;
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.quotation_versions (
            quotation_id, dealership_id, on_road_price, price_breakdown, changed_at, version_number
        ) VALUES (
            NEW.id,
            NEW.dealership_id,
            NEW.on_road_price,
            jsonb_build_object(
                'ex_showroom_price', NEW.ex_showroom_price,
                'insurance', NEW.insurance,
                'registration_charges', NEW.registration_charges,
                'discounts', NEW.discounts,
                'accessories_extras', NEW.accessories_extras
            ),
            now(),
            1
        );

        FOR v_buyer IN
            SELECT user_id FROM public.group_members
            WHERE group_id = NEW.group_id AND status = 'ACTIVE'
        LOOP
            INSERT INTO public.notifications (user_id, title, message, type, link_url)
            VALUES (
                v_buyer.user_id,
                'New Quotation Received',
                COALESCE(v_dealership_name, 'A verified dealer') || ' submitted an offer for ' || COALESCE(v_variant_name, 'your buying group'),
                'PRICE_CHANGE',
                '/buyer/groups/' || NEW.group_id || '/offers'
            );
        END LOOP;
    END IF;

    -- Advance active group to OFFERS_RECEIVED once an active quotation is saved
    IF NEW.is_active = true THEN
        UPDATE public.groups
        SET status = 'OFFERS_RECEIVED', updated_at = now()
        WHERE id = NEW.group_id AND status IN ('FORMING', 'OPEN_FOR_QUOTES');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_after_save ON public.quotations;
CREATE TRIGGER trg_quotations_after_save
    AFTER INSERT OR UPDATE ON public.quotations
    FOR EACH ROW EXECUTE FUNCTION public.trg_quotation_versioning();

CREATE OR REPLACE FUNCTION public.trg_booking_auto_remove_from_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_was_creator BOOLEAN := false;
    v_next_member RECORD;
    v_dealer RECORD;
BEGIN
    IF NEW.status = 'PAID' AND (OLD.status IS NULL OR OLD.status <> 'PAID') THEN
        IF NEW.group_id IS NOT NULL THEN
            SELECT is_creator INTO v_was_creator
            FROM public.group_members
            WHERE group_id = NEW.group_id AND user_id = NEW.buyer_id;

            UPDATE public.group_members
            SET status = 'BOOKED',
                is_creator = false,
                left_at = now()
            WHERE group_id = NEW.group_id AND user_id = NEW.buyer_id;

            IF COALESCE(v_was_creator, false) THEN
                SELECT id, user_id INTO v_next_member
                FROM public.group_members
                WHERE group_id = NEW.group_id AND status = 'ACTIVE'
                ORDER BY joined_at ASC
                LIMIT 1;

                IF v_next_member.id IS NOT NULL THEN
                    UPDATE public.group_members SET is_creator = true WHERE id = v_next_member.id;
                    UPDATE public.groups SET created_by = v_next_member.user_id, updated_at = now() WHERE id = NEW.group_id;
                END IF;
            END IF;
        END IF;

        -- Notify dealership staff/owners of confirmed booking
        FOR v_dealer IN SELECT user_id FROM public.dealer_users WHERE dealership_id = NEW.dealership_id LOOP
            INSERT INTO public.notifications (user_id, title, message, type, link_url)
            VALUES (
                v_dealer.user_id,
                'New Price-Locked Booking (' || NEW.booking_code || ')',
                NEW.buyer_name || ' paid the booking deposit and locked an on-road quote.',
                'NEW_BOOKING',
                '/dealer/bookings'
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_after_paid ON public.bookings;
CREATE TRIGGER trg_bookings_after_paid
    AFTER INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.trg_booking_auto_remove_from_group();

-- Protect bookings mutations by non-admins (enforce fallback days, prevent tampering)
CREATE OR REPLACE FUNCTION public.trg_guard_booking_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_internal BOOLEAN;
    v_is_admin BOOLEAN;
    v_fallback_days INTEGER;
    v_elapsed_days INTEGER;
BEGIN
    v_is_internal := (current_setting('autogroup.internal_rpc', true) = 'true') OR (auth.uid() IS NULL);
    v_is_admin := public.is_admin();

    IF v_is_internal OR v_is_admin THEN
        RETURN NEW;
    END IF;

    -- Prevent non-admin client edits to immutable financial fields
    IF (OLD.booking_amount IS DISTINCT FROM NEW.booking_amount)
       OR (OLD.platform_fee IS DISTINCT FROM NEW.platform_fee)
       OR (OLD.total_amount IS DISTINCT FROM NEW.total_amount)
       OR (OLD.price_snapshot IS DISTINCT FROM NEW.price_snapshot)
       OR (OLD.buyer_id IS DISTINCT FROM NEW.buyer_id)
       OR (OLD.dealership_id IS DISTINCT FROM NEW.dealership_id) THEN
        RAISE EXCEPTION 'Protected booking financial fields cannot be modified directly.';
    END IF;

    -- Enforce dealer 14-day fallback delivery rule when caller is not the buyer
    IF NEW.status = 'DELIVERED' AND OLD.status <> 'DELIVERED' AND auth.uid() <> OLD.buyer_id THEN
        SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 14) INTO v_fallback_days
        FROM public.settings WHERE key = 'dealer_delivery_fallback_days';
        v_fallback_days := COALESCE(v_fallback_days, 14);
        v_elapsed_days := EXTRACT(DAY FROM (now() - OLD.created_at));
        IF v_elapsed_days < v_fallback_days THEN
            RAISE EXCEPTION 'Dealership fallback delivery requires at least % days after booking (currently % days).', v_fallback_days, v_elapsed_days;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_updates ON public.bookings;
CREATE TRIGGER trg_guard_booking_updates
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.trg_guard_booking_updates();

-- ==============================================================================
-- 5. PRIVACY & AGGREGATION + ATOMIC BUYER/DEALER RPCS
-- ==============================================================================

-- 5.1 Redacted group member list (FirstName L.) so fellow buyers see formatted names cleanly without email/phone leaks
CREATE OR REPLACE FUNCTION public.get_group_member_summaries(p_group_id UUID)
RETURNS TABLE (
    id UUID,
    group_id UUID,
    user_id UUID,
    is_creator BOOLEAN,
    status TEXT,
    joined_at TIMESTAMPTZ,
    display_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group RECORD;
    v_allowed BOOLEAN := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO v_group FROM public.groups g WHERE g.id = p_group_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_allowed := public.is_admin()
        OR (public.current_user_role() = 'buyer' AND v_group.district_id = public.current_user_district())
        OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = p_group_id AND gm.user_id = auth.uid())
        OR (public.is_dealer_verified() AND public.fn_is_group_visible_to_dealers(p_group_id));

    IF NOT v_allowed THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        gm.id,
        gm.group_id,
        gm.user_id,
        gm.is_creator,
        gm.status,
        gm.joined_at,
        CASE
            WHEN NULLIF(TRIM(p.full_name), '') IS NULL THEN 'Buyer'
            WHEN array_length(regexp_split_to_array(TRIM(p.full_name), '\s+'), 1) > 1 THEN
                split_part(TRIM(p.full_name), ' ', 1) || ' ' ||
                UPPER(LEFT((regexp_split_to_array(TRIM(p.full_name), '\s+'))[array_length(regexp_split_to_array(TRIM(p.full_name), '\s+'), 1)], 1)) || '.'
            ELSE TRIM(p.full_name)
        END AS display_name
    FROM public.group_members gm
    JOIN public.profiles p ON p.id = gm.user_id
    WHERE gm.group_id = p_group_id
      AND gm.status = 'ACTIVE'
    ORDER BY gm.joined_at ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_group_member_summaries(UUID) TO authenticated;

-- 5.2 Accurate aggregate member & bookings count across all buyers (bypasses per-buyer bookings RLS without PII)
CREATE OR REPLACE FUNCTION public.get_group_public_metrics(p_group_ids UUID[])
RETURNS TABLE (
    group_id UUID,
    active_members INTEGER,
    bookings_so_far INTEGER,
    is_visible_to_dealers BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        g.id AS group_id,
        (SELECT COUNT(*)::INTEGER FROM public.group_members gm WHERE gm.group_id = g.id AND gm.status = 'ACTIVE') AS active_members,
        (SELECT COUNT(*)::INTEGER FROM public.bookings b WHERE b.group_id = g.id AND b.status IN ('PAID', 'DELIVERED')) AS bookings_so_far,
        public.fn_is_group_visible_to_dealers(g.id) AS is_visible_to_dealers
    FROM public.groups g
    WHERE g.id = ANY(p_group_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_group_public_metrics(UUID[]) TO anon, authenticated;

-- 5.3 Atomic Buyer Group Create / Join / Leave RPCs
CREATE OR REPLACE FUNCTION public.create_buying_group(
    p_variant_id UUID,
    p_district_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_district_id UUID;
    v_target INTEGER;
    v_existing_group_id UUID;
    v_new_group_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT role, district_id INTO v_role, v_district_id FROM public.profiles WHERE id = auth.uid();
    IF v_role <> 'buyer' THEN
        RAISE EXCEPTION 'Only buyer accounts can create buying groups.';
    END IF;

    IF v_district_id IS NULL THEN
        v_district_id := p_district_id;
    END IF;
    IF v_district_id IS NULL THEN
        RAISE EXCEPTION 'Please set a home district in your profile before creating a group.';
    END IF;
    IF p_district_id IS NOT NULL AND p_district_id <> v_district_id THEN
        RAISE EXCEPTION 'Groups can only be created in your registered district.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.variants WHERE id = p_variant_id AND COALESCE(is_active, true) = true) THEN
        RAISE EXCEPTION 'Selected car variant is unavailable.';
    END IF;

    SELECT g.id INTO v_existing_group_id
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = auth.uid()
      AND gm.status = 'ACTIVE'
      AND g.variant_id = p_variant_id
      AND g.status IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED')
    LIMIT 1;

    IF v_existing_group_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You are already an active member of a buying group for this exact car variant.',
            'existing_group_id', v_existing_group_id
        );
    END IF;

    SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 10) INTO v_target
    FROM public.settings WHERE key = 'default_group_target';
    v_target := GREATEST(1, COALESCE(v_target, 10));

    INSERT INTO public.groups (variant_id, district_id, target_members, status, created_by)
    VALUES (p_variant_id, v_district_id, v_target, 'FORMING', auth.uid())
    RETURNING id INTO v_new_group_id;

    INSERT INTO public.group_members (group_id, user_id, is_creator, status)
    VALUES (v_new_group_id, auth.uid(), true, 'ACTIVE');

    RETURN jsonb_build_object('success', true, 'group_id', v_new_group_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_buying_group(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_buying_group(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_user_district UUID;
    v_group RECORD;
    v_existing_row RECORD;
    v_conflict_group_id UUID;
    v_active_count INTEGER;
    v_min_members INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT role, district_id INTO v_role, v_user_district FROM public.profiles WHERE id = auth.uid();
    IF v_role <> 'buyer' THEN
        RAISE EXCEPTION 'Only buyer accounts can join buying groups.';
    END IF;

    SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Buying group not found.');
    END IF;

    IF v_group.status NOT IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'This buying group is already ' || LOWER(v_group.status) || ' and cannot accept new members.');
    END IF;

    IF v_user_district IS NOT NULL AND v_group.district_id <> v_user_district THEN
        RETURN jsonb_build_object('success', false, 'error', 'You can only join buying groups in your registered district.');
    END IF;

    SELECT * INTO v_existing_row FROM public.group_members WHERE group_id = p_group_id AND user_id = auth.uid();
    IF FOUND AND v_existing_row.status = 'BOOKED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already locked a booking from this buying group.');
    END IF;

    SELECT g.id INTO v_conflict_group_id
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = auth.uid()
      AND gm.status = 'ACTIVE'
      AND g.variant_id = v_group.variant_id
      AND g.id <> p_group_id
      AND g.status IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED')
    LIMIT 1;

    IF v_conflict_group_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already in an active buying group for this exact car variant.');
    END IF;

    INSERT INTO public.group_members (group_id, user_id, is_creator, status, joined_at, left_at)
    VALUES (p_group_id, auth.uid(), (v_group.created_by = auth.uid()), 'ACTIVE', now(), NULL)
    ON CONFLICT (group_id, user_id) DO UPDATE
    SET status = 'ACTIVE',
        is_creator = CASE WHEN public.group_members.is_creator OR v_group.created_by = auth.uid() THEN true ELSE false END,
        left_at = NULL;

    SELECT COUNT(*) INTO v_active_count FROM public.group_members WHERE group_id = p_group_id AND status = 'ACTIVE';
    SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 3) INTO v_min_members
    FROM public.settings WHERE key = 'visibility_member_threshold';
    v_min_members := COALESCE(v_min_members, 3);

    IF v_active_count >= v_min_members AND v_group.status = 'FORMING' THEN
        UPDATE public.groups SET status = 'OPEN_FOR_QUOTES', updated_at = now() WHERE id = p_group_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'active_count', v_active_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_buying_group(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_buying_group(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group RECORD;
    v_member RECORD;
    v_next RECORD;
    v_active_count INTEGER;
    v_min_members INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Buying group not found.');
    END IF;

    SELECT * INTO v_member FROM public.group_members WHERE group_id = p_group_id AND user_id = auth.uid();
    IF NOT FOUND OR v_member.status <> 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not an active member of this group.');
    END IF;

    UPDATE public.group_members
    SET status = 'LEFT',
        is_creator = false,
        left_at = now()
    WHERE id = v_member.id;

    IF v_member.is_creator OR v_group.created_by = auth.uid() THEN
        SELECT id, user_id INTO v_next
        FROM public.group_members
        WHERE group_id = p_group_id AND status = 'ACTIVE'
        ORDER BY joined_at ASC
        LIMIT 1;

        IF v_next.id IS NOT NULL THEN
            UPDATE public.group_members SET is_creator = true WHERE id = v_next.id;
            UPDATE public.groups SET created_by = v_next.user_id, updated_at = now() WHERE id = p_group_id;
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_active_count FROM public.group_members WHERE group_id = p_group_id AND status = 'ACTIVE';
    SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 3) INTO v_min_members
    FROM public.settings WHERE key = 'visibility_member_threshold';
    v_min_members := COALESCE(v_min_members, 3);

    IF v_active_count < v_min_members AND v_group.status = 'OPEN_FOR_QUOTES'
       AND NOT EXISTS (SELECT 1 FROM public.quotations WHERE group_id = p_group_id AND is_active = true) THEN
        UPDATE public.groups SET status = 'FORMING', updated_at = now() WHERE id = p_group_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'remaining_members', v_active_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.leave_buying_group(UUID) TO authenticated;

-- 5.4 Atomic Booking Cancellation & Delivery Confirmation RPCs
CREATE OR REPLACE FUNCTION public.cancel_booking_atomic(
    p_booking_id UUID,
    p_reason_type TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_b RECORD;
    v_is_buyer BOOLEAN := false;
    v_is_dealer BOOLEAN := false;
    v_refund_row RECORD;
    v_new_status TEXT;
    v_refund_reason TEXT;
    v_du RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.';
    END IF;

    v_is_buyer := (v_b.buyer_id = auth.uid());
    v_is_dealer := (v_b.dealership_id = public.current_dealer_dealership_id() AND public.is_dealer_verified());

    IF NOT v_is_buyer AND NOT v_is_dealer AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: you cannot cancel this booking.';
    END IF;

    IF v_b.status <> 'PAID' THEN
        RAISE EXCEPTION 'Only PAID bookings can be cancelled (current status: %).', v_b.status;
    END IF;

    IF UPPER(TRIM(p_reason_type)) = 'DEALER_FAULT' THEN
        IF NOT v_is_dealer AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only the dealership or an administrator can issue a dealer-fault cancellation.';
        END IF;
        v_refund_reason := 'DEALER_FAULT';
        v_new_status := 'CANCELLED_BY_DEALER';
    ELSE
        IF NOT v_is_buyer AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only the buyer can perform a buyer cancellation.';
        END IF;
        v_refund_reason := 'BUYER_CANCEL';
        v_new_status := 'CANCELLED_BY_BUYER';
    END IF;

    SELECT * INTO v_refund_row FROM public.fn_calculate_refund_amounts(p_booking_id, v_refund_reason);

    PERFORM set_config('autogroup.internal_rpc', 'true', true);

    UPDATE public.bookings
    SET status = v_new_status,
        cancellation_reason = COALESCE(NULLIF(TRIM(p_notes), ''), CASE WHEN v_refund_reason = 'DEALER_FAULT' THEN 'Cancelled by dealership' ELSE 'Cancelled by buyer' END),
        updated_at = now()
    WHERE id = p_booking_id;

    IF NOT EXISTS (SELECT 1 FROM public.refunds WHERE booking_id = p_booking_id) THEN
        INSERT INTO public.refunds (
            booking_id, reason, booking_amount_refunded, dealer_retained_amount, platform_fee_refunded, total_refunded, status
        ) VALUES (
            p_booking_id,
            v_refund_reason,
            v_refund_row.booking_amount_refunded,
            v_refund_row.dealer_retained_amount,
            v_refund_row.platform_fee_refunded,
            v_refund_row.total_refunded,
            'PROCESSED'
        );
    END IF;

    IF v_refund_reason = 'DEALER_FAULT' THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        VALUES (
            v_b.buyer_id,
            'Booking Cancelled by Dealership',
            'Booking ' || v_b.booking_code || ' was cancelled by the dealership. Total refund of ₹' || v_refund_row.total_refunded || ' processed.',
            'BOOKING_CANCELLED',
            '/buyer/bookings'
        );
    ELSE
        FOR v_du IN SELECT user_id FROM public.dealer_users WHERE dealership_id = v_b.dealership_id LOOP
            INSERT INTO public.notifications (user_id, title, message, type, link_url)
            VALUES (
                v_du.user_id,
                'Buyer Cancelled Booking (' || v_b.booking_code || ')',
                v_b.buyer_name || ' cancelled their booking. Showroom retention: ₹' || v_refund_row.dealer_retained_amount || '.',
                'BOOKING_CANCELLED',
                '/dealer/bookings'
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_new_status,
        'booking_amount_refunded', v_refund_row.booking_amount_refunded,
        'dealer_retained_amount', v_refund_row.dealer_retained_amount,
        'platform_fee_refunded', v_refund_row.platform_fee_refunded,
        'total_refunded', v_refund_row.total_refunded
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_booking_atomic(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_booking_delivery(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_b RECORD;
    v_is_buyer BOOLEAN;
    v_is_dealer BOOLEAN;
    v_fallback_days INTEGER;
    v_elapsed_days INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.';
    END IF;

    v_is_buyer := (v_b.buyer_id = auth.uid());
    v_is_dealer := (v_b.dealership_id = public.current_dealer_dealership_id() AND public.is_dealer_verified());

    IF NOT v_is_buyer AND NOT v_is_dealer THEN
        RAISE EXCEPTION 'Forbidden: you cannot confirm delivery for this booking.';
    END IF;

    IF v_b.status <> 'PAID' THEN
        RAISE EXCEPTION 'Only PAID bookings can be marked as DELIVERED.';
    END IF;

    IF NOT v_is_buyer AND v_is_dealer THEN
        SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 14) INTO v_fallback_days
        FROM public.settings WHERE key = 'dealer_delivery_fallback_days';
        v_fallback_days := COALESCE(v_fallback_days, 14);
        v_elapsed_days := EXTRACT(DAY FROM (now() - v_b.created_at));
        IF v_elapsed_days < v_fallback_days THEN
            RAISE EXCEPTION 'Dealership delivery fallback requires at least % days after booking (% days remaining).', v_fallback_days, GREATEST(1, v_fallback_days - v_elapsed_days);
        END IF;
    END IF;

    PERFORM set_config('autogroup.internal_rpc', 'true', true);
    UPDATE public.bookings
    SET status = 'DELIVERED',
        delivered_at = now(),
        updated_at = now()
    WHERE id = p_booking_id AND status = 'PAID';

    IF NOT v_is_buyer THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        VALUES (
            v_b.buyer_id,
            'Vehicle Delivery Recorded',
            'Dealership marked booking ' || v_b.booking_code || ' as delivered under the 14-day fallback policy.',
            'GENERAL',
            '/buyer/bookings'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'DELIVERED');
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_booking_delivery(UUID) TO authenticated;

-- 5.5 Dealer Staff RPCs (lets owners/staff view showroom team and lets owner add/remove staff securely)
CREATE OR REPLACE FUNCTION public.get_dealer_staff()
RETURNS TABLE (
    id UUID,
    dealership_id UUID,
    user_id UUID,
    role TEXT,
    created_at TIMESTAMPTZ,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    account_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_dealership_id UUID;
BEGIN
    v_dealership_id := public.current_dealer_dealership_id();
    IF v_dealership_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        du.id,
        du.dealership_id,
        du.user_id,
        du.role,
        du.created_at,
        p.full_name,
        COALESCE(NULLIF(p.email, ''), u.email) AS email,
        p.phone,
        COALESCE(p.status, 'ACTIVE') AS account_status
    FROM public.dealer_users du
    JOIN public.profiles p ON p.id = du.user_id
    LEFT JOIN auth.users u ON u.id = du.user_id
    WHERE du.dealership_id = v_dealership_id
    ORDER BY CASE WHEN du.role = 'owner' THEN 0 ELSE 1 END, du.created_at ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_dealer_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_dealer_staff(
    p_action TEXT,
    p_email TEXT DEFAULT NULL,
    p_dealer_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_dealership_id UUID;
    v_target_user RECORD;
    v_target_link RECORD;
BEGIN
    v_dealership_id := public.current_dealer_dealership_id();
    IF v_dealership_id IS NULL OR NOT public.is_dealer_owner_of(v_dealership_id) THEN
        RAISE EXCEPTION 'Forbidden: only the dealership owner can manage staff accounts.';
    END IF;

    p_action := UPPER(TRIM(p_action));

    IF p_action = 'ADD' THEN
        IF p_email IS NULL OR TRIM(p_email) = '' THEN
            RAISE EXCEPTION 'Colleague email address is required.';
        END IF;

        SELECT u.id, u.email, p.role AS profile_role
        INTO v_target_user
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE LOWER(u.email) = LOWER(TRIM(p_email))
        LIMIT 1;

        IF v_target_user.id IS NULL THEN
            RAISE EXCEPTION 'No registered user found for %. Ask your colleague to register first, then link them here.', TRIM(p_email);
        END IF;

        IF v_target_user.profile_role IN ('admin', 'super_admin') THEN
            RAISE EXCEPTION 'Administrator accounts cannot be added as dealership staff.';
        END IF;

        IF EXISTS (SELECT 1 FROM public.dealer_users WHERE user_id = v_target_user.id) THEN
            RAISE EXCEPTION 'This user is already linked to a dealership team.';
        END IF;

        PERFORM set_config('autogroup.internal_rpc', 'true', true);
        UPDATE public.profiles SET role = 'dealer', updated_at = now() WHERE id = v_target_user.id AND role = 'buyer';

        INSERT INTO public.dealer_users (dealership_id, user_id, role)
        VALUES (v_dealership_id, v_target_user.id, 'staff');

        RETURN jsonb_build_object('success', true, 'user_id', v_target_user.id);

    ELSIF p_action = 'REMOVE' THEN
        IF p_dealer_user_id IS NULL THEN
            RAISE EXCEPTION 'Staff record ID is required.';
        END IF;

        SELECT * INTO v_target_link FROM public.dealer_users WHERE id = p_dealer_user_id AND dealership_id = v_dealership_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Staff record not found for your dealership.';
        END IF;

        IF v_target_link.role = 'owner' OR v_target_link.user_id = auth.uid() THEN
            RAISE EXCEPTION 'The primary showroom owner cannot be removed.';
        END IF;

        DELETE FROM public.dealer_users WHERE id = p_dealer_user_id;
        RETURN jsonb_build_object('success', true);
    ELSE
        RAISE EXCEPTION 'Invalid staff action: %', p_action;
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.manage_dealer_staff(TEXT, TEXT, UUID) TO authenticated;

-- ==============================================================================
-- 6. FIX ADMIN RPCS (Group membership release, BOOKING status, integer settings, notes)
-- ==============================================================================

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
    v_was_creator BOOLEAN := false;
    v_next_creator RECORD;
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
        -- Release active members so they are not permanently locked out of this car variant
        UPDATE public.group_members
        SET status = 'LEFT', is_creator = false, left_at = now()
        WHERE group_id = p_group_id AND status = 'ACTIVE';
    ELSIF p_action = 'EXPIRE' THEN
        UPDATE public.groups SET status = 'EXPIRED', expired_at = now(), admin_notes = NULLIF(TRIM(p_reason), ''), updated_at = now() WHERE id = p_group_id;
        UPDATE public.group_members
        SET status = 'LEFT', is_creator = false, left_at = now()
        WHERE group_id = p_group_id AND status = 'ACTIVE';
    ELSIF p_action = 'REMOVE_MEMBER' THEN
        IF p_member_user_id IS NULL THEN RAISE EXCEPTION 'Member user ID is required.'; END IF;
        SELECT (is_creator OR v_group.created_by = p_member_user_id) INTO v_was_creator
        FROM public.group_members
        WHERE group_id = p_group_id AND user_id = p_member_user_id AND status = 'ACTIVE';

        UPDATE public.group_members
        SET status = 'LEFT', is_creator = false, left_at = now()
        WHERE group_id = p_group_id AND user_id = p_member_user_id AND status = 'ACTIVE';

        IF COALESCE(v_was_creator, false) THEN
            SELECT id, user_id INTO v_next_creator
            FROM public.group_members
            WHERE group_id = p_group_id AND status = 'ACTIVE'
            ORDER BY joined_at ASC LIMIT 1;

            IF v_next_creator.id IS NOT NULL THEN
                UPDATE public.group_members SET is_creator = true WHERE id = v_next_creator.id;
                UPDATE public.groups SET created_by = v_next_creator.user_id, updated_at = now() WHERE id = p_group_id;
            END IF;
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
    IF v_actor IS NOT NULL AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: administrator privileges required to execute group expiry job.';
    END IF;

    SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 45) INTO v_expiry_days
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

    IF v_expired_count > 0 AND v_group_ids IS NOT NULL THEN
        UPDATE public.group_members
        SET status = 'LEFT', is_creator = false, left_at = now()
        WHERE group_id = ANY(v_group_ids) AND status = 'ACTIVE';

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
    v_audit_reason TEXT;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: administrator privileges required.'; END IF;

    SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;

    p_action := UPPER(TRIM(p_action));

    IF p_action = 'FORCE_DEALER_FAULT_CANCEL' THEN
        IF v_b.status <> 'PAID' THEN
            RAISE EXCEPTION 'Only PAID bookings can be cancelled for dealer fault (current: %).', v_b.status;
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

        IF NOT EXISTS (SELECT 1 FROM public.refunds WHERE booking_id = p_booking_id) THEN
            INSERT INTO public.refunds (
                booking_id, reason, booking_amount_refunded, dealer_retained_amount, platform_fee_refunded, total_refunded, status
            ) VALUES (
                p_booking_id, 'DEALER_FAULT', v_b.booking_amount, 0, v_fee_refunded, v_total_refunded, 'PROCESSED'
            );
        END IF;

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

        SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 14) INTO v_fallback_days
        FROM public.settings WHERE key = 'dealer_delivery_fallback_days';
        v_fallback_days := COALESCE(v_fallback_days, 14);
        v_elapsed_days := EXTRACT(DAY FROM (now() - v_b.created_at));

        IF v_elapsed_days < v_fallback_days THEN
            RAISE EXCEPTION 'Fallback delivery requires at least % days elapsed since booking (currently % days).', v_fallback_days, v_elapsed_days;
        END IF;

        v_audit_reason := COALESCE(NULLIF(TRIM(p_reason), ''), 'Admin delivery fallback applied');

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
            v_audit_reason
        );

        RETURN jsonb_build_object('success', true, 'status', 'DELIVERED');
    ELSE
        RAISE EXCEPTION 'Invalid booking action: %', p_action;
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_manage_report(UUID, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_manage_report(
    p_report_id UUID,
    p_status TEXT,
    p_admin_notes TEXT DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_suspension_reason TEXT DEFAULT NULL
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
        admin_notes = CASE WHEN p_admin_notes IS NULL THEN admin_notes ELSE NULLIF(TRIM(p_admin_notes), '') END,
        action_taken = COALESCE(NULLIF(UPPER(TRIM(p_action)), ''), action_taken),
        resolved_by = CASE WHEN p_status IN ('RESOLVED', 'REJECTED') THEN auth.uid() ELSE resolved_by END,
        resolved_at = CASE WHEN p_status IN ('RESOLVED', 'REJECTED') THEN now() ELSE resolved_at END
    WHERE id = p_report_id;

    IF UPPER(COALESCE(p_action, '')) = 'SUSPEND_DEALER' THEN
        PERFORM public.admin_set_dealership_status(
            v_rep.dealership_id,
            'SUSPEND',
            COALESCE(NULLIF(TRIM(p_suspension_reason), ''), 'Suspended following buyer dispute report #' || p_report_id::text)
        );
    ELSIF UPPER(COALESCE(p_action, '')) = 'WARN_DEALER' THEN
        FOR v_du IN SELECT user_id FROM public.dealer_users WHERE dealership_id = v_rep.dealership_id LOOP
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                v_du.user_id,
                'Compliance Warning from AutoGroup Administration',
                'An official warning has been logged against ' || COALESCE(v_dealer_name, 'your dealership') ||
                '. Please strictly honor locked on-road quotations.',
                'SYSTEM'
            );
        END LOOP;
    END IF;

    IF p_status IN ('INVESTIGATING', 'RESOLVED', 'REJECTED') OR p_action IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            v_rep.buyer_id,
            'Update on Your Dealership Report',
            'Your report against ' || COALESCE(v_dealer_name, 'dealership') || ' is now ' || p_status || '.',
            'GENERAL'
        );
    END IF;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'REPORT_' || COALESCE(NULLIF(UPPER(TRIM(p_action)), ''), p_status),
        'report', p_report_id::text,
        jsonb_build_object('status', v_rep.status),
        jsonb_build_object('status', p_status, 'action', p_action),
        TRIM(COALESCE(NULLIF(TRIM(p_suspension_reason), ''), NULLIF(TRIM(p_admin_notes), ''), p_status))
    );

    RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_manage_report(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

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
    v_int_keys TEXT[] := ARRAY[
        'visibility_member_threshold',
        'group_visibility_days_for_2_members',
        'group_expiry_days_for_1_member',
        'default_group_target',
        'quote_validity_default_days',
        'dealer_delivery_fallback_days',
        'suspicious_group_member_threshold',
        'suspicious_group_window_minutes',
        'quote_outlier_threshold_percent'
    ];
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

        IF p_key = ANY(v_int_keys) THEN
            IF v_num <> TRUNC(v_num) THEN
                RAISE EXCEPTION 'Setting "%" must be a whole integer.', p_key;
            END IF;
            IF v_num < 1 THEN
                RAISE EXCEPTION 'Setting "%" must be at least 1.', p_key;
            END IF;
        END IF;

        IF p_key = 'buyer_cancel_retention_percent' AND (v_num < 0 OR v_num > 100) THEN
            RAISE EXCEPTION 'Retention percent must be between 0 and 100.';
        END IF;

        SELECT COALESCE(value::NUMERIC, 5000) INTO v_booking_amt FROM public.settings WHERE key = 'booking_amount';
        SELECT COALESCE(value::NUMERIC, 100) INTO v_platform_fee FROM public.settings WHERE key = 'platform_fee';

        IF p_key = 'booking_amount' THEN
            v_booking_amt := v_num;
        ELSIF p_key = 'platform_fee' THEN
            v_platform_fee := v_num;
        END IF;

        IF p_key IN ('booking_amount', 'platform_fee') AND (v_booking_amt + v_platform_fee >= 10000) THEN
            RAISE EXCEPTION 'booking_amount (%) + platform_fee (%) must remain strictly < 10000 to match table constraints.', v_booking_amt, v_platform_fee;
        END IF;
    END IF;

    UPDATE public.settings SET value = p_value, updated_at = now() WHERE key = p_key;

    PERFORM public.fn_write_audit_log(
        auth.uid(), 'SETTING_UPDATED', 'setting', p_key,
        jsonb_build_object('value', v_old_value),
        jsonb_build_object('value', p_value),
        'Updated ' || p_key || ' from ' || v_old_value || ' to ' || p_value
    );

    RETURN jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
END;
$$;

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
    v_flagged_count INTEGER := 0;
    v_admin RECORD;
BEGIN
    SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 5) INTO v_threshold
    FROM public.settings WHERE key = 'suspicious_group_member_threshold';
    v_threshold := COALESCE(v_threshold, 5);

    SELECT COALESCE(ROUND(NULLIF(value, '')::NUMERIC)::INTEGER, 60) INTO v_window_mins
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

        GET DIAGNOSTICS v_flagged_count = ROW_COUNT;

        IF v_flagged_count > 0 THEN
            FOR v_admin IN
                SELECT id FROM public.profiles
                WHERE role IN ('admin', 'super_admin') AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
            LOOP
                INSERT INTO public.notifications (user_id, title, message, type, link_url)
                VALUES (
                    v_admin.id,
                    'Suspicious Group Join Spike Detected',
                    'Group flagged after ' || v_recent_count || ' joins within ' || v_window_mins || ' minutes.',
                    'ADMIN_ALERT',
                    '/admin/groups/' || NEW.group_id::text
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_invite(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_inv RECORD;
    v_account_exists BOOLEAN := false;
    v_existing_role TEXT := NULL;
BEGIN
    IF p_token_hash IS NULL OR TRIM(p_token_hash) = '' THEN
        RETURN jsonb_build_object('valid', false, 'status', 'INVALID', 'reason', 'Missing invite token.');
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

    SELECT EXISTS (
        SELECT 1 FROM auth.users u
        WHERE LOWER(u.email) = LOWER(v_inv.email)
    ) INTO v_account_exists;

    IF v_account_exists THEN
        SELECT COALESCE(p.role, u.raw_user_meta_data->>'role', 'buyer') INTO v_existing_role
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
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

COMMIT;
