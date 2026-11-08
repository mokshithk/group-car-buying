-- 002_rls_policies.sql
-- Complete Row Level Security (RLS) Policies for Buyers, Dealers, and Admins

-- Enable RLS on every single table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_district()
RETURNS UUID AS $$
    SELECT district_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_dealer_dealership_id()
RETURNS UUID AS $$
    SELECT dealership_id FROM public.dealer_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_dealer_verified()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.dealerships d
        JOIN public.dealer_users du ON d.id = du.dealership_id
        WHERE du.user_id = auth.uid() AND d.status = 'VERIFIED'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. SETTINGS POLICIES
-- Readable by everyone (authenticated & anonymous for public display settings)
CREATE POLICY "Public read settings" ON public.settings
    FOR SELECT TO public USING (true);

-- Admin can manage settings
CREATE POLICY "Admin manage settings" ON public.settings
    FOR ALL TO authenticated USING (public.current_user_role() = 'admin');

-- 2. DISTRICTS POLICIES
-- Readable by everyone
CREATE POLICY "Public read districts" ON public.districts
    FOR SELECT TO public USING (true);

-- 3. PROFILES POLICIES
-- Anyone can read their own profile
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT TO authenticated USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Allow initial insert during registration
CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Verified dealers can view contact info ONLY of buyers who showed interest or booked with them
CREATE POLICY "Dealers view interested or booked buyer profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        public.is_dealer_verified() AND (
            id IN (
                SELECT i.user_id FROM public.interests i
                WHERE i.dealership_id = public.current_dealer_dealership_id()
            )
            OR id IN (
                SELECT b.buyer_id FROM public.bookings b
                WHERE b.dealership_id = public.current_dealer_dealership_id()
            )
        )
    );

-- 4. CAR CATALOG POLICIES (Manufacturers, Models, Variants)
CREATE POLICY "Public read manufacturers" ON public.manufacturers FOR SELECT TO public USING (true);
CREATE POLICY "Public read models" ON public.models FOR SELECT TO public USING (true);
CREATE POLICY "Public read variants" ON public.variants FOR SELECT TO public USING (true);

-- 5. DEALERSHIPS POLICIES
-- Anyone can read verified dealerships
CREATE POLICY "Public read verified dealerships" ON public.dealerships
    FOR SELECT TO public USING (status = 'VERIFIED');

-- Dealer users can see their own dealership regardless of status (e.g. PENDING)
CREATE POLICY "Dealer users read own dealership" ON public.dealerships
    FOR SELECT TO authenticated
    USING (id = public.current_dealer_dealership_id());

-- Dealer owners can update their dealership profile
CREATE POLICY "Dealer owners update own dealership" ON public.dealerships
    FOR UPDATE TO authenticated
    USING (
        id IN (
            SELECT dealership_id FROM public.dealer_users 
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Allow new dealership insert during registration
CREATE POLICY "Dealers insert dealership" ON public.dealerships
    FOR INSERT TO authenticated WITH CHECK (true);

-- DEALER USERS POLICIES
CREATE POLICY "Dealer users read colleagues" ON public.dealer_users
    FOR SELECT TO authenticated
    USING (dealership_id = public.current_dealer_dealership_id());

CREATE POLICY "Dealer owner manage staff" ON public.dealer_users
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.dealer_users
            WHERE user_id = auth.uid() AND dealership_id = dealer_users.dealership_id AND role = 'owner'
        )
    );

CREATE POLICY "Dealers insert self as owner on registration" ON public.dealer_users
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 6. GROUPS POLICIES
-- Buyers: can see groups in their registered district
CREATE POLICY "Buyers view district groups" ON public.groups
    FOR SELECT TO authenticated
    USING (
        public.current_user_role() = 'buyer' AND district_id = public.current_user_district()
    );

-- Public / Anonymous: can view groups (counts only, no member private info)
CREATE POLICY "Public view groups" ON public.groups
    FOR SELECT TO anon USING (true);

-- Verified Dealers: can see groups that meet visibility rule in their brand & district
CREATE POLICY "Verified dealers view eligible groups" ON public.groups
    FOR SELECT TO authenticated
    USING (
        public.is_dealer_verified()
        AND public.fn_is_group_visible_to_dealers(id)
        AND (
            district_id IN (
                SELECT UNNEST(districts) FROM public.dealerships WHERE id = public.current_dealer_dealership_id()
            )
            OR district_id = (SELECT district_id FROM public.dealerships WHERE id = public.current_dealer_dealership_id())
        )
        AND (
            variant_id IN (
                SELECT v.id FROM public.variants v
                JOIN public.models m ON v.model_id = m.id
                JOIN public.manufacturers mf ON m.manufacturer_id = mf.id
                WHERE mf.id::text = ANY(SELECT UNNEST(brands) FROM public.dealerships WHERE id = public.current_dealer_dealership_id())
                   OR mf.name = ANY(SELECT UNNEST(brands) FROM public.dealerships WHERE id = public.current_dealer_dealership_id())
            )
        )
    );

-- Buyers can create groups in their district
CREATE POLICY "Buyers create groups" ON public.groups
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = 'buyer' 
        AND created_by = auth.uid()
        AND district_id = public.current_user_district()
    );

-- Group creator can update group status (e.g., cancel before booking)
CREATE POLICY "Group creator manage group" ON public.groups
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid());

-- GROUP MEMBERS POLICIES
-- Anyone can view members of groups in their district (names rendered as First + Initial)
CREATE POLICY "View group members" ON public.group_members
    FOR SELECT TO authenticated
    USING (
        group_id IN (
            SELECT id FROM public.groups WHERE district_id = public.current_user_district()
        )
        OR (
            public.is_dealer_verified() AND public.fn_is_group_visible_to_dealers(group_id)
        )
    );

-- Buyers can join / leave groups
CREATE POLICY "Buyers join group" ON public.group_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.current_user_role() = 'buyer');

CREATE POLICY "Buyers leave or update group membership" ON public.group_members
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. QUOTATIONS POLICIES
-- Buyers can view quotations for groups they belong to or are in their district
CREATE POLICY "Buyers view group quotes" ON public.quotations
    FOR SELECT TO authenticated
    USING (
        group_id IN (
            SELECT id FROM public.groups WHERE district_id = public.current_user_district()
        )
    );

-- Verified Dealers can view all quotations on eligible groups (including competitors)
CREATE POLICY "Verified dealers view eligible quotes" ON public.quotations
    FOR SELECT TO authenticated
    USING (
        public.is_dealer_verified() AND public.fn_is_group_visible_to_dealers(group_id)
    );

-- Dealers can ONLY create quotes for their own dealership
CREATE POLICY "Dealers insert own quote" ON public.quotations
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_dealer_verified() 
        AND dealership_id = public.current_dealer_dealership_id()
    );

-- Dealers can ONLY update their own dealership quotes
CREATE POLICY "Dealers update own quote" ON public.quotations
    FOR UPDATE TO authenticated
    USING (
        public.is_dealer_verified() 
        AND dealership_id = public.current_dealer_dealership_id()
    )
    WITH CHECK (dealership_id = public.current_dealer_dealership_id());

-- QUOTATION VERSIONS POLICIES
CREATE POLICY "View quote versions" ON public.quotation_versions
    FOR SELECT TO authenticated
    USING (
        quotation_id IN (SELECT id FROM public.quotations)
    );

-- 8. INTERESTS POLICIES
-- Buyers can view and create their own interests
CREATE POLICY "Buyers manage own interests" ON public.interests
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Dealers can view interests for their own dealership ONLY
CREATE POLICY "Dealers view own leads" ON public.interests
    FOR SELECT TO authenticated
    USING (dealership_id = public.current_dealer_dealership_id());

CREATE POLICY "Dealers update own leads" ON public.interests
    FOR UPDATE TO authenticated
    USING (dealership_id = public.current_dealer_dealership_id());

-- 9. BOOKINGS POLICIES
-- Buyers can view and manage their own bookings
CREATE POLICY "Buyers view own bookings" ON public.bookings
    FOR SELECT TO authenticated
    USING (buyer_id = auth.uid());

CREATE POLICY "Buyers insert own bookings" ON public.bookings
    FOR INSERT TO authenticated
    WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers update own bookings" ON public.bookings
    FOR UPDATE TO authenticated
    USING (buyer_id = auth.uid());

-- Dealers can ONLY view bookings made with their own dealership
CREATE POLICY "Dealers view own bookings" ON public.bookings
    FOR SELECT TO authenticated
    USING (dealership_id = public.current_dealer_dealership_id());

CREATE POLICY "Dealers update own bookings" ON public.bookings
    FOR UPDATE TO authenticated
    USING (dealership_id = public.current_dealer_dealership_id());

-- 10. PAYMENTS & REFUNDS POLICIES
CREATE POLICY "Users view own payments" ON public.payments
    FOR SELECT TO authenticated
    USING (booking_id IN (SELECT id FROM public.bookings WHERE buyer_id = auth.uid()));

CREATE POLICY "Users insert payments" ON public.payments
    FOR INSERT TO authenticated
    WITH CHECK (booking_id IN (SELECT id FROM public.bookings WHERE buyer_id = auth.uid()));

CREATE POLICY "Users view own refunds" ON public.refunds
    FOR SELECT TO authenticated
    USING (
        booking_id IN (
            SELECT id FROM public.bookings 
            WHERE buyer_id = auth.uid() OR dealership_id = public.current_dealer_dealership_id()
        )
    );

CREATE POLICY "Create refund on booking cancel" ON public.refunds
    FOR INSERT TO authenticated
    WITH CHECK (
        booking_id IN (
            SELECT id FROM public.bookings 
            WHERE buyer_id = auth.uid() OR dealership_id = public.current_dealer_dealership_id()
        )
    );

-- 11. NOTIFICATIONS POLICIES
CREATE POLICY "Users view own notifications" ON public.notifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 12. RATINGS & REPORTS POLICIES
CREATE POLICY "Public view ratings" ON public.dealer_ratings
    FOR SELECT TO public USING (true);

CREATE POLICY "Buyers insert ratings" ON public.dealer_ratings
    FOR INSERT TO authenticated
    WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers insert reports" ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Dealers view reports against them" ON public.reports
    FOR SELECT TO authenticated
    USING (dealership_id = public.current_dealer_dealership_id());

-- 13. WISHLIST & PREFERENCES POLICIES
CREATE POLICY "Buyers manage own wishlist" ON public.wishlist
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Buyers manage own preferences" ON public.buyer_preferences
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 14. ADMIN STUB POLICIES
CREATE POLICY "Admin full access profiles" ON public.profiles FOR ALL TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY "Admin full access dealerships" ON public.dealerships FOR ALL TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY "Admin full access groups" ON public.groups FOR ALL TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY "Admin full access bookings" ON public.bookings FOR ALL TO authenticated USING (public.current_user_role() = 'admin');
