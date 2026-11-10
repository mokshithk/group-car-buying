import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { validatePlatformSetting } from '@/lib/adminHelpers';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Input } from '@/components/ui';
import { Save, Lock, Info, Loader2 } from 'lucide-react';

interface SettingRow {
  key: string;
  value: string;
  description: string | null;
  updated_at?: string;
}

const SETTING_SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: 'Pricing & Booking Rules',
    keys: [
      'booking_amount',
      'platform_fee',
      'buyer_cancel_retention_percent',
      'fee_refund_on_dealer_fault',
    ],
  },
  {
    title: 'Group Visibility & Lifecycle',
    keys: [
      'visibility_member_threshold',
      'group_visibility_days_for_2_members',
      'group_expiry_days_for_1_member',
      'default_group_target',
    ],
  },
  {
    title: 'Quotations, Delivery & Fraud Integrity',
    keys: [
      'dealer_delivery_fallback_days',
      'quote_validity_default_days',
      'suspicious_group_member_threshold',
      'suspicious_group_window_minutes',
      'quote_outlier_threshold_percent',
    ],
  },
];

export function AdminSettingsPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [pendingUpdate, setPendingUpdate] = useState<{
    key: string;
    oldValue: string;
    newValue: string;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: sErr } = await supabase
        .from('settings')
        .select('*')
        .order('key', { ascending: true });

      if (sErr) throw sErr;
      const rows = (data || []) as SettingRow[];
      setSettings(rows);

      const drafts: Record<string, string> = {};
      for (const r of rows) {
        drafts[r.key] = r.value;
      }
      setDraftValues(drafts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load platform settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const currentMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }, [settings]);

  const settingsByKey = useMemo(() => {
    const map = new Map<string, SettingRow>();
    for (const s of settings) map.set(s.key, s);
    return map;
  }, [settings]);

  const handleRequestSave = (key: string) => {
    const existing = settingsByKey.get(key);
    const oldValue = existing?.value ?? '';
    const newValue = (draftValues[key] ?? '').trim();

    if (newValue === oldValue) {
      toast({ type: 'info', title: 'No Change', message: `"${key}" already equals "${oldValue}".` });
      return;
    }

    const check = validatePlatformSetting(key, newValue, currentMap);
    if (!check.valid) {
      toast({ type: 'error', title: 'Validation Error', message: check.error || 'Invalid value.' });
      return;
    }

    setPendingUpdate({ key, oldValue, newValue });
  };

  const confirmUpdateSetting = async () => {
    if (!pendingUpdate) return;
    const { error: rpcErr } = await supabase.rpc('admin_update_setting', {
      p_key: pendingUpdate.key,
      p_value: pendingUpdate.newValue,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    toast({
      type: 'success',
      title: 'Setting Updated',
      message: `${pendingUpdate.key} changed from "${pendingUpdate.oldValue}" to "${pendingUpdate.newValue}".`,
    });
    setPendingUpdate(null);
    await loadSettings();
  };

  const remainingKeys = useMemo(() => {
    const known = new Set(SETTING_SECTIONS.flatMap((s) => s.keys));
    return settings.map((s) => s.key).filter((k) => !known.has(k));
  }, [settings]);

  const renderSettingRow = (key: string) => {
    const row = settingsByKey.get(key);
    if (!row) return null;
    const draft = draftValues[key] ?? row.value;
    const isDirty = draft.trim() !== row.value;
    const validation = isDirty ? validatePlatformSetting(key, draft, currentMap) : { valid: true };
    const isBool = key === 'fee_refund_on_dealer_fault';

    return (
      <div
        key={key}
        className="p-4 border-b border-slate-100 last:border-b-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
              {key}
            </code>
            <span className="text-[11px] text-slate-500">
              Current saved value: <strong className="text-slate-800">{row.value}</strong>
            </span>
          </div>
          {row.description && <p className="text-xs text-slate-600">{row.description}</p>}
          {!validation.valid && (
            <p className="text-xs font-medium text-rose-700">{validation.error}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isBool ? (
            <select
              aria-label={key}
              disabled={!isSuperAdmin}
              value={draft}
              onChange={(e) => setDraftValues((prev) => ({ ...prev, [key]: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <div className="w-36">
              <Input
                aria-label={key}
                disabled={!isSuperAdmin}
                value={draft}
                onChange={(e) => setDraftValues((prev) => ({ ...prev, [key]: e.target.value }))}
                className="font-mono text-right"
              />
            </div>
          )}

          {isSuperAdmin && (
            <Button
              size="sm"
              aria-label={`Save ${key}`}
              variant={isDirty ? 'primary' : 'outline'}
              disabled={!isDirty || !validation.valid}
              onClick={() => handleRequestSave(key)}
              leftIcon={<Save className="w-3.5 h-3.5" />}
              className="whitespace-nowrap"
            >
              Save
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout
      title="Platform Settings"
      breadcrumbs={[{ label: 'Settings' }]}
    >
      <div className="space-y-5 max-w-5xl">
        {/* Governance & Snapshot Note */}
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-800">
          <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div>
              <strong>Forward-Only Policy:</strong> Changes apply only to newly created groups, quotations, and bookings. Existing bookings preserve their locked{' '}
              <code className="bg-white px-1 rounded border border-slate-200">price_snapshot</code> and deposit amounts.
            </div>
            <div>
              Hard constraint: <code className="bg-white px-1 rounded border border-slate-200">booking_amount + platform_fee &lt; 10000</code> INR.
            </div>
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Read-Only View:</strong> Modifying platform settings requires <Badge variant="brand" size="sm">super_admin</Badge> privileges.
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white border border-rose-200 rounded-xl p-6 text-center space-y-2">
            <div className="text-sm font-bold text-rose-800">{error}</div>
            <Button size="sm" variant="outline" onClick={loadSettings}>Retry</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {SETTING_SECTIONS.map((sec) => (
              <div key={sec.title} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">{sec.title}</h2>
                </div>
                <div>{sec.keys.map((k) => renderSettingRow(k))}</div>
              </div>
            ))}

            {remainingKeys.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Additional Settings</h2>
                </div>
                <div>{remainingKeys.map((k) => renderSettingRow(k))}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <ReAuthModal
        isOpen={Boolean(pendingUpdate)}
        onClose={() => setPendingUpdate(null)}
        title={`Update Setting: ${pendingUpdate?.key || ''}`}
        description={
          pendingUpdate && (
            <div className="space-y-1">
              <p>Review the setting change before recording it in the audit log:</p>
              <div className="p-2 rounded bg-slate-100 font-mono text-xs text-slate-900">
                <div>Previous value: <strong>{pendingUpdate.oldValue}</strong></div>
                <div>New value: <strong>{pendingUpdate.newValue}</strong></div>
              </div>
            </div>
          )
        }
        confirmLabel="Confirm & Apply Setting"
        confirmVariant="primary"
        requireReason={false}
        onConfirm={confirmUpdateSetting}
      />
    </AdminLayout>
  );
}
