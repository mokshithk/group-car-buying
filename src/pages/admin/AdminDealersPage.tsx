import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dealership, DealershipStatus, District } from '@/types';
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  Modal,
} from '@/components/ui';
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  LogOut,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

interface ExtendedDealership extends Dealership {
  owner_name?: string;
  district_name?: string;
  district_state?: string;
}

export function AdminDealersPage() {
  const { user, profile, logout } = useAuth();
  const [dealerships, setDealerships] = useState<ExtendedDealership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DealershipStatus>('ALL');

  // Modal states
  const [selectedDealer, setSelectedDealer] = useState<ExtendedDealership | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'SUSPEND' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Fetch dealerships and districts
  const fetchAllData = async () => {
    setIsLoading(true);
    setActionError('');
    try {
      // 1. Fetch all districts for lookup
      const { data: distData } = await supabase.from('districts').select('*');
      const distList: District[] = (distData as District[]) || [];

      const distMap = new Map<string, District>();
      distList.forEach((d) => distMap.set(d.id, d));

      // 2. Fetch all dealerships
      const { data: dealerData, error: dealerErr } = await supabase
        .from('dealerships')
        .select('*')
        .order('created_at', { ascending: false });

      if (dealerErr) throw dealerErr;

      // 3. Fetch dealer_users with profiles to resolve owner names
      const { data: duData } = await supabase
        .from('dealer_users')
        .select('dealership_id, user_id, role');

      const ownerUserIds = (duData || [])
        .filter((du) => du.role === 'owner')
        .map((du) => du.user_id);

      let ownerMap = new Map<string, string>(); // dealership_id -> owner_name
      if (ownerUserIds.length > 0) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerUserIds);

        const profMap = new Map<string, string>();
        (profData || []).forEach((p) => profMap.set(p.id, p.full_name));

        (duData || []).forEach((du) => {
          if (du.role === 'owner' && profMap.has(du.user_id)) {
            ownerMap.set(du.dealership_id, profMap.get(du.user_id)!);
          }
        });
      }

      // Map combined data
      const extended: ExtendedDealership[] = (dealerData || []).map((d: any) => {
        const dist = d.district_id ? distMap.get(d.district_id) : undefined;
        return {
          ...d,
          owner_name: ownerMap.get(d.id) || 'Showroom Signatory',
          district_name: dist?.name,
          district_state: dist?.state,
        };
      });

      setDealerships(extended);
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch admin dealerships:', err);
      }
      setActionError(err instanceof Error ? err.message : 'Failed to load dealerships');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter dealerships by status and search query
  const filteredDealerships = dealerships.filter((d) => {
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      d.name.toLowerCase().includes(query) ||
      (d.gst_number && d.gst_number.toLowerCase().includes(query)) ||
      (d.owner_name && d.owner_name.toLowerCase().includes(query)) ||
      (d.district_name && d.district_name.toLowerCase().includes(query)) ||
      (d.brands && d.brands.some((b) => b.toLowerCase().includes(query))) ||
      (d.contact_email && d.contact_email.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  // Execute verification action (Approve, Reject, Suspend)
  const handleConfirmAction = async () => {
    if (!selectedDealer || !actionType || !user) return;

    if (actionType === 'REJECT' && (!rejectionReason || rejectionReason.trim().length < 5)) {
      setActionError('Please provide a specific rejection reason for the dealership.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');

    try {
      const newStatus: DealershipStatus =
        actionType === 'APPROVE'
          ? 'VERIFIED'
          : actionType === 'REJECT'
          ? 'REJECTED'
          : 'SUSPENDED';

      const now = new Date().toISOString();

      // 1. Update dealership status in database
      const updatePayload: Record<string, any> = {
        status: newStatus,
        updated_at: now,
      };

      if (actionType === 'APPROVE') {
        updatePayload.verified_at = now;
        updatePayload.rejection_reason = null;
      } else if (actionType === 'REJECT') {
        updatePayload.rejection_reason = rejectionReason.trim();
      }

      const { error: updateErr } = await supabase
        .from('dealerships')
        .update(updatePayload)
        .eq('id', selectedDealer.id);

      if (updateErr) throw updateErr;

      // 2. Write to audit_log (Section F.2)
      try {
        await supabase.from('audit_log').insert({
          entity_type: 'dealership',
          entity_id: selectedDealer.id,
          action: `DEALER_${actionType}`,
          actor_id: user.id,
          payload: {
            previous_status: selectedDealer.status,
            new_status: newStatus,
            showroom_name: selectedDealer.name,
            reason: actionType === 'REJECT' ? rejectionReason.trim() : undefined,
            actor_email: user.email,
          },
        });
      } catch (auditErr) {
        if (import.meta.env.DEV) {
          console.warn('Audit log write warning:', auditErr);
        }
      }

      // 3. Create in-app notification for the dealer user (Section F.2)
      try {
        const { data: du } = await supabase
          .from('dealer_users')
          .select('user_id')
          .eq('dealership_id', selectedDealer.id)
          .maybeSingle();

        if (du?.user_id) {
          const notifTitle =
            actionType === 'APPROVE'
              ? 'Dealership Verification Approved!'
              : actionType === 'REJECT'
              ? 'Dealership Application Rejected'
              : 'Dealership Account Suspended';

          const notifMsg =
            actionType === 'APPROVE'
              ? 'Congratulations! Your showroom credentials have been verified. You now have full access to local district group tenders.'
              : actionType === 'REJECT'
              ? `Your showroom verification was rejected. Reason: ${rejectionReason.trim()}`
              : 'Your dealership account has been temporarily suspended by platform administration.';

          await supabase.from('notifications').insert({
            user_id: du.user_id,
            title: notifTitle,
            message: notifMsg,
            type: actionType === 'APPROVE' ? 'DEALER_APPROVAL' : 'SYSTEM',
          });
        }
      } catch (notifErr) {
        if (import.meta.env.DEV) {
          console.warn('Dealer notification write warning:', notifErr);
        }
      }

      setActionSuccess(
        `Dealership "${selectedDealer.name}" was successfully updated to ${newStatus}.`
      );
      setSelectedDealer(null);
      setActionType(null);
      setRejectionReason('');

      // Refresh listings
      await fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update dealership status.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status badge styling
  const renderStatusBadge = (status: DealershipStatus) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <Badge variant="success" className="font-semibold gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="warning" className="font-semibold gap-1 bg-amber-50 text-amber-800 border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> PENDING
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="danger" className="font-semibold gap-1">
            <XCircle className="w-3.5 h-3.5" /> REJECTED
          </Badge>
        );
      case 'SUSPENDED':
        return (
          <Badge variant="default" className="font-semibold gap-1 bg-slate-200 text-slate-800 border-slate-300">
            <AlertCircle className="w-3.5 h-3.5" /> SUSPENDED
          </Badge>
        );
    }
  };

  const countByStatus = {
    ALL: dealerships.length,
    PENDING: dealerships.filter((d) => d.status === 'PENDING').length,
    VERIFIED: dealerships.filter((d) => d.status === 'VERIFIED').length,
    REJECTED: dealerships.filter((d) => d.status === 'REJECTED').length,
    SUSPENDED: dealerships.filter((d) => d.status === 'SUSPENDED').length,
  };

  return (
    <div className="min-h-screen bg-surface-canvas flex flex-col">
      {/* Admin Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-subtle">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Auto<span className="text-brand-600">Group</span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
            ADMIN PORTAL
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-600 hidden sm:inline">
            Signed in as <strong>{profile?.full_name || user?.email}</strong>
          </span>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-semibold px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Hub Title & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Dealership Verification & Compliance
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review showroom onboarding applications, verify OEM authorizations, and enforce bidding compliance.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAllData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh Records
          </Button>
        </div>

        {/* Success / Error Alerts */}
        {actionSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {actionSuccess}
            </span>
            <button
              onClick={() => setActionSuccess('')}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {actionError}
            </span>
            <button
              onClick={() => setActionError('')}
              className="text-rose-700 hover:text-rose-900 text-sm font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Filter Controls & Search */}
        <Card className="shadow-subtle border-slate-200/80">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 border-b md:border-b-0 pb-2 md:pb-0">
                {(['ALL', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const).map((tab) => {
                  const isActive = statusFilter === tab;
                  const count = countByStatus[tab];
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all inline-flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{tab === 'ALL' ? 'All Dealerships' : tab}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="w-full md:w-72">
                <Input
                  type="text"
                  placeholder="Search showroom, GST, brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dealerships Table / Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
            Loading dealership records...
          </div>
        ) : filteredDealerships.length === 0 ? (
          <Card className="p-12 text-center text-slate-500 text-xs space-y-2">
            <Building2 className="w-8 h-8 mx-auto text-slate-400" />
            <p className="font-semibold text-slate-800 text-sm">No dealerships found</p>
            <p className="text-slate-500 max-w-sm mx-auto">
              No dealership matching your active status filter and search query was found.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredDealerships.map((d) => (
              <Card key={d.id} className="shadow-subtle border-slate-200 hover:border-slate-300 transition-all p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left Column: Showroom Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-brand-600 shrink-0" />
                        {d.name}
                      </h3>
                      {renderStatusBadge(d.status)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Owner: <strong className="text-slate-800">{d.owner_name}</strong></span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>GSTIN: <strong className="text-slate-800">{d.gst_number || 'N/A'}</strong></span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          District:{' '}
                          <strong className="text-slate-800">
                            {d.district_name ? `${d.district_name} (${d.district_state})` : 'Registered District'}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{d.contact_phone || 'No phone'}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{d.contact_email}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Applied: {new Date(d.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Address & Brands */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <p className="text-slate-500 leading-relaxed max-w-xl">
                        <strong className="text-slate-700">Address:</strong> {d.address}
                      </p>

                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-slate-400 text-[11px] font-semibold uppercase mr-1">Brands:</span>
                        {d.brands && d.brands.length > 0 ? (
                          d.brands.map((b) => (
                            <Badge key={b} variant="default" className="bg-slate-100 text-slate-800 text-[11px] px-2 py-0.5">
                              {b}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </div>
                    </div>

                    {/* Rejection notice if rejected */}
                    {d.status === 'REJECTED' && d.rejection_reason && (
                      <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                        <strong>Rejection Reason:</strong> {d.rejection_reason}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions (Approve, Reject, Suspend) */}
                  <div className="flex flex-row lg:flex-col gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0">
                    {d.status !== 'VERIFIED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
                        onClick={() => {
                          setSelectedDealer(d);
                          setActionType('APPROVE');
                          setActionError('');
                        }}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        Approve Showroom
                      </Button>
                    )}

                    {d.status !== 'REJECTED' && (
                      <Button
                        variant="danger"
                        size="sm"
                        className="font-semibold"
                        onClick={() => {
                          setSelectedDealer(d);
                          setActionType('REJECT');
                          setRejectionReason('');
                          setActionError('');
                        }}
                        leftIcon={<XCircle className="w-4 h-4" />}
                      >
                        Reject Application
                      </Button>
                    )}

                    {d.status === 'VERIFIED' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-amber-700 hover:bg-amber-50 border-amber-300 font-semibold"
                        onClick={() => {
                          setSelectedDealer(d);
                          setActionType('SUSPEND');
                          setActionError('');
                        }}
                        leftIcon={<AlertTriangle className="w-4 h-4" />}
                      >
                        Suspend Account
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Modals (Approve / Reject / Suspend) */}
      <Modal
        isOpen={!!selectedDealer && !!actionType}
        onClose={() => {
          if (!isSubmitting) {
            setSelectedDealer(null);
            setActionType(null);
            setActionError('');
          }
        }}
        title={
          actionType === 'APPROVE'
            ? 'Confirm Dealership Approval'
            : actionType === 'REJECT'
            ? 'Reject Dealership Application'
            : 'Suspend Dealership Account'
        }
      >
        <div className="space-y-4 py-2">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {actionType === 'APPROVE' && (
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Are you sure you want to approve and verify{' '}
                <strong className="text-slate-900">{selectedDealer?.name}</strong>?
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900">
                <p className="font-semibold">Approval unlocks:</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                  <li>Full access to district vehicle purchasing tenders</li>
                  <li>Direct quotation submission privileges</li>
                  <li>Real-time interested buyer lead contacts</li>
                </ul>
              </div>
            </div>
          )}

          {actionType === 'REJECT' && (
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Rejecting <strong className="text-slate-900">{selectedDealer?.name}</strong> will prevent them from accessing tender quotations. The applicant will see this reason on their status page.
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Rejection Reason (Required)*
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 min-h-[90px]"
                  placeholder="e.g. GSTIN could not be verified against the official OEM dealership franchise directory."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {actionType === 'SUSPEND' && (
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Are you sure you want to temporarily suspend{' '}
                <strong className="text-slate-900">{selectedDealer?.name}</strong>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900">
                <p className="font-semibold">Account suspension will:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                  <li>Immediately revoke access to live group tenders</li>
                  <li>Grey out live showroom quotes from buyer comparisons</li>
                  <li>Display a suspension notice upon dealership login</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setSelectedDealer(null);
                setActionType(null);
                setActionError('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'APPROVE' ? 'primary' : 'danger'}
              size="md"
              className={actionType === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={handleConfirmAction}
              isLoading={isSubmitting}
            >
              {actionType === 'APPROVE'
                ? 'Confirm Approval'
                : actionType === 'REJECT'
                ? 'Confirm Rejection'
                : 'Confirm Suspension'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
