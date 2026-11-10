import { useState, useEffect, useCallback } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { fetchDealerInterests } from '@/lib/bookingService';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Interest } from '@/types';
import { PhoneCall, User, Phone, CheckCircle2, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

export function DealerLeadsPage() {
  const { dealership } = useAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Interest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadLeads = useCallback(async () => {
    if (!dealership) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const myLeads = await fetchDealerInterests(dealership.id);
      setLeads(myLeads);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load customer leads.');
    } finally {
      setIsLoading(false);
    }
  }, [dealership]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleToggleContacted = async (leadId: string) => {
    const target = leads.find((l: Interest) => l.id === leadId);
    if (target) {
      const nextStatus = !target.contacted;
      const { error } = await supabase
        .from('interests')
        .update({ contacted: nextStatus })
        .eq('id', leadId);

      if (error) {
        toast({ type: 'error', title: 'Update failed', message: error.message });
        return;
      }

      toast({
        type: 'info',
        title: nextStatus ? 'Marked as Contacted' : 'Marked as Pending',
      });
      loadLeads();
    }
  };

  return (
    <DealerLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Interested Customer Leads ({leads.length})
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Verified buyers who expressed interest in your quotations. Contact them directly to schedule showroom test drives.
          </p>
        </div>

        {/* Privacy badge */}
        <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center gap-2.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>RLS Security Enforced:</strong> Showrooms only receive buyer contact phone numbers after explicit customer consent via "I'm Interested" or "Book Now".
          </span>
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading leads...</div>
        ) : leads.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <PhoneCall className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No leads received yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Submit competitive quotations on active tenders to invite interested buyers to connect with your showroom.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {leads.map((lead) => (
              <Card key={lead.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        {lead.buyer?.full_name || 'Interested Buyer'}
                      </span>
                      {lead.contacted ? (
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" /> Contacted
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          <Clock className="w-3 h-3 text-amber-600 mr-1" /> Needs Call
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-slate-600">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        {lead.buyer?.phone ? (
                          <a href={`tel:${lead.buyer.phone}`} className="hover:text-brand-600 underline">
                            {lead.buyer.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 font-normal">Phone unavailable</span>
                        )}
                      </div>
                      <span>•</span>
                      <span>Expressed on {formatDateTime(lead.created_at)}</span>
                    </div>

                    {lead.quotation && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                        Quoted Net On-Road: <strong>{formatINR(lead.quotation.on_road_price)}</strong> (Includes {formatINR(lead.quotation.discounts)} discount)
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex sm:flex-col items-center gap-2">
                    <Button
                      variant={lead.contacted ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => handleToggleContacted(lead.id)}
                      className="w-full text-xs font-semibold"
                    >
                      {lead.contacted ? 'Mark as Uncontacted' : 'Mark as Contacted'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DealerLayout>
  );
}
