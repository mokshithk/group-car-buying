import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Clock, RefreshCw, CheckCircle, ShieldAlert, LogOut } from 'lucide-react';

export function PendingApprovalPage() {
  const { dealership, refreshProfile, logout, setMockSession } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
    if (dealership?.status === 'VERIFIED') {
      navigate('/dealer/dashboard', { replace: true });
    }
  };

  const handleSimulateApproval = () => {
    if (dealership) {
      setMockSession('dealer', undefined, { ...dealership, status: 'VERIFIED' });
      navigate('/dealer/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-lg">
        <Card className="shadow-elevated border-slate-200/80 text-center">
          <CardHeader className="pb-2 items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-2">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <CardTitle className="text-xl text-slate-900">Application Under Review</CardTitle>
            <CardDescription className="text-sm">
              Your dealership account is currently <strong>PENDING VERIFICATION</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4 text-left">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Dealership:</span>
                <span className="font-semibold text-slate-900">{dealership?.name || 'Your Dealership'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GSTIN:</span>
                <span className="font-mono text-slate-800">{dealership?.gst_number || 'Under Review'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                  <ShieldAlert className="w-3 h-3" /> PENDING
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                To maintain consumer trust and pricing integrity on AutoGroup, every showroom registration undergoes manual dealer verification before gaining access to local group tenders.
              </p>
              <p className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-blue-900 font-medium">
                💡 <strong>Admin Verification:</strong> Run the approval SQL snippet from <code>supabase/RUN_ME_FIRST.md</code> in your Supabase SQL editor to mark this dealership as <code>VERIFIED</code>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={handleRefresh}
                isLoading={isRefreshing}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Check Approval Status
              </Button>
              <Button
                variant="secondary"
                className="w-full text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={handleSimulateApproval}
                leftIcon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
              >
                Simulate Instant Approval
              </Button>
            </div>

            <div className="pt-2 text-center border-t border-slate-100">
              <button
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
