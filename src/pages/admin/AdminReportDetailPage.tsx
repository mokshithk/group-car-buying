import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Select } from '@/components/ui';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';

interface ReportDetailData {
  id: string;
  dealership_id: string;
  buyer_id: string;
  reason: string;
  details: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
  admin_notes?: string | null;
  action_taken?: string | null;
  resolved_at?: string | null;
  created_at: string;
  dealership?: { id: string; name: string; status: string; contact_email?: string; contact_phone?: string } | null;
  buyer?: { id: string; full_name: string; email?: string | null; phone?: string | null } | null;
}

export function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [report, setReport] = useState<ReportDetailData | null>(null);
  const [dealerTotalReports, setDealerTotalReports] = useState(0);
  const [status, setStatus] = useState<'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED'>('OPEN');
  const [action, setAction] = useState<'' | 'WARN_DEALER' | 'SUSPEND_DEALER' | 'DISMISS'>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);

  const loadReport = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const { data, error: rErr } = await supabase
        .from('reports')
        .select(
          '*, dealership:dealerships(id, name, status, contact_email, contact_phone), buyer:profiles(id, full_name, email, phone)'
        )
        .eq('id', id)
        .maybeSingle();

      if (rErr) throw rErr;
      if (!data) {
        setError('Report not found.');
      } else {
        const rep = data as ReportDetailData;
        setReport(rep);
        setStatus(rep.status || 'OPEN');
        setAdminNotes(rep.admin_notes || '');

        const { count } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('dealership_id', rep.dealership_id);
        setDealerTotalReports(count || 1);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const executeUpdate = async (finalStatus: string, notesText: string, finalAction: string | null) => {
    if (!report) return;
    const { error: rpcErr } = await supabase.rpc('admin_manage_report', {
      p_report_id: report.id,
      p_status: finalStatus,
      p_admin_notes: notesText.trim() || null,
      p_action: finalAction || null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    toast({
      type: 'success',
      title: 'Report Updated',
      message: `Dispute marked ${finalStatus}${finalAction ? ` (${finalAction})` : ''}.`,
    });
    setAction('');
    await loadReport();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;

    if (action === 'SUSPEND_DEALER') {
      setSuspendModalOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const targetStatus =
        action === 'WARN_DEALER' && status === 'OPEN'
          ? 'INVESTIGATING'
          : action === 'DISMISS'
          ? 'REJECTED'
          : status;

      await executeUpdate(targetStatus, adminNotes, action || null);
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Unable to update report.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Report Investigation"
        breadcrumbs={[
          { label: 'Reports', to: '/admin/reports' },
          { label: 'Loading...' },
        ]}
      >
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !report) {
    return (
      <AdminLayout
        title="Report Not Found"
        breadcrumbs={[
          { label: 'Reports', to: '/admin/reports' },
          { label: 'Error' },
        ]}
      >
        <div className="bg-white border border-rose-200 rounded-xl p-6 text-center space-y-3">
          <div className="text-sm font-bold text-rose-800">{error || 'Report not found'}</div>
          <Link to="/admin/reports">
            <Button size="sm" variant="outline">Back to Reports</Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Dispute Investigation`}
      breadcrumbs={[
        { label: 'Reports', to: '/admin/reports' },
        { label: report.reason },
      ]}
      headerActions={
        <Link to="/admin/reports">
          <Button size="sm" variant="outline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Button>
        </Link>
      }
    >
      <div className="space-y-5 max-w-4xl">
        {dealerTotalReports >= 2 && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Repeat-Offender Flag:</strong> {report.dealership?.name} has accumulated{' '}
              <strong>{dealerTotalReports}</strong> compliance reports across the platform.
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">{report.reason}</h2>
              <div className="text-xs text-slate-500">
                Submitted {new Date(report.created_at).toLocaleString()}
              </div>
            </div>
            <Badge
              variant={
                report.status === 'OPEN'
                  ? 'danger'
                  : report.status === 'INVESTIGATING'
                  ? 'warning'
                  : report.status === 'RESOLVED'
                  ? 'success'
                  : 'default'
              }
            >
              {report.status}
            </Badge>
          </div>

          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            {report.details}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div className="p-3 rounded-lg border border-slate-200">
              <div className="text-slate-500 mb-1">Reported Dealership</div>
              <Link
                to={`/admin/dealers/${report.dealership_id}`}
                className="font-bold text-brand-600 hover:underline text-sm"
              >
                {report.dealership?.name}
              </Link>
              <div className="text-slate-600 mt-0.5">
                Current Status: <strong>{report.dealership?.status}</strong> • Total Reports: {dealerTotalReports}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-200">
              <div className="text-slate-500 mb-1">Reporting Buyer</div>
              <Link
                to={`/admin/buyers/${report.buyer_id}`}
                className="font-bold text-brand-600 hover:underline text-sm"
              >
                {report.buyer?.full_name || 'Buyer'}
              </Link>
              <div className="text-slate-600 mt-0.5">
                {report.buyer?.email || report.buyer?.phone || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Investigation & Enforcement Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Moderation Decision & Audit Notes</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Workflow Status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED')
              }
              options={[
                { value: 'OPEN', label: 'OPEN' },
                { value: 'INVESTIGATING', label: 'INVESTIGATING' },
                { value: 'RESOLVED', label: 'RESOLVED' },
                { value: 'REJECTED', label: 'REJECTED' },
              ]}
            />

            <Select
              label="Enforcement Action"
              value={action}
              onChange={(e) =>
                setAction(e.target.value as '' | 'WARN_DEALER' | 'SUSPEND_DEALER' | 'DISMISS')
              }
              options={[
                { value: '', label: 'Status / Note Update Only' },
                { value: 'WARN_DEALER', label: 'Send Formal Warning Notification to Dealer' },
                { value: 'SUSPEND_DEALER', label: 'Suspend Dealership (Requires Re-Auth)' },
                { value: 'DISMISS', label: 'Dismiss Dispute as Unfounded' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
              Investigation Notes (Shared with Buyer on Update)
            </label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Document verification findings, dealer response, or resolution outcome..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
            />
          </div>

          {report.action_taken && (
            <div className="text-xs text-slate-500">
              Last recorded enforcement action: <strong className="font-mono text-slate-800">{report.action_taken}</strong>
              {report.resolved_at && ` on ${new Date(report.resolved_at).toLocaleString()}`}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant={action === 'SUSPEND_DEALER' ? 'danger' : 'primary'}
              isLoading={isSaving}
            >
              {action === 'SUSPEND_DEALER' ? 'Proceed to Re-Authenticate & Suspend Dealer' : 'Save Decision'}
            </Button>
          </div>
        </form>
      </div>

      <ReAuthModal
        isOpen={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        title={`Suspend ${report.dealership?.name || 'Dealership'}`}
        description={
          <span>
            Suspending this dealership from dispute investigation will freeze all active quotations, block new
            bookings, and flag paid bookings as dealer suspended.
          </span>
        }
        confirmLabel="Suspend Dealership & Resolve Report"
        confirmVariant="danger"
        requireReason={true}
        reasonLabel="Suspension Reason (Required)"
        onConfirm={async (reason) => {
          const combinedNotes = [adminNotes.trim(), reason.trim()].filter(Boolean).join(' — ');
          await executeUpdate('RESOLVED', combinedNotes, 'SUSPEND_DEALER');
          setSuspendModalOpen(false);
        }}
      />
    </AdminLayout>
  );
}
