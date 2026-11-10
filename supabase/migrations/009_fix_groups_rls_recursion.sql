-- 009_fix_groups_rls_recursion.sql
-- Eliminate mutual RLS recursion between public.groups, public.quotations, and public.group_members
-- introduced when "Verified dealers view eligible groups" queried public.quotations directly while
-- "Buyers view group quotes" on public.quotations queried public.groups.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_dealer_has_group_activity(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        WITH dealer_ctx AS (
            SELECT public.current_dealer_dealership_id() AS dealership_id
        )
        SELECT EXISTS (
            SELECT 1
            FROM public.quotations q
            JOIN dealer_ctx d ON q.dealership_id = d.dealership_id
            WHERE q.group_id = p_group_id
              AND d.dealership_id IS NOT NULL
        )
        OR EXISTS (
            SELECT 1
            FROM public.bookings b
            JOIN dealer_ctx d ON b.dealership_id = d.dealership_id
            WHERE b.group_id = p_group_id
              AND d.dealership_id IS NOT NULL
        )
    ), false);
$$;

GRANT EXECUTE ON FUNCTION public.fn_dealer_has_group_activity(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_is_group_in_current_buyer_district(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.groups g
        WHERE g.id = p_group_id
          AND g.district_id = public.current_user_district()
    );
$$;

GRANT EXECUTE ON FUNCTION public.fn_is_group_in_current_buyer_district(UUID) TO authenticated;

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
        OR public.fn_dealer_has_group_activity(id)
    );

DROP POLICY IF EXISTS "View group members" ON public.group_members;
CREATE POLICY "View group members" ON public.group_members
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR user_id = auth.uid()
        OR (
            public.current_user_role() = 'buyer'
            AND public.fn_is_group_in_current_buyer_district(group_id)
        )
        OR (
            public.is_dealer_verified()
            AND public.fn_is_group_visible_to_dealers(group_id)
        )
    );

DROP POLICY IF EXISTS "Buyers view group quotes" ON public.quotations;
CREATE POLICY "Buyers view group quotes" ON public.quotations
    FOR SELECT TO authenticated
    USING (
        is_active = true
        AND public.fn_is_group_in_current_buyer_district(group_id)
    );

COMMIT;
