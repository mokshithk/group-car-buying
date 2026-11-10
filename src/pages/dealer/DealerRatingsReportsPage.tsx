import { useState, useEffect } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DealerRating, Report } from '@/types';
import { Star, Flag, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

export function DealerRatingsReportsPage() {
  const { dealership } = useAuth();

  const [ratings, setRatings] = useState<DealerRating[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!dealership?.id || !isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([
      supabase
        .from('dealer_ratings')
        .select('id, booking_id, dealership_id, buyer_id, rating, review, is_hidden, created_at')
        .eq('dealership_id', dealership.id)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('id, dealership_id, buyer_id, reason, details, status, action_taken, created_at')
        .eq('dealership_id', dealership.id)
        .order('created_at', { ascending: false }),
    ])
      .then(([ratRes, repRes]) => {
        if (cancelled) return;
        if (ratRes.error) {
          setLoadError(ratRes.error.message);
        } else if (repRes.error) {
          setLoadError(repRes.error.message);
        }
        setRatings((ratRes.data || []) as DealerRating[]);
        setReports((repRes.data || []) as Report[]);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load ratings and compliance records.');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dealership?.id]);

  const averageRating =
    ratings.length > 0
      ? (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1)
      : '—';

  return (
    <DealerLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Customer Ratings & Showroom Compliance
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Read-only feedback from verified customers who completed vehicle deliveries at your dealership.
          </p>
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Rating summary banner */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-black text-slate-900 tabular-nums">{averageRating}</div>
            <div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      ratings.length > 0 && s <= Math.round(Number(averageRating))
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Based on {ratings.length} verified deliveries
              </div>
            </div>
          </div>

          <Badge variant={reports.length === 0 ? 'success' : 'warning'} size="md">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            {reports.length === 0 ? 'Pricing Integrity Compliant' : `${reports.length} Report(s) Logged`}
          </Badge>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
          </div>
        ) : (
          <>
            {/* Ratings list */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Delivered Customer Reviews ({ratings.length})
              </h2>

              {ratings.length === 0 ? (
                <Card className="p-6 text-center text-xs text-slate-500 bg-slate-50/50">
                  No verified buyer reviews published yet.
                </Card>
              ) : (
                <div className="space-y-3">
                  {ratings.map((r) => (
                    <Card key={r.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= r.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {r.review && <p className="text-xs text-slate-700 leading-relaxed">{r.review}</p>}
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Compliance Reports (Read-only) */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Pricing Dispute Reports ({reports.length})
                </h2>
              </div>

              {reports.length === 0 ? (
                <Card className="p-6 text-center text-xs text-slate-500 bg-slate-50/50">
                  No pricing or honor reports logged against this showroom. Full integrity record maintained.
                </Card>
              ) : (
                <div className="space-y-3">
                  {reports.map((rep) => (
                    <Card key={rep.id} className="p-4 border-rose-200 bg-rose-50/20 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-900">Dispute: {rep.reason}</span>
                        <Badge variant="danger" size="sm">
                          {(rep as Report & { status?: string }).status || 'OPEN'}
                        </Badge>
                      </div>
                      <p className="text-slate-600">{rep.details}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DealerLayout>
  );
}
