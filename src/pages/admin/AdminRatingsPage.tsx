import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Tabs, Modal, Input } from '@/components/ui';
import { Star, EyeOff, Eye } from 'lucide-react';

interface AdminRatingRow {
  id: string;
  booking_id: string;
  dealership_id: string;
  buyer_id: string;
  rating: number;
  review: string | null;
  is_hidden: boolean;
  hidden_reason?: string | null;
  created_at: string;
  dealership?: { id: string; name: string } | null;
  buyer?: { id: string; full_name: string; email?: string | null } | null;
  booking?: { id: string; booking_code: string } | null;
}

type RatingTab = 'ALL' | 'VISIBLE' | 'HIDDEN';

export function AdminRatingsPage() {
  const { toast } = useToast();
  const [ratings, setRatings] = useState<AdminRatingRow[]>([]);
  const [tab, setTab] = useState<RatingTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Hide modal
  const [hideTarget, setHideTarget] = useState<AdminRatingRow | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRatings = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: rErr } = await supabase
        .from('dealer_ratings')
        .select(
          '*, dealership:dealerships(id, name), buyer:profiles(id, full_name, email), booking:bookings(id, booking_code)'
        )
        .order('created_at', { ascending: false });

      if (rErr) throw rErr;
      setRatings((data || []) as AdminRatingRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ratings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ratings.filter((r) => {
      if (tab === 'VISIBLE' && r.is_hidden) return false;
      if (tab === 'HIDDEN' && !r.is_hidden) return false;
      if (q) {
        const hay = `${r.review || ''} ${r.dealership?.name || ''} ${r.buyer?.full_name || ''} ${r.booking?.booking_code || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ratings, tab, searchQuery]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page]
  );

  const handleHideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hideTarget) return;
    if (hideReason.trim().length < 3) {
      toast({ type: 'error', title: 'Reason Required', message: 'Provide a clear moderation reason (at least 3 characters).' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc('admin_toggle_rating_visibility', {
        p_rating_id: hideTarget.id,
        p_hide: true,
        p_reason: hideReason.trim(),
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: 'Review Hidden', message: 'Hidden reviews are excluded from public & dealer averages.' });
      setHideTarget(null);
      setHideReason('');
      await loadRatings();
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Failed to Hide Review',
        message: err instanceof Error ? err.message : 'Unable to moderate review.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnhide = async (row: AdminRatingRow) => {
    setIsSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc('admin_toggle_rating_visibility', {
        p_rating_id: row.id,
        p_hide: false,
        p_reason: 'Restored by administrator',
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: 'Review Restored', message: 'The rating is visible again.' });
      await loadRatings();
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Restore Failed',
        message: err instanceof Error ? err.message : 'Unable to unhide review.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<AdminRatingRow>[] = [
    {
      key: 'rating',
      header: 'Rating & Review',
      render: (row) => (
        <div className="space-y-1 max-w-md">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3.5 h-3.5 ${
                  s <= row.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-200'
                }`}
              />
            ))}
            <span className="text-xs font-bold text-slate-800 ml-1 tabular-nums">{row.rating}/5</span>
          </div>
          <p className="text-xs text-slate-700">{row.review || 'No written review text.'}</p>
          {row.is_hidden && row.hidden_reason && (
            <div className="text-[11px] text-rose-700">Hidden reason: {row.hidden_reason}</div>
          )}
        </div>
      ),
    },
    {
      key: 'dealership',
      header: 'Dealership',
      render: (row) => (
        <div className="text-xs">
          <Link
            to={`/admin/dealers/${row.dealership_id}`}
            className="font-medium text-slate-800 hover:text-brand-600"
          >
            {row.dealership?.name || 'Dealership'}
          </Link>
          {row.booking?.booking_code && (
            <div className="text-[11px] text-slate-500 font-mono">
              <Link to={`/admin/bookings/${row.booking_id}`} className="hover:underline">
                {row.booking.booking_code}
              </Link>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (row) => (
        <div className="text-xs">
          <Link
            to={`/admin/buyers/${row.buyer_id}`}
            className="font-medium text-slate-800 hover:text-brand-600"
          >
            {row.buyer?.full_name || 'Buyer'}
          </Link>
          <div className="text-[11px] text-slate-500">
            {new Date(row.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Visibility',
      render: (row) =>
        row.is_hidden ? (
          <Badge variant="danger" size="sm">Hidden</Badge>
        ) : (
          <Badge variant="success" size="sm">Visible</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Moderation',
      align: 'right',
      render: (row) =>
        row.is_hidden ? (
          <Button size="sm" variant="outline" onClick={() => handleUnhide(row)} disabled={isSubmitting}>
            <Eye className="w-3.5 h-3.5 mr-1" /> Unhide
          </Button>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setHideTarget(row);
              setHideReason('');
            }}
          >
            <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide Review
          </Button>
        ),
    },
  ];

  return (
    <AdminLayout
      title="Ratings & Review Moderation"
      breadcrumbs={[{ label: 'Ratings' }]}
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      searchPlaceholder="Search review, dealer, buyer..."
    >
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: 'ALL', label: `All (${ratings.length})` },
            { id: 'VISIBLE', label: `Visible (${ratings.filter((r) => !r.is_hidden).length})` },
            { id: 'HIDDEN', label: `Hidden (${ratings.filter((r) => r.is_hidden).length})` },
          ]}
          activeTab={tab}
          onChange={(id) => {
            setTab(id as RatingTab);
            setPage(1);
          }}
        />

        <DataTable
          columns={columns}
          data={paginated}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={loadRatings}
          page={page}
          pageSize={pageSize}
          totalCount={filtered.length}
          onPageChange={setPage}
          emptyTitle="No reviews found"
          emptyDescription="No buyer reviews match the current filter."
        />
      </div>

      <Modal
        isOpen={Boolean(hideTarget)}
        onClose={() => setHideTarget(null)}
        title="Hide Abusive or Inappropriate Review"
      >
        <form onSubmit={handleHideSubmit} className="space-y-4">
          <p className="text-xs text-slate-600">
            Hidden reviews are excluded from public visibility and dealership rating calculations while keeping the
            record in audit history.
          </p>
          <Input
            label="Moderation Reason *"
            value={hideReason}
            onChange={(e) => setHideReason(e.target.value)}
            placeholder="e.g. Contains profanity / spam / unrelated dispute"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setHideTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isSubmitting}>
              Hide Review
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
