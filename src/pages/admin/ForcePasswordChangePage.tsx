import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { validateAdminPassword, isAdminRole } from '@/lib/adminHelpers';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, LogOut } from 'lucide-react';

export function ForcePasswordChangePage() {
  const { user, profile, mustChangePassword, completeAdminPasswordUpdate, logout } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile && !isAdminRole(profile.role)) {
    return <Navigate to="/" replace />;
  }

  if (profile && !mustChangePassword) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const strength = validateAdminPassword(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!strength.valid) {
      setError(strength.error || 'Password does not meet security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await completeAdminPasswordUpdate(newPassword, true);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to set new password.');
      return;
    }

    navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto shadow-subtle">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Set a New Admin Password</h1>
          <p className="text-xs text-slate-600">
            First-time sign-in requires replacing your temporary bootstrap password before opening any admin tools.
          </p>
        </div>

        <Card className="border-slate-200 shadow-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">Security Setup</CardTitle>
            <CardDescription className="text-xs">
              Signed in as <strong className="text-slate-900">{user.email}</strong> ({profile?.role})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  label="New Password (Min 12 Characters)"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter a strong passphrase"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <div className={`flex items-center gap-1 ${strength.hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>12+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1 ${strength.hasUpper && strength.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Upper &amp; lowercase</span>
                  </div>
                  <div className={`flex items-center gap-1 ${strength.hasNumber || strength.hasSymbol ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Number or symbol</span>
                  </div>
                  <div className={`flex items-center gap-1 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              <Input
                label="Confirm New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-semibold"
                isLoading={isSubmitting}
                disabled={!strength.valid || !passwordsMatch}
              >
                Save New Password &amp; Continue
              </Button>
            </form>

            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
