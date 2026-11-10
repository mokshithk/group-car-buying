-- supabase/cleanup_test_data.sql
-- Safe test-data cleanup targeting ONLY declared @autogroup.in synthetic test entities and fixed test UUIDs.
-- Do NOT add broad deletes. Review before running against any environment.

BEGIN;

-- 1. Remove synthetic test notifications, reports, ratings, refunds, payments, bookings tied to test emails/UUIDs
DELETE FROM public.notifications
WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IN (
        'test_buyer_a@autogroup.in',
        'test_buyer_b@autogroup.in',
        'test_dealer_a@autogroup.in',
        'test_dealer_b@autogroup.in',
        'test_admin@autogroup.in',
        'test_super_admin@autogroup.in'
    )
);

DELETE FROM public.admin_invites
WHERE email LIKE 'e2e_invite_%@example.test'
   OR email LIKE 'test_%@autogroup.in';

DELETE FROM public.dealerships
WHERE id IN (
    'e1111111-1111-1111-1111-111111111101'::UUID,
    'e1111111-1111-1111-1111-111111111102'::UUID,
    'e1111111-1111-1111-1111-111111111103'::UUID
)
   OR gst_number LIKE '29TEST%';

COMMIT;
