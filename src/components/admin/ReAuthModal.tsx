import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Modal, Button, Input } from '@/components/ui';
import { Lock, AlertCircle } from 'lucide-react';

export interface ReAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  requirePassword?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * Confirmation modal enforcing mandatory reasons and password re-authentication
 * for sensitive administrative actions (invites, settings, suspensions, forced refunds).
 */
export function ReAuthModal({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm Action',
  confirmVariant = 'danger',
  requireReason = false,
  reasonLabel = 'Reason (Required)',
  reasonPlaceholder = 'Provide specific operational reason for the audit log...',
  requirePassword = true,
  onConfirm,
}: ReAuthModalProps) {
  const { reauthenticate } = useAuth();
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setPassword('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (requireReason && reason.trim().length < 5) {
      setError('Please enter a clear reason (at least 5 characters) for the audit record.');
      return;
    }

    if (requirePassword && !password) {
      setError('Please enter your administrator password to confirm this action.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (requirePassword) {
        const authRes = await reauthenticate(password);
        if (!authRes.success) {
          setError(authRes.error || 'Incorrect password. Re-authentication failed.');
          setIsSubmitting(false);
          return;
        }
      }

      await onConfirm(reason.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !isSubmitting && onClose()} title={title} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-xs text-slate-600 leading-relaxed">{description}</div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {requireReason && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {reasonLabel} <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[84px]"
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
        )}

        {requirePassword && (
          <div className="pt-1">
            <Input
              label="Re-enter Your Admin Password"
              type="password"
              placeholder="Confirm current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              helperText="Required for audit attribution before executing this action."
            />
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={confirmVariant}
            size="sm"
            isLoading={isSubmitting}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
