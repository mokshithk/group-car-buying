import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { useToast } from '@/components/ui/Toast';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Profile, District, Booking, Report, Interest } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from '@/components/ui';
import { ArrowLeft, User, Phone, Mail, MapPin, ShieldAlert, CheckCircle2 } from 'lucide-react';

export function AdminBuyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [buyer, setBuyer] = useState<Profile | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionType, setActionType] = useState<
    'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE' | 'PROCESS_DELETION' | 'REJECT_DELETION' | null
  >(null);

  const loadBuyer = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const [
        { data: prof, error: pErr },
        { data: gmData },
        { data: intData },
        { data: bookData },
        { data: repData },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase.from('group_members').select('*, group:groups(id, status, variant:variants(name, model:models(name)))').eq('user_id', id).order('joined_at', { ascending: false }),
        supabase.from('interests').select('*, dealership:dealerships(name), quotation:quotations(on_road_price)').eq('user_id', id).order('created_at', { ascending: false }),
        supabase.from('bookings').select('*, dealership:dealerships(name)').eq('buyer_id', id).order('created_at', { ascending: false }),
        supabase.from('reports').select('*, dealership:dealerships(name)').eq('buyer_id', id).order('created_at', { ascending: false }),
      ]);

      if (pErr) throw pErr;
      if (!prof) throw new Error('Buyer profile not found.');

      const p = prof as Profile;
      setBuyer(p);
      setGroups(gmData || []);
      setInterests((intData || []) as Interest[]);
      setBookings((bookData || []) as Booking[]);
      setReports((repData || []) as Report[]);

      if (p.district_id) {
        const { data: d } = await supabase.from('districts').select('*').eq('id', p.district_id).maybeSingle();
        if (d) setDistrict(d as District);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load buyer record.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBuyer();
  }, [loadBuyer]);

  const executeMutation = async (reason: string) => {
    if (!buyer || !actionType) return;
    const { error: rpcErr } = await supabase.rpc('admin_set_buyer_status', {
      p_buyer_id: buyer.id,
      p_action: actionType,
      p_reason: reason || null,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    toast({ type: 'success', title: 'Buyer Updated', message: `Action ${actionType} completed.` });
    await loadBuyer();
  };

  return (
    <AdminLayout
      title={buyer?.full_name || 'Buyer Detail'}
      breadcrumbs={[
        { label: 'Buyers', to: '/admin/buyers' },
        { label: buyer?.full_name || id || 'Detail' },
      ]}
      headerActions={
        <Link to="/admin/buyers">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            All Buyers
          </Button>
        </Link>
      }
    >
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : error || !buyer ? (
        <Card className="p-8 text-center text-xs text-rose-700">{error || 'Not found'}</Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6 border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <User className="w-5 h-5 text-slate-600" />
                  <h2 className="text-lg font-bold text-slate-900">{buyer.full_name}</h2>
                  <Badge variant={(buyer.status || 'ACTIVE') === 'ACTIVE' ? 'success' : 'danger'}>
                    {buyer.status || 'ACTIVE'}
                  </Badge>
                  {buyer.deletion_status === 'PENDING' && (
                    <Badge variant="warning">Deletion Requested</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> {buyer.email || '—'}</div>
                  <div className="flex items-center gap-1.5 font-mono"><Phone className="w-3.5 h-3.5 text-slate-400" /> {buyer.phone || '—'}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {district ? `${district.name} (${district.state})` : '—'}</div>
                </div>

                {buyer.suspension_reason && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    <strong>Status Note:</strong> {buyer.suspension_reason}
                  </div>
                )}

                {buyer.deletion_status === 'PENDING' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>Deletion Request Pending</strong> ({formatDateTime(buyer.deletion_requested_at)})
                      {buyer.deletion_reason ? ` — Reason: ${buyer.deletion_reason}` : ''}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={() => setActionType('PROCESS_DELETION')}>
                        Process Deletion
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setActionType('REJECT_DELETION')}>
                        Dismiss Request
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                {(buyer.status || 'ACTIVE') === 'ACTIVE' ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="border-amber-300 text-amber-800 hover:bg-amber-50"
                      onClick={() => setActionType('SUSPEND')}
                      leftIcon={<ShieldAlert className="w-4 h-4" />}
                    >
                      Suspend Account
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setActionType('DEACTIVATE')}>
                      Deactivate Account
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setActionType('REACTIVATE')}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Reactivate Account
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Groups Joined ({groups.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                {groups.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No group memberships.</div>
                ) : (
                  groups.map((g) => (
                    <Link key={g.id} to={`/admin/groups/${g.group_id}`} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {g.group?.variant?.model?.name} {g.group?.variant?.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{formatDateTime(g.joined_at)}</div>
                      </div>
                      <Badge variant="default" size="sm">{g.status}</Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Bookings ({bookings.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                {bookings.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No bookings recorded.</div>
                ) : (
                  bookings.map((b) => (
                    <Link key={b.id} to={`/admin/bookings/${b.id}`} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-mono font-bold text-slate-900">{b.booking_code}</div>
                        <div className="text-[11px] text-slate-500">{b.dealership?.name} • {formatINR(b.price_snapshot?.on_road_price)}</div>
                      </div>
                      <Badge variant="default" size="sm">{b.status}</Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Interests Expressed ({interests.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                {interests.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No showroom interests.</div>
                ) : (
                  interests.map((i: any) => (
                    <div key={i.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{i.dealership?.name || 'Dealership'}</div>
                        <div className="text-[11px] text-slate-500">{formatINR(i.quotation?.on_road_price)}</div>
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums">{formatDateTime(i.created_at)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Reports Filed ({reports.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                {reports.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No reports filed by this buyer.</div>
                ) : (
                  reports.map((r) => (
                    <Link key={r.id} to={`/admin/reports/${r.id}`} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-900">{r.reason}</div>
                        <div className="text-[11px] text-slate-500">{r.dealership?.name}</div>
                      </div>
                      <Badge variant="default" size="sm">{r.status || 'OPEN'}</Badge>
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
        title={`Confirm Buyer Action: ${actionType}`}
        description={
          <p>
            Execute <strong>{actionType}</strong> for <strong>{buyer?.full_name}</strong>?
          </p>
        }
        confirmLabel="Confirm"
        confirmVariant={actionType === 'REACTIVATE' || actionType === 'REJECT_DELETION' ? 'success' : 'danger'}
        requireReason={actionType === 'SUSPEND' || actionType === 'DEACTIVATE'}
        requirePassword={true}
        onConfirm={executeMutation}
      />
    </AdminLayout>
  );
}
