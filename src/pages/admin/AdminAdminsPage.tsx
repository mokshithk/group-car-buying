import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { generateInviteToken, sha256Hex } from '@/lib/adminHelpers';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Modal, Input, Select } from '@/components/ui';
import { UserPlus, Copy, Mail, RefreshCw, Ban, ShieldAlert, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface AdminUserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: 'admin' | 'super_admin';
  status: string;
  last_sign_in_at: string | null;
  created_at: string;
}

interface AdminInviteRow {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  convert_existing: boolean;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export function AdminAdminsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [invites, setInvites] = useState<AdminInviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form modal -> ReAuth confirmation
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'super_admin'>('admin');
  const [convertExisting, setConvertExisting] = useState(false);
  const [pendingCreateInviteReauth, setPendingCreateInviteReauth] = useState(false);

  // One-time revealed invite link banner (held only in memory for this view)
  const [generatedLinkInfo, setGeneratedLinkInfo] = useState<{
    email: string;
    role: string;
    url: string;
    emailedAutomatically: boolean;
  } | null>(null);

  // Action ReAuth state for revoke / resend / admin status change
  const [pendingAction, setPendingAction] = useState<
    | { type: 'REVOKE_INVITE'; invite: AdminInviteRow }
    | { type: 'RESEND_INVITE'; invite: AdminInviteRow }
    | {
        type: 'ADMIN_STATUS';
        target: AdminUserRow;
        action: 'DEACTIVATE' | 'REACTIVATE' | 'PROMOTE_SUPER' | 'DEMOTE_ADMIN';
      }
    | null
  >(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [aRes, iRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, role, status, last_sign_in_at, created_at')
          .in('role', ['admin', 'super_admin'])
          .order('created_at', { ascending: true }),
        supabase
          .from('admin_invites')
          .select('id, email, role, status, convert_existing, expires_at, created_at, accepted_at')
          .order('created_at', { ascending: false }),
      ]);

      if (aRes.error) throw aRes.error;
      if (iRes.error) throw iRes.error;

      setAdmins((aRes.data || []) as AdminUserRow[]);
      setInvites((iRes.data || []) as AdminInviteRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load administrators and invites.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeSuperAdminCount = useMemo(
    () => admins.filter((a) => a.role === 'super_admin' && (a.status || 'ACTIVE') === 'ACTIVE').length,
    [admins]
  );

  const handleOpenInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inviteEmail.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@')) {
      toast({ type: 'error', title: 'Invalid Email', message: 'Enter a valid email address.' });
      return;
    }
    setInviteFormOpen(false);
    setPendingCreateInviteReauth(true);
  };

  const trySendOptionalInviteEmail = async (email: string, role: string, inviteUrl: string): Promise<boolean> => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-admin-invite', {
        body: { email, role, inviteUrl },
      });
      if (!fnErr && data && (data as { sent?: boolean }).sent) {
        return true;
      }
    } catch {
      // Optional Edge Function not deployed — fallback banner + mailto remains available
    }
    return false;
  };

  const confirmCreateInvite = async () => {
    const rawToken = generateInviteToken();
    const tokenHash = await sha256Hex(rawToken);
    const cleanedEmail = inviteEmail.trim().toLowerCase();

    const { error: rpcErr } = await supabase.rpc('admin_create_invite', {
      p_email: cleanedEmail,
      p_role: inviteRole,
      p_token_hash: tokenHash,
      p_convert_existing: convertExisting,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    const inviteUrl = `${window.location.origin}/admin/accept-invite?token=${encodeURIComponent(rawToken)}`;
    const emailedAutomatically = await trySendOptionalInviteEmail(cleanedEmail, inviteRole, inviteUrl);

    setGeneratedLinkInfo({
      email: cleanedEmail,
      role: inviteRole,
      url: inviteUrl,
      emailedAutomatically,
    });
    setPendingCreateInviteReauth(false);
    setInviteEmail('');
    setInviteRole('admin');
    setConvertExisting(false);
    toast({
      type: 'success',
      title: 'Admin Invitation Created',
      message: emailedAutomatically
        ? `Invite created and email dispatched to ${cleanedEmail}.`
        : 'Copy the one-time invite link shown below or open it in your email client.',
    });
    await loadData();
  };

  const handleResendInvite = async (invite: AdminInviteRow) => {
    try {
      const rawToken = generateInviteToken();
      const tokenHash = await sha256Hex(rawToken);
      const { error: rpcErr } = await supabase.rpc('admin_resend_invite', {
        p_invite_id: invite.id,
        p_new_token_hash: tokenHash,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      const inviteUrl = `${window.location.origin}/admin/accept-invite?token=${encodeURIComponent(rawToken)}`;
      const emailedAutomatically = await trySendOptionalInviteEmail(invite.email, invite.role, inviteUrl);
      setGeneratedLinkInfo({
        email: invite.email,
        role: invite.role,
        url: inviteUrl,
        emailedAutomatically,
      });
      toast({
        type: 'success',
        title: 'Invitation Rotated & Resent',
        message: 'A new one-time invite token is valid for 7 days.',
      });
      await loadData();
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Resend Failed',
        message: err instanceof Error ? err.message : 'Unable to resend invite.',
      });
    }
  };

  const handleConfirmPendingAction = async (reason: string) => {
    if (!pendingAction) return;
    if (pendingAction.type === 'REVOKE_INVITE') {
      const { error: rpcErr } = await supabase.rpc('admin_revoke_invite', {
        p_invite_id: pendingAction.invite.id,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      toast({ type: 'success', title: 'Invite Revoked', message: `Revoked invite for ${pendingAction.invite.email}.` });
      setPendingAction(null);
      await loadData();
    } else if (pendingAction.type === 'RESEND_INVITE') {
      await handleResendInvite(pendingAction.invite);
      setPendingAction(null);
    } else {
      const { error: rpcErr } = await supabase.rpc('admin_set_admin_status', {
        p_target_user_id: pendingAction.target.id,
        p_action: pendingAction.action,
        p_reason: reason,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      toast({ type: 'success', title: 'Admin Updated', message: 'Administrator permissions updated.' });
      setPendingAction(null);
      await loadData();
    }
  };

  const adminColumns: ColumnDef<AdminUserRow>[] = [
    {
      key: 'name',
      header: 'Administrator',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <span>{row.full_name}</span>
            {row.id === currentUser?.id && (
              <Badge variant="default" size="sm">You</Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-500">{row.email || '—'}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge variant={row.role === 'super_admin' ? 'brand' : 'default'} size="sm">
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'last_sign_in',
      header: 'Last Sign-In',
      render: (row) => (
        <span className="text-xs text-slate-600 tabular-nums">
          {row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        (row.status || 'ACTIVE') === 'ACTIVE' ? (
          <Badge variant="success" size="sm">Active</Badge>
        ) : (
          <Badge variant="danger" size="sm">Deactivated</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const isSelf = row.id === currentUser?.id;
        const isLastSuper =
          row.role === 'super_admin' && (row.status || 'ACTIVE') === 'ACTIVE' && activeSuperAdminCount <= 1;
        const active = (row.status || 'ACTIVE') === 'ACTIVE';

        return (
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {row.role === 'admin' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isSelf}
                onClick={() => setPendingAction({ type: 'ADMIN_STATUS', target: row, action: 'PROMOTE_SUPER' })}
              >
                Promote Super
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isSelf || isLastSuper}
                title={isLastSuper ? 'Cannot demote the last active super_admin' : undefined}
                onClick={() => setPendingAction({ type: 'ADMIN_STATUS', target: row, action: 'DEMOTE_ADMIN' })}
              >
                Demote Admin
              </Button>
            )}

            {active ? (
              <Button
                size="sm"
                variant="danger"
                disabled={isSelf || isLastSuper}
                title={isLastSuper ? 'Cannot deactivate the last active super_admin' : undefined}
                onClick={() => setPendingAction({ type: 'ADMIN_STATUS', target: row, action: 'DEACTIVATE' })}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="success"
                disabled={isSelf}
                onClick={() => setPendingAction({ type: 'ADMIN_STATUS', target: row, action: 'REACTIVATE' })}
              >
                Reactivate
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const inviteColumns: ColumnDef<AdminInviteRow>[] = [
    {
      key: 'email',
      header: 'Invited Email',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-900">{row.email}</div>
          {row.convert_existing && (
            <div className="text-[10px] font-semibold text-amber-700">Convert existing account allowed</div>
          )}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Target Role',
      render: (row) => (
        <Badge variant={row.role === 'super_admin' ? 'brand' : 'default'} size="sm">
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        if (row.status === 'ACCEPTED') return <Badge variant="success" size="sm">Accepted</Badge>;
        if (row.status === 'PENDING') return <Badge variant="warning" size="sm">Pending</Badge>;
        if (row.status === 'REVOKED') return <Badge variant="danger" size="sm">Revoked</Badge>;
        return <Badge variant="default" size="sm">Expired</Badge>;
      },
    },
    {
      key: 'expires_at',
      header: 'Expires',
      render: (row) => (
        <span className="text-xs text-slate-600 tabular-nums">
          {new Date(row.expires_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {(row.status === 'PENDING' || row.status === 'EXPIRED') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPendingAction({ type: 'RESEND_INVITE', invite: row })}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Resend
            </Button>
          )}
          {row.status === 'PENDING' && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setPendingAction({ type: 'REVOKE_INVITE', invite: row })}
            >
              <Ban className="w-3.5 h-3.5 mr-1" /> Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  const mailtoHref = generatedLinkInfo
    ? `mailto:${encodeURIComponent(generatedLinkInfo.email)}?subject=${encodeURIComponent(
        'AutoGroup Administrator Invitation'
      )}&body=${encodeURIComponent(
        `You have been invited to join AutoGroup as an administrator (${generatedLinkInfo.role}).\n\nOpen this one-time link to verify your email via 6-digit OTP and set your password (valid for 7 days):\n${generatedLinkInfo.url}`
      )}`
    : '#';

  return (
    <AdminLayout
      title="Admins & Invitations"
      breadcrumbs={[{ label: 'Admins & Invites' }]}
      headerActions={
        <Button
          size="sm"
          variant="primary"
          onClick={() => setInviteFormOpen(true)}
          leftIcon={<UserPlus className="w-3.5 h-3.5" />}
          className="whitespace-nowrap"
        >
          Invite Admin
        </Button>
      }
    >
      <div className="space-y-6">
        {/* One-time Invite Link Banner */}
        {generatedLinkInfo && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    One-Time Invite Link Ready for {generatedLinkInfo.email} ({generatedLinkInfo.role})
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    {generatedLinkInfo.emailedAutomatically
                      ? 'Email notification sent via Edge Function. You can also copy this backup link now — it is hashed in the database and cannot be shown again.'
                      : 'Only the SHA-256 hash is stored in the database. Copy and share this link securely now — it cannot be retrieved after leaving this page.'}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setGeneratedLinkInfo(null)}>
                Dismiss
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2.5 rounded-lg border border-emerald-200">
              <code className="text-[11px] font-mono text-slate-800 break-all flex-1">
                {generatedLinkInfo.url}
              </code>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLinkInfo.url);
                    toast({ type: 'success', title: 'Copied', message: 'Invite URL copied to clipboard.' });
                  }}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                </Button>
                <a
                  href={mailtoHref}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 mr-1" /> Open in email app
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              Administrator Accounts ({admins.length})
            </h2>
            <span className="text-xs text-slate-500">
              Active Super Admins: <strong className="text-slate-900 tabular-nums">{activeSuperAdminCount}</strong>
            </span>
          </div>

          <DataTable
            columns={adminColumns}
            data={admins}
            rowKey={(r) => r.id}
            isLoading={isLoading}
            error={error}
            onRetry={loadData}
            totalCount={admins.length}
            pageSize={50}
            emptyTitle="No administrators"
            emptyDescription="No admin accounts found."
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Admin Invitations ({invites.length})</h2>
          <DataTable
            columns={inviteColumns}
            data={invites}
            rowKey={(r) => r.id}
            isLoading={isLoading}
            error={error}
            onRetry={loadData}
            totalCount={invites.length}
            pageSize={50}
            emptyTitle="No invitations sent"
            emptyDescription="Invite a new administrator using the button above."
          />
        </div>
      </div>

      {/* Invite Admin Details Modal */}
      <Modal isOpen={inviteFormOpen} onClose={() => setInviteFormOpen(false)} title="Invite New Administrator">
        <form onSubmit={handleOpenInviteSubmit} className="space-y-4">
          <Input
            label="Invitee Email Address *"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />

          <Select
            label="Admin Role *"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'super_admin')}
            options={[
              { value: 'admin', label: 'admin (Operations & Moderation)' },
              { value: 'super_admin', label: 'super_admin (Full Control + Settings & Admins)' },
            ]}
          />

          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-xs text-amber-950 cursor-pointer">
            <input
              type="checkbox"
              checked={convertExisting}
              onChange={(e) => setConvertExisting(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <strong>Allow converting existing buyer/dealer account:</strong> Leave unchecked to block pre-existing
              buyer or dealer accounts from accepting this invite.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setInviteFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Continue to Re-Authenticate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Re-auth for Create Invite */}
      <ReAuthModal
        isOpen={pendingCreateInviteReauth}
        onClose={() => setPendingCreateInviteReauth(false)}
        title="Confirm Admin Invitation"
        description={
          <span>
            Confirm creating a 7-day <strong>{inviteRole}</strong> invite for <strong>{inviteEmail}</strong>.
          </span>
        }
        confirmLabel="Create Invite"
        confirmVariant="primary"
        requireReason={false}
        onConfirm={confirmCreateInvite}
      />

      {/* Re-auth for Revoke / Resend / Status Changes */}
      <ReAuthModal
        isOpen={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        title={
          pendingAction?.type === 'REVOKE_INVITE'
            ? `Revoke Invite for ${pendingAction.invite.email}`
            : pendingAction?.type === 'RESEND_INVITE'
            ? `Rotate & Resend Invite for ${pendingAction.invite.email}`
            : pendingAction
            ? `Update Administrator (${pendingAction.target.full_name})`
            : 'Confirm Action'
        }
        description={
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {pendingAction?.type === 'REVOKE_INVITE'
                ? 'This will immediately invalidate the invitation link.'
                : pendingAction?.type === 'RESEND_INVITE'
                ? 'This rotates the SHA-256 invite token, invalidates any prior token, and issues a fresh 7-day link.'
                : `Confirm action "${pendingAction?.action}" on ${pendingAction?.target.email || pendingAction?.target.full_name}.`}
            </span>
          </div>
        }
        confirmLabel="Confirm & Apply"
        confirmVariant={
          pendingAction?.type === 'REVOKE_INVITE' ||
          (pendingAction?.type === 'ADMIN_STATUS' && pendingAction.action === 'DEACTIVATE')
            ? 'danger'
            : 'primary'
        }
        requireReason={pendingAction?.type === 'ADMIN_STATUS'}
        onConfirm={handleConfirmPendingAction}
      />
    </AdminLayout>
  );
}
