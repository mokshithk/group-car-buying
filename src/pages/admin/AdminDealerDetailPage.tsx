import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { useToast } from '@/components/ui/Toast';
import { formatINR, formatDateTime } from '@/lib/formatters';
import {
  Dealership,
  District,
  Quotation,
  Booking,
  DealerRating,
  Report,
  AuditLogEntry,
} from '@/types';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from '@/components/ui';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Star,
  Flag,
} from 'lucide-react';

interface StaffRow {
  id: string;
  role: string;
  profile: { id: string; full_name: string; email?: string; phone?: string } | null;
}

export function AdminDealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [dealer, setDealer] = useState<Dealership | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratings, setRatings] = useState<DealerRating[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE' | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const [
        { data: dData, error: dErr },
        { data: distData },
        { data: duData },
        { data: qData },
        { data: bData },
        { data: rData },
        { data: repData },
        { data: audData },
      ] = await Promise.all([
        supabase.from('dealerships').select('*').eq('id', id).maybeSingle(),
        supabase.from('districts').select('*'),
        supabase.from('dealer_users').select('id, role, user_id').eq('dealership_id', id),
        supabase.from('quotations').select('*').eq('dealership_id', id).order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').eq('dealership_id', id).order('created_at', { ascending: false }),
        supabase.from('dealer_ratings').select('*').eq('dealership_id', id).order('created_at', { ascending: false }),
        supabase.from('reports').select('*').eq('dealership_id', id).order('created_at', { ascending: false }),
        supabase.from('audit_log').select('*').eq('entity_type', 'dealership').eq('entity_id', id).order('created_at', { ascending: false }),
      ]);

      if (dErr) throw dErr;
      if (!dData) throw new Error('Dealership record not found.');

      setDealer(dData as Dealership);
      setDistricts((distData || []) as District[]);
      setQuotes((qData || []) as Quotation[]);
      setBookings((bData || []) as Booking[]);
      setRatings((rData || []) as DealerRating[]);
      setReports((repData || []) as Report[]);
      setHistory((audData || []) as AuditLogEntry[]);

      const userIds = (duData || []).map((x: any) => x.user_id).filter(Boolean);
      const profMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', userIds);
        (profs || []).forEach((p: any) => profMap.set(p.id, p));
      }
      setStaff(
        (duData || []).map((du: any) => ({
          id: du.id,
          role: du.role,
          profile: profMap.get(du.user_id) || null,
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dealer detail.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleConfirmStatus = async (reason: string) => {
    if (!dealer || !actionType) return;
    const { error: rpcErr } = await supabase.rpc('admin_set_dealership_status', {
      p_dealership_id: dealer.id,
      p_action: actionType,
      p_reason: reason || null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    toast({
      type: 'success',
      title: 'Status Updated',
      message: `${dealer.name} updated via ${actionType}.`,
    });
    await loadDetail();
  };

  const districtLookup = new Map(districts.map((d) => [d.id, `${d.name} (${d.state})`]));
  const visibleRatings = ratings.filter((r) => !r.is_hidden);
  const avgRating =
    visibleRatings.length > 0
      ? (visibleRatings.reduce((acc, r) => acc + r.rating, 0) / visibleRatings.length).toFixed(1)
      : 'N/A';

  return (
    <AdminLayout
      title={dealer?.name || 'Dealership Detail'}
      breadcrumbs={[
        { label: 'Dealers', to: '/admin/dealers' },
        { label: dealer?.name || id || 'Detail' },
      ]}
      headerActions={
        <Link to="/admin/dealers">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            All Dealers
          </Button>
        </Link>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : error || !dealer ? (
        <Card className="p-8 text-center text-xs text-rose-700">{error || 'Dealership not found.'}</Card>
      ) : (
        <div className="space-y-6">
          {/* Header Profile & Action Card */}
          <Card className="p-6 border-slate-200 shadow-subtle">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <h2 className="text-lg font-bold text-slate-900">{dealer.name}</h2>
                  <Badge
                    variant={
                      dealer.status === 'VERIFIED'
                        ? 'success'
                        : dealer.status === 'PENDING'
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {dealer.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">GSTIN</span>
                    <span className="font-mono font-semibold text-slate-900">{dealer.gst_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Primary District</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {districtLookup.get(dealer.district_id) || dealer.district_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Contact</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {dealer.contact_phone}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {dealer.contact_email}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  <strong className="text-slate-800">Address:</strong> {dealer.address}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-700 mr-1">Authorized Brands:</span>
                  {(dealer.brands || []).map((b) => (
                    <Badge key={b} variant="default" size="sm">{b}</Badge>
                  ))}
                </div>

                {(dealer.rejection_reason || dealer.suspension_reason) && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    <strong>Reason Recorded:</strong> {dealer.suspension_reason || dealer.rejection_reason}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                {dealer.status !== 'VERIFIED' && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setActionType(dealer.status === 'PENDING' ? 'APPROVE' : 'REACTIVATE')}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    {dealer.status === 'PENDING' ? 'Approve Showroom' : 'Reactivate Showroom'}
                  </Button>
                )}
                {dealer.status !== 'REJECTED' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setActionType('REJECT')}
                    leftIcon={<XCircle className="w-4 h-4" />}
                  >
                    Reject
                  </Button>
                )}
                {dealer.status === 'VERIFIED' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-amber-300 text-amber-800 hover:bg-amber-50"
                    onClick={() => setActionType('SUSPEND')}
                    leftIcon={<AlertTriangle className="w-4 h-4" />}
                  >
                    Suspend Showroom
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <Card className="p-4 border-slate-200">
              <div className="text-slate-500">Staff Members</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">{staff.length}</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-slate-500">Quotations Submitted</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">{quotes.length}</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-slate-500">Total Bookings</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">{bookings.length}</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-slate-500">Public Rating &amp; Reports</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" /> {avgRating}
                </span>
                <span className="text-slate-300">/</span>
                <span className="inline-flex items-center gap-1 text-rose-700 text-sm">
                  <Flag className="w-3.5 h-3.5" /> {reports.length} reports
                </span>
              </div>
            </Card>
          </div>

          {/* Staff + Quotations + Bookings + Reports + Status History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Showroom Staff ({staff.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs">
                {staff.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No linked dealer_users rows found.</div>
                ) : (
                  staff.map((s) => (
                    <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{s.profile?.full_name || 'User'}</div>
                        <div className="text-[11px] text-slate-500">{s.profile?.email || s.profile?.phone || '—'}</div>
                      </div>
                      <Badge variant="default" size="sm">{s.role}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Status Change History ({history.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No status history recorded yet.</div>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="px-4 py-3 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-900">{h.action}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{formatDateTime(h.created_at)}</span>
                      </div>
                      <div className="text-slate-600">{h.reason || '—'}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Quotations ({quotes.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                {quotes.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No quotations submitted.</div>
                ) : (
                  quotes.map((q) => (
                    <div key={q.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 tabular-nums">{formatINR(q.on_road_price)}</div>
                        <div className="text-[11px] text-slate-500">Group: {q.group_id.slice(0, 8)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={q.is_active === false ? 'danger' : 'success'} size="sm">
                          {q.is_active === false ? 'INACTIVE' : 'ACTIVE'}
                        </Badge>
                        {!q.is_complete && <Badge variant="warning" size="sm">Incomplete</Badge>}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Bookings ({bookings.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                {bookings.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No bookings found.</div>
                ) : (
                  bookings.map((b) => (
                    <Link
                      key={b.id}
                      to={`/admin/bookings/${b.id}`}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-50"
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-900">{b.booking_code}</div>
                        <div className="text-[11px] text-slate-500">{b.buyer_name}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {b.dealer_suspended && <Badge variant="danger" size="sm">Dealer Suspended</Badge>}
                        <Badge variant="default" size="sm">{b.status}</Badge>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ReAuthModal
        isOpen={Boolean(actionType)}
        onClose={() => setActionType(null)}
        title={`Confirm Dealership ${actionType}`}
        description={
          <p>
            Execute <strong>{actionType}</strong> on <strong>{dealer?.name}</strong>?
            {actionType === 'SUSPEND' &&
              ' Live quotes will be deactivated and PAID bookings flagged as dealer suspended.'}
          </p>
        }
        confirmLabel="Confirm"
        confirmVariant={actionType === 'APPROVE' || actionType === 'REACTIVATE' ? 'success' : 'danger'}
        requireReason={actionType === 'REJECT' || actionType === 'SUSPEND'}
        requirePassword={actionType === 'SUSPEND' || actionType === 'REACTIVATE'}
        onConfirm={handleConfirmStatus}
      />
    </AdminLayout>
  );
}
