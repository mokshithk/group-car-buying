import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatINR } from '@/lib/formatters';
import { Group, Booking, AuditLogEntry, GroupMember } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from '@/components/ui';
import { ArrowLeft, AlertTriangle, Users, UserMinus, XCircle, Clock } from 'lucide-react';

export function AdminGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [isVisibleToDealers, setIsVisibleToDealers] = useState(false);
  const [rapidJoinHint, setRapidJoinHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [action, setAction] = useState<'CANCEL' | 'EXPIRE' | 'REMOVE_MEMBER' | 'FLAG_SUSPICIOUS' | 'UNFLAG_SUSPICIOUS' | null>(null);
  const [memberTarget, setMemberTarget] = useState<GroupMember | null>(null);

  const loadGroupDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const [
        { data: gData, error: gErr },
        { data: mData },
        { data: bData },
        { data: sData },
        { data: audData },
      ] = await Promise.all([
        supabase
          .from('groups')
          .select('*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*)')
          .eq('id', id)
          .maybeSingle(),
        supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', id).order('joined_at', { ascending: true }),
        supabase.from('bookings').select('*').eq('group_id', id).order('created_at', { ascending: false }),
        supabase.from('settings').select('key, value'),
        supabase.from('audit_log').select('*').eq('entity_type', 'group').eq('entity_id', id).order('created_at', { ascending: false }),
      ]);

      if (gErr) throw gErr;
      if (!gData) throw new Error('Group not found.');

      const g = gData as Group;
      const mList = (mData || []) as GroupMember[];
      setGroup(g);
      setMembers(mList);
      setBookings((bData || []) as Booking[]);
      setHistory((audData || []) as AuditLogEntry[]);

      const settingsMap = new Map((sData || []).map((s: any) => [s.key, s.value]));
      const visThreshold = Number(settingsMap.get('visibility_member_threshold') || 3);
      const visDays = Number(settingsMap.get('group_visibility_days_for_2_members') || 20);
      const suspThreshold = Number(settingsMap.get('suspicious_group_member_threshold') || 5);
      const suspWindowMins = Number(settingsMap.get('suspicious_group_window_minutes') || 60);

      const activeMembers = mList.filter((m) => m.status === 'ACTIVE');
      const daysOld = Math.floor((Date.now() - new Date(g.created_at).getTime()) / 86400000);
      const isOpen = ['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED'].includes(g.status);
      setIsVisibleToDealers(
        isOpen && (activeMembers.length >= visThreshold || (activeMembers.length === 2 && daysOld >= visDays))
      );

      // Compute automatic rapid-join suspicious hint
      const timestamps = activeMembers.map((m) => new Date(m.joined_at).getTime()).sort((a, b) => a - b);
      let maxInWindow = 0;
      for (let i = 0; i < timestamps.length; i++) {
        let count = 0;
        for (let j = i; j < timestamps.length; j++) {
          if (timestamps[j] - timestamps[i] <= suspWindowMins * 60 * 1000) count++;
        }
        if (count > maxInWindow) maxInWindow = count;
      }
      if (maxInWindow >= suspThreshold) {
        setRapidJoinHint(
          `Automatic hint: ${maxInWindow} members joined within ${suspWindowMins} minutes (threshold: ${suspThreshold}).`
        );
      } else {
        setRapidJoinHint(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load group details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadGroupDetail();
  }, [loadGroupDetail]);

  const executeGroupAction = async (reason: string) => {
    if (!group || !action) return;
    const { error: rpcErr } = await supabase.rpc('admin_manage_group', {
      p_group_id: group.id,
      p_action: action,
      p_member_user_id: action === 'REMOVE_MEMBER' ? memberTarget?.user_id : null,
      p_reason: reason || null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    toast({ type: 'success', title: 'Group Updated', message: `Action ${action} applied.` });
    await loadGroupDetail();
  };

  return (
    <AdminLayout
      title={group ? `${group.variant?.model?.name || 'Group'} (${group.variant?.name || ''})` : 'Group Detail'}
      breadcrumbs={[
        { label: 'Groups', to: '/admin/groups' },
        { label: group?.variant?.name || id || 'Detail' },
      ]}
      headerActions={
        <Link to="/admin/groups">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            All Groups
          </Button>
        </Link>
      }
    >
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : error || !group ? (
        <Card className="p-8 text-center text-xs text-rose-700">{error || 'Not found'}</Card>
      ) : (
        <div className="space-y-6">
          {(group.is_suspicious || rapidJoinHint) && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <strong>Suspicious Activity Alert:</strong>{' '}
                {group.suspicious_reason || rapidJoinHint}
              </div>
            </div>
          )}

          <Card className="p-6 border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand">{group.variant?.model?.manufacturer?.name}</Badge>
                  <Badge variant={group.status === 'CANCELLED' || group.status === 'EXPIRED' ? 'danger' : 'success'}>
                    {group.status}
                  </Badge>
                  <Badge variant={isVisibleToDealers ? 'success' : 'default'}>
                    {isVisibleToDealers ? 'Visible to Dealers' : 'Hidden (< threshold)'}
                  </Badge>
                </div>
                <div className="text-sm text-slate-600">
                  District: <strong className="text-slate-900">{group.district?.name} ({group.district?.state})</strong> •
                  Created: <span className="tabular-nums">{formatDateTime(group.created_at)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Bookings so far: <strong className="text-slate-900 tabular-nums">{bookings.length}</strong> •
                  Active Members: <strong className="text-slate-900 tabular-nums">{members.filter((m) => m.status === 'ACTIVE').length} / {group.target_members}</strong>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(group.status) && (
                  <>
                    <Button variant="danger" size="sm" onClick={() => setAction('CANCEL')} leftIcon={<XCircle className="w-3.5 h-3.5" />}>
                      Cancel Group
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setAction('EXPIRE')} leftIcon={<Clock className="w-3.5 h-3.5" />}>
                      Expire Now
                    </Button>
                  </>
                )}
                {group.is_suspicious ? (
                  <Button variant="secondary" size="sm" onClick={() => setAction('UNFLAG_SUSPICIOUS')}>
                    Clear Suspicious Flag
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-rose-700 border-rose-200 hover:bg-rose-50"
                    onClick={() => setAction('FLAG_SUSPICIOUS')}
                    leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
                  >
                    Flag Suspicious
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Full Member Details (Admin sees full name, email, phone) */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                Members ({members.length}) — Full Admin View
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Name</th>
                    <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Email</th>
                    <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Phone</th>
                    <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Status</th>
                    <th className="px-4 py-2.5 font-semibold uppercase text-[10px]">Joined</th>
                    <th className="px-4 py-2.5 font-semibold uppercase text-[10px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <Link to={`/admin/buyers/${m.user_id}`} className="hover:text-brand-600">
                          {m.profile?.full_name || m.user_id}
                        </Link>
                        {m.is_creator && <Badge variant="brand" size="sm" className="ml-2">Creator</Badge>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.profile?.email || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{m.profile?.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={m.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{m.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{formatDateTime(m.joined_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {m.status === 'ACTIVE' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-700 hover:bg-rose-50"
                            leftIcon={<UserMinus className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setMemberTarget(m);
                              setAction('REMOVE_MEMBER');
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Group Bookings ({bookings.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs">
                {bookings.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No bookings from this group yet.</div>
                ) : (
                  bookings.map((b) => (
                    <Link key={b.id} to={`/admin/bookings/${b.id}`} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-mono font-bold text-slate-900">{b.booking_code}</div>
                        <div className="text-[11px] text-slate-500">{b.buyer_name} • {formatINR(b.price_snapshot?.on_road_price)}</div>
                      </div>
                      <Badge variant="default" size="sm">{b.status}</Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm">Admin Action History ({history.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 text-xs">
                {history.length === 0 ? (
                  <div className="p-6 text-slate-500 text-center">No admin changes recorded.</div>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="px-4 py-3 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-mono font-semibold text-slate-900">{h.action}</span>
                        <span className="text-slate-400 tabular-nums">{formatDateTime(h.created_at)}</span>
                      </div>
                      <div className="text-slate-600">{h.reason || '—'}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ReAuthModal
        isOpen={Boolean(action)}
        onClose={() => {
          setAction(null);
          setMemberTarget(null);
        }}
        title={`Confirm Group Action: ${action}`}
        description={
          action === 'REMOVE_MEMBER' ? (
            <p>Remove <strong>{memberTarget?.profile?.full_name}</strong> from this group?</p>
          ) : (
            <p>Execute <strong>{action}</strong> on this buying group?</p>
          )
        }
        confirmLabel="Confirm"
        confirmVariant={action === 'UNFLAG_SUSPICIOUS' ? 'primary' : 'danger'}
        requireReason={action === 'CANCEL' || action === 'REMOVE_MEMBER' || action === 'FLAG_SUSPICIOUS'}
        requirePassword={false}
        onConfirm={executeGroupAction}
      />
    </AdminLayout>
  );
}
