import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { validateAdminPassword } from '@/lib/adminHelpers';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Input } from '@/components/ui';
import { Lock, CheckCircle2, XCircle, AlertCircle, LogOut } from 'lucide-react';

export function AdminAccountPage() {
  const { user, profile, reauthenticate } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [isSavingPw, setIsSavingPw] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);

  const strength = validateAdminPassword(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (!currentPassword) {
      setPwError('Enter your current password to continue.');
      return;
    }
    if (!strength.valid) {
      setPwError(strength.error || 'New password does not meet administrator requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }

    setIsSavingPw(true);
    try {
      const check = await reauthenticate(currentPassword);
      if (!check.success) {
        setPwError(check.error || 'Current password is incorrect.');
        setIsSavingPw(false);
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;

      await supabase.rpc('admin_complete_password_change', { p_is_initial_forced: false });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        type: 'success',
        title: 'Password Changed',
        message: 'Your administrator password has been updated cleanly.',
      });
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setIsSavingPw(false);
    }
  };

  const handleSignOutOthers = async () => {
    setIsRevokingSessions(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast({
        type: 'success',
        title: 'Other Sessions Terminated',
        message: 'All other active browser tabs and device sessions have been signed out.',
      });
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Action Failed',
        message: err instanceof Error ? err.message : 'Unable to terminate other sessions.',
      });
    } finally {
      setIsRevokingSessions(false);
    }
  };

  const lastSignInText =
    (profile as { last_sign_in_at?: string | null } | null)?.last_sign_in_at ||
    user?.last_sign_in_at ||
    null;

  return (
    <AdminLayout
      title="My Admin Account"
      breadcrumbs={[{ label: 'My Account' }]}
    >
      <div className="space-y-6 max-w-2xl">
        {/* Identity Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Administrator Profile</h2>
            <Badge variant={profile?.role === 'super_admin' ? 'brand' : 'default'}>
              {profile?.role || 'admin'}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <div className="text-slate-500">Full Name</div>
              <div className="font-semibold text-slate-900">{profile?.full_name || '—'}</div>
            </div>
            <div>
              <div className="text-slate-500">Email Address (Read-Only)</div>
              <div className="font-semibold text-slate-900">{user?.email || profile?.email || '—'}</div>
            </div>
            <div>
              <div className="text-slate-500">Last Sign-In</div>
              <div className="font-semibold text-slate-900 tabular-nums">
                {lastSignInText ? new Date(lastSignInText).toLocaleString() : 'Current session'}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Account Status</div>
              <div className="font-semibold text-emerald-700">{profile?.status || 'ACTIVE'}</div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <form onSubmit={handleChangePassword} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Change Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Administrator passwords require at least 12 characters with mixed case and digits or symbols.
            </p>
          </div>

          {pwError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{pwError}</span>
            </div>
          )}

          <Input
            label="Current Password *"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="current-password"
          />

          <Input
            label="New Password *"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="new-password"
          />

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
            <span className="flex items-center gap-1.5">
              {strength.hasMinLength ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
              )}
              Min 12 characters
            </span>
            <span className="flex items-center gap-1.5">
              {strength.hasUpper && strength.hasLower ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
              )}
              Upper &amp; lowercase
            </span>
            <span className="flex items-center gap-1.5 sm:col-span-2">
              {strength.hasNumber || strength.hasSymbol ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
              )}
              Number or special symbol
            </span>
          </div>

          <Input
            label="Confirm New Password *"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="new-password"
          />

          <div className="flex justify-end">
            <Button type="submit" variant="primary" isLoading={isSavingPw}>
              Update Password
            </Button>
          </div>
        </form>

        {/* Other Sessions Management */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Active Sessions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Revoke refresh tokens across all other browsers and devices while keeping this session signed in.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOutOthers}
            isLoading={isRevokingSessions}
            className="shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out of all other sessions
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
