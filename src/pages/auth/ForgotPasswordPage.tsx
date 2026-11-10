import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Car, Mail, Lock, ArrowLeft, CheckCircle2, ShieldCheck, Eye, EyeOff, KeyRound, AlertCircle, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OtpVerification } from '@/components/auth/OtpVerification';

type ResetStep = 'email' | 'otp' | 'new-password' | 'success';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [smtpError, setSmtpError] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [requestTimestamps, setRequestTimestamps] = useState<number[]>([]);

  // Password reset fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Password strength checks (Section G.4)
  const hasMinLength = newPassword.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(newPassword) && /[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Step 1: Submit email to request recovery OTP (Section G.1 - G.3)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsNotRegistered(false);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    // Client-side rate throttle: max 5 requests per minute (Section G.5)
    const now = Date.now();
    const recentRequests = requestTimestamps.filter((t) => now - t < 60000);
    if (recentRequests.length >= 5) {
      setError('Too many reset requests. Please wait a minute before requesting another code.');
      return;
    }
    setRequestTimestamps([...recentRequests, now]);

    setIsLoading(true);

    try {
      // 1. Check if email is registered using SECURITY DEFINER function (Section G.1 & G.2)
      const { data: isReg, error: rpcErr } = await supabase.rpc('is_email_registered', {
        p_email: cleanEmail,
      });

      if (!rpcErr && isReg === false) {
        setIsNotRegistered(true);
        setError('This email is not registered. Please check the address or create an account.');
        setIsLoading(false);
        return;
      } else if (rpcErr) {
        // Resilient fallback: check public profiles table if RPC has not yet been applied
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (!prof) {
          setIsNotRegistered(true);
          setError('This email is not registered. Please check the address or create an account.');
          setIsLoading(false);
          return;
        }
      }

      // 2. Dispatch recovery code via SMTP portal (/api/auth/send-otp)
      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, type: 'recovery' }),
      });

      const otpData = await otpRes.json().catch(() => null);
      if (!otpRes.ok || !otpData?.success) {
        setError(
          otpData?.error ||
            'Unable to send recovery email. Verify email server (SMTP) settings and API deployment.'
        );
        return;
      }

      // Advance to OTP verification step only after server accepted OTP dispatch
      setChallengeToken(otpData.challengeToken || '');
      setDevOtp(otpData.devOtp || '');
      setSmtpError(otpData.smtpError || '');
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to dispatch recovery code.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Update password after OTP verified session established (Section G.4)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hasMinLength) {
      setError('Password must be at least 8 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The passwords do not match. Please verify your entry.');
      return;
    }

    setIsUpdating(true);

    try {
      const resetRes = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          newPassword,
          verificationToken,
        }),
      });

      const resetData = await resetRes.json().catch(() => null);
      if (!resetRes.ok || !resetData?.success) {
        setError(resetData?.error || 'Failed to update password. Please verify your recovery code again.');
        setIsUpdating(false);
        return;
      }

      // Clear any stale browser session so the user signs in cleanly with the new password
      await supabase.auth.signOut().catch(() => {});
      setVerificationToken('');
      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.';
      setError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // STEP 2: Render OTP verification component (Section G.3 & G.4)
  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
                <Car className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                Auto<span className="text-brand-600">Group</span>
              </span>
            </Link>
          </div>

          <OtpVerification
            email={email}
            type="recovery"
            title="Verify Recovery Code"
            description={`Enter the 6-digit recovery code for ${email}`}
            initialDevOtp={devOtp}
            smtpError={smtpError}
            initialChallengeToken={challengeToken}
            otpAlreadyDispatched={true}
            enableSupabaseLinkAutoDetect={false}
            onSuccess={(verifiedToken) => {
              setError('');
              setVerificationToken(verifiedToken || '');
              setStep('new-password');
            }}
            onChangeEmail={() => {
              setError('');
              setChallengeToken('');
              setVerificationToken('');
              setStep('email');
            }}
          />
        </div>
      </div>
    );
  }

  // STEP 3: Render Set New Password component (Section G.4)
  // Guarded: reachable ONLY after successful recovery OTP
  if (step === 'new-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
                <Car className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                Auto<span className="text-brand-600">Group</span>
              </span>
            </Link>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Set New Password</h2>
            <p className="mt-1 text-sm text-slate-500">
              Identity verified. Choose a strong new password for your account.
            </p>
          </div>

          <Card className="shadow-elevated border-slate-200/80">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 border border-emerald-200">
                <KeyRound className="w-5 h-5" />
              </div>
              <CardTitle className="text-base text-slate-900">Create New Password</CardTitle>
              <CardDescription>
                Your new password must be at least 8 characters long.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <Input
                    label="New Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter at least 8 characters"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Input
                    label="Confirm New Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                  />
                </div>

                {/* Password validation checklist */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasLetterAndNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetterAndNumber ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>Includes letters and numbers or symbols</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>Passwords match</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full font-semibold mt-2"
                  isLoading={isUpdating}
                  disabled={!hasMinLength || !passwordsMatch}
                >
                  Save New Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // STEP 4: Render Success confirmation (Section G.4)
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
                <Car className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                Auto<span className="text-brand-600">Group</span>
              </span>
            </Link>
          </div>

          <Card className="shadow-elevated border-slate-200/80 text-center p-8">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 border border-emerald-100 shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Password Reset Complete</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Your password has been securely updated. You can now log into your account using your new credentials.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-100">
              <Button
                variant="primary"
                size="lg"
                className="w-full font-semibold"
                onClick={() => navigate('/login')}
              >
                Sign In with New Password
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // STEP 1: Request OTP by entering Email (Section G.1 - G.3)
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
              <Car className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Auto<span className="text-brand-600">Group</span>
            </span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Reset Your Password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your registered email to receive a 6-digit recovery code
          </p>
        </div>

        <Card className="shadow-elevated border-slate-200/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-900">Password Recovery</CardTitle>
            <CardDescription>
              We will send a 6-digit recovery code to your registered email address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span className="leading-relaxed">{error}</span>
                  </div>

                  {isNotRegistered && (
                    <div className="pt-1 border-t border-rose-200/60">
                      <Link
                        to="/register"
                        className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-brand-800 underline"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Create an account here
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <Input
                label="Registered Email Address"
                type="email"
                placeholder="name@domain.com"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setIsNotRegistered(false);
                }}
                leftIcon={<Mail className="w-4 h-4" />}
                helperText="We will never share your email address."
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-semibold mt-2"
                isLoading={isLoading}
              >
                Send Recovery Code
              </Button>
              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
