-- 001_initial_schema.sql
-- Group Car Buying Platform: Core Schema, Constraints, Functions, Views and Triggers

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initial default settings
INSERT INTO public.settings (key, value, description)
VALUES 
    ('booking_amount', '5000', 'Standard placeholder booking amount in INR (< 10,000)'),
    ('platform_fee', '100', 'Platform processing fee in INR'),
    ('buyer_cancel_retention_percent', '5', 'Percentage of booking amount kept by showroom on buyer cancellation'),
    ('group_visibility_days_for_2_members', '20', 'Days after which a group with 2 members becomes visible to dealers'),
    ('dealer_delivery_fallback_days', '14', 'Days after which dealer can confirm delivery if buyer has not'),
    ('fee_refund_on_dealer_fault', 'true', 'Whether platform fee is refunded when dealer is at fault')
ON CONFLICT (key) DO NOTHING;

-- 2. DISTRICTS TABLE
CREATE TABLE IF NOT EXISTS public.districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROFILES TABLE (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'dealer', 'admin')),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
    consent_share_details BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CAR CATALOG: MANUFACTURERS, MODELS, VARIANTS
CREATE TABLE IF NOT EXISTS public.manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    body_type TEXT NOT NULL CHECK (body_type IN ('Hatchback', 'Sedan', 'SUV', 'MUV', 'EV')),
    fuel_types TEXT[] NOT NULL DEFAULT '{}',
    image_url TEXT,
    starting_price NUMERIC NOT NULL CHECK (starting_price >= 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    transmission TEXT NOT NULL CHECK (transmission IN ('Manual', 'Automatic', 'iMT', 'DCT', 'CVT')),
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid')),
    engine_cc INTEGER,
    ex_showroom_price NUMERIC NOT NULL CHECK (ex_showroom_price >= 0),
    features TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DEALERSHIPS & DEALER USERS
CREATE TABLE IF NOT EXISTS public.dealerships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'VERIFIED', 'SUSPENDED')) DEFAULT 'PENDING',
    address TEXT NOT NULL,
    district_id UUID REFERENCES public.districts(id) ON DELETE RESTRICT,
    contact_phone TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    gst_number TEXT NOT NULL,
    map_link_text TEXT,
    brands TEXT[] NOT NULL DEFAULT '{}',
    districts UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dealer_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'staff')) DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(dealership_id, user_id)
);

-- 6. GROUPS & GROUP MEMBERS
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES public.variants(id) ON DELETE CASCADE,
    district_id UUID REFERENCES public.districts(id) ON DELETE RESTRICT,
    target_members INTEGER NOT NULL DEFAULT 10 CHECK (target_members > 0),
    status TEXT NOT NULL CHECK (status IN ('FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED', 'COMPLETED', 'CANCELLED', 'EXPIRED')) DEFAULT 'FORMING',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_creator BOOLEAN DEFAULT false,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'LEFT', 'BOOKED')) DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    UNIQUE(group_id, user_id)
);

-- Enforce: One active group per buyer per variant
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_group_per_buyer_per_variant
ON public.group_members (user_id, group_id)
WHERE status = 'ACTIVE';

-- 7. QUOTATIONS & VERSIONS
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
    ex_showroom_price NUMERIC NOT NULL CHECK (ex_showroom_price >= 0),
    insurance NUMERIC NOT NULL DEFAULT 0 CHECK (insurance >= 0),
    registration_charges NUMERIC NOT NULL DEFAULT 0 CHECK (registration_charges >= 0),
    discounts NUMERIC NOT NULL DEFAULT 0 CHECK (discounts >= 0),
    accessories_extras NUMERIC NOT NULL DEFAULT 0 CHECK (accessories_extras >= 0),
    on_road_price NUMERIC NOT NULL CHECK (on_road_price >= 0),
    validity_date TIMESTAMPTZ NOT NULL,
    terms TEXT DEFAULT '',
    is_complete BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, dealership_id)
);

CREATE TABLE IF NOT EXISTS public.quotation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
    on_road_price NUMERIC NOT NULL,
    price_breakdown JSONB NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    version_number INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    is_optional BOOLEAN DEFAULT false
);

-- 8. INTERESTS & BOOKINGS
CREATE TABLE IF NOT EXISTS public.interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
    contacted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(quotation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code TEXT UNIQUE NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE RESTRICT,
    booking_amount NUMERIC NOT NULL CHECK (booking_amount < 10000),
    platform_fee NUMERIC NOT NULL DEFAULT 100,
    total_amount NUMERIC NOT NULL CHECK (total_amount < 10000),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'DELIVERED', 'CANCELLED_BY_BUYER', 'CANCELLED_BY_DEALER', 'REFUNDED')) DEFAULT 'PENDING',
    price_snapshot JSONB NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_total_booking_fee CHECK (booking_amount + platform_fee < 10000)
);

-- 9. PAYMENTS & REFUNDS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    payment_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')) DEFAULT 'PENDING',
    method TEXT DEFAULT 'UPI',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('BUYER_CANCEL', 'DEALER_FAULT')),
    booking_amount_refunded NUMERIC NOT NULL CHECK (booking_amount_refunded >= 0),
    dealer_retained_amount NUMERIC NOT NULL CHECK (dealer_retained_amount >= 0),
    platform_fee_refunded NUMERIC NOT NULL CHECK (platform_fee_refunded >= 0),
    total_refunded NUMERIC NOT NULL CHECK (total_refunded >= 0),
    status TEXT NOT NULL DEFAULT 'PROCESSED',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. NOTIFICATIONS, RATINGS, REPORTS, WISHLIST & PREFERENCES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    link_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dealer_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.variants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, variant_id)
);

CREATE TABLE IF NOT EXISTS public.buyer_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
    preferred_brands TEXT[] DEFAULT '{}',
    preferred_fuel_types TEXT[] DEFAULT '{}',
    budget_min NUMERIC,
    budget_max NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================================================
-- BUSINESS LOGIC FUNCTIONS & VIEWS
-- ====================================================================

-- Group Visibility Rule:
-- A group is visible to dealers IF:
-- 1) Active members >= 3, OR
-- 2) Active members = 2 AND elapsed days >= group_visibility_days_for_2_members (default 20).
-- Groups with 1 member are NEVER visible.
CREATE OR REPLACE FUNCTION public.fn_is_group_visible_to_dealers(p_group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_member_count INTEGER;
    v_created_at TIMESTAMPTZ;
    v_visibility_days INTEGER;
    v_days_elapsed INTEGER;
BEGIN
    -- Get count of active members
    SELECT COUNT(*) INTO v_member_count
    FROM public.group_members
    WHERE group_id = p_group_id AND status = 'ACTIVE';

    IF v_member_count >= 3 THEN
        RETURN true;
    ELSIF v_member_count = 2 THEN
        SELECT created_at INTO v_created_at
        FROM public.groups
        WHERE id = p_group_id;

        -- Read configurable setting
        SELECT COALESCE(value::INTEGER, 20) INTO v_visibility_days
        FROM public.settings
        WHERE key = 'group_visibility_days_for_2_members';

        IF v_visibility_days IS NULL THEN
            v_visibility_days := 20;
        END IF;

        v_days_elapsed := EXTRACT(DAY FROM (now() - v_created_at));
        IF v_days_elapsed >= v_visibility_days THEN
            RETURN true;
        ELSE
            RETURN false;
        END IF;
    ELSE
        -- 1 or 0 members: NEVER visible
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- View: Eligible Groups for Dealers with member counts and bookings-so-far
CREATE OR REPLACE VIEW public.dealer_eligible_groups_view AS
SELECT 
    g.id,
    g.variant_id,
    g.district_id,
    g.target_members,
    g.status,
    g.created_at,
    g.updated_at,
    v.name AS variant_name,
    m.name AS model_name,
    mf.name AS brand_name,
    d.name AS district_name,
    d.state AS district_state,
    COUNT(DISTINCT gm.id) FILTER (WHERE gm.status = 'ACTIVE') AS active_members,
    COUNT(DISTINCT b.id) FILTER (WHERE b.status IN ('PAID', 'DELIVERED')) AS bookings_so_far,
    public.fn_is_group_visible_to_dealers(g.id) AS is_visible
FROM public.groups g
JOIN public.variants v ON g.variant_id = v.id
JOIN public.models m ON v.model_id = m.id
JOIN public.manufacturers mf ON m.manufacturer_id = mf.id
JOIN public.districts d ON g.district_id = d.id
LEFT JOIN public.group_members gm ON g.id = gm.group_id
LEFT JOIN public.bookings b ON g.id = b.group_id
GROUP BY g.id, v.name, m.name, mf.name, d.name, d.state;

-- Trigger: When quotation price changes, record version & notify buyers
CREATE OR REPLACE FUNCTION public.trg_quotation_versioning()
RETURNS TRIGGER AS $$
DECLARE
    v_next_version INTEGER;
    v_buyer RECORD;
    v_dealership_name TEXT;
    v_variant_name TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.on_road_price <> NEW.on_road_price OR OLD.is_complete <> NEW.is_complete) THEN
        -- Get next version number
        SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
        FROM public.quotation_versions
        WHERE quotation_id = NEW.id;

        INSERT INTO public.quotation_versions (
            quotation_id,
            dealership_id,
            on_road_price,
            price_breakdown,
            changed_at,
            version_number
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

        -- Get dealer name and variant name for notification
        SELECT name INTO v_dealership_name FROM public.dealerships WHERE id = NEW.dealership_id;
        SELECT v.name INTO v_variant_name 
        FROM public.groups g 
        JOIN public.variants v ON g.variant_id = v.id 
        WHERE g.id = NEW.group_id;

        -- Notify all active buyers in the group
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
                '/buyer/groups/' || NEW.group_id
            );
        END LOOP;
    ELSIF TG_OP = 'INSERT' THEN
        -- Insert initial version 1
        INSERT INTO public.quotation_versions (
            quotation_id,
            dealership_id,
            on_road_price,
            price_breakdown,
            changed_at,
            version_number
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotations_after_save ON public.quotations;
CREATE TRIGGER trg_quotations_after_save
AFTER INSERT OR UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.trg_quotation_versioning();

-- Trigger: When a booking is PAID, automatically remove buyer from the group
CREATE OR REPLACE FUNCTION public.trg_booking_auto_remove_from_group()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'PAID' AND (OLD.status IS NULL OR OLD.status <> 'PAID') THEN
        UPDATE public.group_members
        SET status = 'BOOKED',
            left_at = now()
        WHERE group_id = NEW.group_id AND user_id = NEW.buyer_id;

        -- If creator left, promote next active member to creator
        IF EXISTS (
            SELECT 1 FROM public.group_members 
            WHERE group_id = NEW.group_id AND user_id = NEW.buyer_id AND is_creator = true
        ) THEN
            UPDATE public.group_members
            SET is_creator = true
            WHERE id = (
                SELECT id FROM public.group_members
                WHERE group_id = NEW.group_id AND status = 'ACTIVE'
                ORDER BY joined_at ASC
                LIMIT 1
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_after_paid ON public.bookings;
CREATE TRIGGER trg_bookings_after_paid
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_booking_auto_remove_from_group();

-- Helper function: calculate refund breakdown
CREATE OR REPLACE FUNCTION public.fn_calculate_refund_amounts(
    p_booking_id UUID,
    p_reason TEXT
)
RETURNS TABLE (
    booking_amount_refunded NUMERIC,
    dealer_retained_amount NUMERIC,
    platform_fee_refunded NUMERIC,
    total_refunded NUMERIC
) AS $$
DECLARE
    v_booking RECORD;
    v_retention_percent NUMERIC;
    v_fee_refund_flag BOOLEAN;
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    
    IF p_reason = 'BUYER_CANCEL' THEN
        -- 5% of booking amount kept by showroom, platform fee is NOT refunded
        SELECT COALESCE(value::NUMERIC, 5) INTO v_retention_percent 
        FROM public.settings WHERE key = 'buyer_cancel_retention_percent';
        
        dealer_retained_amount := ROUND((v_booking.booking_amount * v_retention_percent) / 100.0, 2);
        booking_amount_refunded := v_booking.booking_amount - dealer_retained_amount;
        platform_fee_refunded := 0;
        total_refunded := booking_amount_refunded;
        RETURN NEXT;
    ELSIF p_reason = 'DEALER_FAULT' THEN
        -- 100% booking amount refunded + platform fee refunded if configured
        SELECT (COALESCE(value, 'true') = 'true') INTO v_fee_refund_flag
        FROM public.settings WHERE key = 'fee_refund_on_dealer_fault';

        dealer_retained_amount := 0;
        booking_amount_refunded := v_booking.booking_amount;
        IF v_fee_refund_flag THEN
            platform_fee_refunded := v_booking.platform_fee;
        ELSE
            platform_fee_refunded := 0;
        END IF;
        total_refunded := booking_amount_refunded + platform_fee_refunded;
        RETURN NEXT;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;
