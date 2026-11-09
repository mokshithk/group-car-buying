import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dealership, District } from '@/types';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import { Clock, RefreshCw, ShieldAlert, LogOut, Building2, MapPin, Phone, Mail, FileText } from 'lucide-react';

export function PendingApprovalPage() {
  const { dealership: authDealership, user, refreshProfile, logout } = useAuth();
  const [dealership, setDealership] = useState<Dealership | null>(authDealership);
  const [district, setDistrict] = useState<District | null>(null);
  const [isLoading, setIsLoading] = useState(!authDealership);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  // Load real dealership data directly from Supabase
  const loadDealershipData = async () => {
    if (!user) return;
    try {
      // 1. Check dealer_users
      const { data: du } = await supabase
        .from('dealer_users')
        .select('dealership_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let targetDealerId = du?.dealership_id;

      // 2. Fallback check by contact_email if dealer_users not linked
      if (!targetDealerId && user.email) {
        const { data: directDealer } = await supabase
          .from('dealerships')
          .select('id')
          .eq('contact_email', user.email)
          .maybeSingle();
        targetDealerId = directDealer?.id;
      }

      if (targetDealerId) {
        const { data: dealerData } = await supabase
          .from('dealerships')
          .select('*')
          .eq('id', targetDealerId)
          .maybeSingle();

        if (dealerData) {
          const d = dealerData as Dealership;
          setDealership(d);

          // If dealership has been verified, redirect immediately to dealer dashboard
          if (d.status === 'VERIFIED') {
            navigate('/dealer/dashboard', { replace: true });
            return;
          }

          // If rejected or suspended, navigate to dealer status page
          if (d.status === 'REJECTED' || d.status === 'SUSPENDED') {
            navigate('/dealer/status', { replace: true });
            return;
          }

          // Resolve district name
          if (d.district_id) {
            const { data: distData } = await supabase
              .from('districts')
              .select('*')
              .eq('id', d.district_id)
              .maybeSingle();
            if (distData) {
              setDistrict(distData as District);
            }
          }
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load pending dealership record:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDealershipData();
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    await loadDealershipData();
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-xl">
        <Card className="shadow-elevated border-slate-200/80">
          <CardHeader className="text-center pb-4 items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-2 shadow-sm">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <CardTitle className="text-xl text-slate-900">Application Under Review</CardTitle>
            <CardDescription className="text-sm font-medium text-slate-600 max-w-md mx-auto">
              Your dealership is awaiting verification by AutoGroup administration.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-2">
            {/* Live Database Record Card */}
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Verification Status</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" /> {dealership?.status || 'PENDING'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">Showroom Name</span>
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    {dealership?.name || (isLoading ? 'Loading...' : 'Pending Showroom Record')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">GSTIN Number</span>
                  <span className="font-mono font-semibold text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    {dealership?.gst_number || (isLoading ? 'Loading...' : 'Not Provided')}
                  </span>
                </div>
              </div>

              {/* Brands */}
              <div>
                <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium mb-1.5">Authorized OEM Brands</span>
                <div className="flex flex-wrap gap-1.5">
                  {dealership?.brands && dealership.brands.length > 0 ? (
                    dealership.brands.map((b) => (
                      <Badge key={b} variant="default" className="bg-white border-slate-200 text-slate-800 font-medium px-2 py-0.5">
                        {b}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-500 italic">No brands selected</span>
                  )}
                </div>
              </div>

              {/* District & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">Operating District</span>
                  <span className="text-slate-800 font-medium flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {district ? `${district.name} (${district.state})` : (isLoading ? 'Loading district...' : 'District pending')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">Contact Phone</span>
                  <span className="text-slate-800 font-medium flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {dealership?.contact_phone || user?.phone || 'Not provided'}
                  </span>
                </div>
              </div>

              {dealership?.address && (
                <div className="pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">Showroom Address</span>
                  <span className="text-slate-700 block mt-0.5 leading-relaxed">{dealership.address}</span>
                </div>
              )}

              {dealership?.contact_email && (
                <div className="pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-medium">Official Email</span>
                  <span className="text-slate-800 font-medium flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {dealership.contact_email}
                  </span>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                To maintain consumer trust and pricing integrity on AutoGroup, every showroom registration undergoes verification before gaining access to local group tenders.
              </p>
              <p>
                Your dealership is awaiting verification. Once verified, you will have immediate access to live tender requests in your district.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full font-semibold"
                onClick={handleRefresh}
                isLoading={isRefreshing}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Check Approval Status
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
