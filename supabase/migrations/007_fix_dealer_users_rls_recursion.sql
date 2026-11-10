-- 007_fix_dealer_users_rls_recursion.sql
-- Fixes PostgreSQL 42P17 ("infinite recursion detected in policy for relation dealer_users")
-- triggered when RLS policies on dealer_users and dealerships subquery public.dealer_users directly.
-- Safe, idempotent, non-destructive (BEGIN ... COMMIT; no DROP TABLE, TRUNCATE, or DELETE).

BEGIN;

CREATE OR REPLACE FUNCTION public.is_dealer_owner_of(p_dealership_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.dealer_users
        WHERE user_id = auth.uid()
          AND dealership_id = p_dealership_id
          AND role = 'owner'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_dealer_owner_of(UUID) TO authenticated;

-- Replace recursive self-referential policy on dealer_users
DROP POLICY IF EXISTS "Dealer owner manage staff" ON public.dealer_users;
CREATE POLICY "Dealer owner manage staff" ON public.dealer_users
    FOR ALL TO authenticated
    USING (public.is_dealer_owner_of(dealership_id))
    WITH CHECK (public.is_dealer_owner_of(dealership_id));

-- Replace direct dealer_users subqueries on dealerships with SECURITY DEFINER helpers
DROP POLICY IF EXISTS "Dealer users read own showroom" ON public.dealerships;
CREATE POLICY "Dealer users read own showroom" ON public.dealerships
    FOR SELECT TO authenticated
    USING (id = public.current_dealer_dealership_id());

DROP POLICY IF EXISTS "Dealer owners update own dealership" ON public.dealerships;
CREATE POLICY "Dealer owners update own dealership" ON public.dealerships
    FOR UPDATE TO authenticated
    USING (public.is_dealer_owner_of(id));

COMMIT;
