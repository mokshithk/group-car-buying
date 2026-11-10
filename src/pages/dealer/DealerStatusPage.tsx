import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dealership } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import { XCircle, AlertTriangle, Building2, LogOut, Mail, RefreshCw } from 'lucide-react';

export function DealerStatusPage() {
  const { user, dealership: contextDealership, logout, refreshProfile } = useAuth();
  const [dealership, setDealership] = useState<Dealership | null>(contextDealership);
  const navigate = useNavigate();

  const loadStatus = useCallback(async () => {
    if (!user) return;
    try {
      const { data: du } = await supabase
        .from('dealer_users')
        .select('dealership_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let targetId = du?.dealership_id;
      if (!targetId && user.email) {
        const { data: d } = await supabase
          .from('dealerships')
          .select('id')
          .eq('contact_email', user.email)
          .maybeSingle();
        targetId = d?.id;
      }

      if (targetId) {
        const { data: dRow } = await supabase
          .from('dealerships')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();
        if (dRow) {
          const d = dRow as Dealership;
          setDealership(d);
          if (d.status === 'VERIFIED') {
            navigate('/dealer/dashboard', { replace: true });
          } else if (d.status === 'PENDING') {
            navigate('/dealer/pending', { replace: true });
          }
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load dealer status:', err);
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const status = dealership?.status || 'PENDING';
  const isRejected = status === 'REJECTED';
  const isSuspended = status === 'SUSPENDED';

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5 text-brand-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Auto<span className="text-brand-600">Group</span> <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">DEALER</span>
            </span>
          </Link>
        </div>

        <Card className="shadow-elevated border-slate-200/80 text-center">
          <CardHeader className="pb-4 items-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 border shadow-sm ${
              isRejected ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              {isRejected ? <XCircle className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>

            <CardTitle className="text-xl text-slate-900">
              {isRejected ? 'Dealership Application Rejected' : isSuspended ? 'Dealership Account Suspended' : 'Account Under Review'}
            </CardTitle>

            <CardDescription className="text-sm font-medium text-slate-600 max-w-sm mx-auto leading-relaxed mt-1">
              {isRejected
                ? 'Your dealership registration could not be verified by AutoGroup administration.'
                : 'Your dealership account has been temporarily suspended from bidding on group tenders.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-0 text-left">
            {/* Rejection Details Box */}
            {isRejected && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                <span className="text-xs uppercase tracking-wider font-bold text-rose-900 block">
                  Rejection Reason:
                </span>
                <p className="text-xs text-rose-800 leading-relaxed font-medium">
                  {dealership?.rejection_reason || 'Documentation did not meet verification standards or dealership credentials could not be corroborated.'}
                </p>
              </div>
            )}

            {/* Suspended Details Box */}
            {isSuspended && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <span className="text-xs uppercase tracking-wider font-bold text-amber-900 block">
                  Suspension Notice:
                </span>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  {dealership?.suspension_reason ||
                    'Access to live buyer groups and quotation submission is temporarily paused pending administrative review.'}
                </p>
              </div>
            )}

            {/* Dealership Details */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Showroom Name:</span>
                <span className="font-semibold text-slate-900">{dealership?.name || 'Your Dealership'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GSTIN:</span>
                <span className="font-mono font-semibold text-slate-900">{dealership?.gst_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Official Contact:</span>
                <span className="text-slate-900">{dealership?.contact_email || user?.email}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Questions? Contact platform compliance at <strong>support@autogroup.in</strong></span>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={async () => {
                  await refreshProfile();
                  await loadStatus();
                }}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Re-check Status
              </Button>

              <Button
                variant="primary"
                size="md"
                className="w-full bg-slate-900 hover:bg-slate-800"
                onClick={logout}
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
