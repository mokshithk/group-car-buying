import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Mail, ArrowRight, RefreshCw, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';

interface OtpVerificationProps {
  email: string;
  type: 'signup' | 'recovery';
  title?: string;
  description?: string;
  onSuccess: () => void | Promise<void>;
  onChangeEmail?: () => void;
}

export function OtpVerification({
  email,
  type,
  title,
  description,
  onSuccess,
  onChangeEmail,
}: OtpVerificationProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendNotice, setResendNotice] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 1. Auto-focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // 2. 60-second cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Handle individual digit change
  const handleChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const digit = cleaned.slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Auto-focus next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on 6th digit (Requirement D.1)
    if (next.every((d) => d.length === 1)) {
      handleVerify(undefined, next.join(''));
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste support (splits 6 digits across all boxes & auto-submits)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasteData[i] || '';
    }
    setDigits(next);

    if (pasteData.length === 6) {
      handleVerify(undefined, pasteData);
    } else {
      const targetIndex = Math.min(pasteData.length, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  // Verify OTP submission
  const handleVerify = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const token = codeOverride || digits.join('');
    if (token.length < 6) {
      setError('Please enter all 6 digits of the code.');
      return;
    }

    setError('');
    setIsVerifying(true);

    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token,
        type,
      });

      if (verifyErr) {
        let friendlyMsg = verifyErr.message;
        if (friendlyMsg.toLowerCase().includes('expired')) {
          friendlyMsg = 'This verification code has expired. Please click "Resend Code" for a new one.';
        } else if (friendlyMsg.toLowerCase().includes('invalid')) {
          friendlyMsg = 'Invalid verification code. Please check your email inbox and enter the 6-digit code.';
        } else if (friendlyMsg.toLowerCase().includes('rate limit')) {
          friendlyMsg = 'Too many attempts. Please wait a few moments before trying again.';
        }
        setError(friendlyMsg);
        setIsVerifying(false);
        return;
      }

      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed.';
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP with cooldown
  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setError('');
    setIsResending(true);
    setResendNotice('');

    try {
      let resendErr = null;
      if (type === 'recovery') {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
        resendErr = resetErr;
      } else {
        const { error: signupResendErr } = await supabase.auth.resend({
          type: 'signup',
          email,
        });
        resendErr = signupResendErr;
      }

      if (resendErr) {
        let msg = resendErr.message;
        if (msg.toLowerCase().includes('rate limit')) {
          msg = 'Resend rate limit exceeded. Please check your spam folder or wait before requesting again.';
        }
        setError(msg);
      } else {
        setResendCooldown(60);
        setResendNotice('A fresh 6-digit code has been sent to your email.');
        // Reset inputs and focus first box
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code.';
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <Card className="shadow-elevated border-slate-200/80 max-w-md mx-auto">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mx-auto mb-3">
          <Mail className="w-7 h-7" />
        </div>
        <CardTitle className="text-xl text-slate-900">
          {title || 'Verify Your Email'}
        </CardTitle>
        <CardDescription className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed mt-1">
          {description || (
            <>
              We sent a 6-digit code to <strong className="text-slate-900">{email}</strong>
              {onChangeEmail && (
                <button
                  type="button"
                  onClick={onChangeEmail}
                  className="block mx-auto mt-1 font-semibold text-brand-600 hover:text-brand-700 underline text-[11px]"
                >
                  Change email address
                </button>
              )}
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resendNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{resendNotice}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          {/* 6 Digit Input Boxes */}
          <div className="flex justify-between items-center gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                autoComplete="one-time-code"
                aria-label={`Digit ${i + 1}`}
                className="w-12 h-14 text-center text-2xl font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all shadow-subtle"
              />
            ))}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full font-semibold"
            isLoading={isVerifying}
            disabled={!isComplete || isVerifying}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Verify & Continue
          </Button>
        </form>

        {/* Resend Cooldown and Change Email Actions */}
        <div className="space-y-3 pt-3 border-t border-slate-100 text-center text-xs">
          <div className="flex items-center justify-center gap-1.5 text-slate-500">
            <span>Didn&apos;t receive the code?</span>
            {resendCooldown > 0 ? (
              <span className="font-semibold text-slate-700">
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                Resend Code
              </button>
            )}
          </div>

          {onChangeEmail && (
            <div>
              <button
                type="button"
                onClick={onChangeEmail}
                className="text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Change Email Address
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
