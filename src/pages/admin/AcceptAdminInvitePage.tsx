import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { OtpVerification } from '@/components/auth/OtpVerification';
import { sha256Hex, validateAdminPassword } from '@/lib/adminHelpers';
import { Button, Badge, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ShieldCheck, AlertCircle, Lock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface InviteValidationResult {
  valid: boolean;
  status?: string;
  reason?: string;
  email?: string;
  role?: 'admin' | 'super_admin';
  convert_existing?: boolean;
  account_exists?: boolean;
  existing_role?: string;
  expires_at?: string;
}

export function AcceptAdminInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();

  const rawToken = searchParams.get('token') || '';
  const [tokenHash, setTokenHash] = useState('');
  const [inviteInfo, setInviteInfo] = useState<InviteValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  const [otpVerified, setOtpVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      if (!rawToken.trim()) {
        if (!cancelled) {
          setInviteInfo({ valid: false, status: 'INVALID', reason: 'No invite token found in URL.' });
          setIsValidating(false);
        }
        return;
      }

      try {
        const hash = await sha256Hex(rawToken.trim());
        if (cancelled) return;
        setTokenHash(hash);

        const { data, error } = await supabase.rpc('validate_admin_invite', {
          p_token_hash: hash,
        });
        if (error) throw error;
        if (!cancelled) {
          setInviteInfo((data || { valid: false, reason: 'Invalid invite token.' }) as InviteValidationResult);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setInviteInfo({
            valid: false,
            reason: err instanceof Error ? err.message : 'Unable to verify invitation token.',
          });
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    }
    validate();
    return () => {
      cancelled = true;
    };
  }, [rawToken]);

  const strength = validateAdminPassword(password);

  const handleSetPasswordAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!inviteInfo?.email) {
      setSubmitError('Invitation email is missing.');
      return;
    }

    if (inviteInfo.account_exists && !currentPassword) {
      setSubmitError('Enter your current account password to confirm account conversion.');
      return;
    }

    if (!strength.valid) {
      setSubmitError(strength.error || 'Password does not meet admin security policy.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (inviteInfo.account_exists) {
        // Existing buyer/dealer explicitly allowed via convert_existing: sign in & upgrade password
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: inviteInfo.email,
          password: currentPassword,
        });
        if (signInErr) throw signInErr;

        const { error: pwErr } = await supabase.auth.updateUser({ password });
        if (pwErr) throw pwErr;
      } else {
        // Brand-new admin account: email already verified via .env.local SMTP OTP; create session via signUp
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: inviteInfo.email,
          password,
          options: {
            data: {
              full_name: inviteInfo.email.split('@')[0],
              role: 'buyer',
            },
          },
        });
        if (signUpErr) throw signUpErr;
        if (!signUpData.session) {
          throw new Error(
            'Supabase did not issue an immediate session (Confirm email must be OFF when using local .env SMTP OTP).'
          );
        }
      }

      const { error: acceptErr } = await supabase.rpc('accept_admin_invite', {
        p_token_hash: tokenHash,
      });
      if (acceptErr) throw acceptErr;

      if (inviteInfo.account_exists) {
        await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
      }

      await refreshProfile();
      toast({
        type: 'success',
        title: 'Administrator Access Activated',
        message: `Welcome! You are now signed in as ${inviteInfo.role || 'admin'}.`,
      });
      navigate('/admin/dashboard', { replace: true });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to activate administrator account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="flex flex-col items-center gap-3 text-slate-600 text-sm">
          <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
          <span>Validating administrator invitation...</span>
        </div>
      </div>
    );
  }

  // Blocked or invalid invite states
  const blockedExistingNonAdmin =
    Boolean(inviteInfo?.valid && inviteInfo?.account_exists && !inviteInfo?.convert_existing);

  if (!inviteInfo?.valid || blockedExistingNonAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            {blockedExistingNonAdmin ? 'Existing Account Cannot Be Converted' : 'Invalid or Expired Invitation'}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {blockedExistingNonAdmin
              ? `The email ${inviteInfo?.email} is already registered as a ${inviteInfo?.existing_role || 'buyer/dealer'} account. Ask a super_admin to issue an invite explicitly flagged to convert an existing account.`
              : inviteInfo?.reason || 'This administrator invitation is invalid, expired, or has already been used.'}
          </p>
          <div className="pt-2">
            <Link to="/login">
              <Button variant="primary" size="sm">Go to Sign In</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AutoGroup Administration Invite</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 pt-1">Accept Administrator Invitation</h1>
          <p className="text-xs text-slate-600">
            Invited email: <strong>{inviteInfo.email}</strong> • Role:{' '}
            <Badge variant="brand" size="sm">{inviteInfo.role}</Badge>
          </p>
        </div>

        {!otpVerified ? (
          <OtpVerification
            email={inviteInfo.email || ''}
            type="signup"
            title="Verify Invited Email Address"
            description={`Enter the 6-digit OTP sent to ${inviteInfo.email} via your local SMTP portal before setting your administrator password.`}
            onSuccess={() => setOtpVerified(true)}
          />
        ) : (
          <form onSubmit={handleSetPasswordAndAccept} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Email OTP verified. Set your administrator password (min 12 characters).</span>
            </div>

            {submitError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {inviteInfo.account_exists && (
              <Input
                label="Current Account Password *"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
                autoComplete="current-password"
              />
            )}

            <Input
              label="New Admin Password *"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              autoComplete="new-password"
            />

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-700">Password Strength Requirements</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                <span className="flex items-center gap-1.5">
                  {strength.hasMinLength ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  At least 12 characters
                </span>
                <span className="flex items-center gap-1.5">
                  {strength.hasUpper && strength.hasLower ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  Upper &amp; lowercase letters
                </span>
                <span className="flex items-center gap-1.5 sm:col-span-2">
                  {strength.hasNumber || strength.hasSymbol ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  At least one number or special character
                </span>
              </div>
            </div>

            <Input
              label="Confirm Password *"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              autoComplete="new-password"
            />

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isSubmitting}>
              Complete Setup &amp; Open Admin Console
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
