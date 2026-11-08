import { useState, useEffect } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { DealerRating, Report } from '@/types';
import { Star, Flag, ShieldCheck } from 'lucide-react';

export function DealerRatingsReportsPage() {
  const { dealership } = useAuth();

  const [ratings, setRatings] = useState<DealerRating[]>([
    {
      id: 'r-1',
      booking_id: 'bk-1',
      dealership_id: dealership?.id || 'dl-1',
      buyer_id: 'u-1',
      rating: 5,
      review: 'Seamless delivery! Honored the exact locked quotation without any hidden charges or pushed extras.',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'r-2',
      booking_id: 'bk-2',
      dealership_id: dealership?.id || 'dl-1',
      buyer_id: 'u-2',
      rating: 5,
      review: 'Great group discount coordination. The showroom team was courteous and transparent.',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    // Read local ratings and reports
    const savedRatings = localStorage.getItem('autogroup_local_ratings');
    if (savedRatings) {
      try {
        setRatings(JSON.parse(savedRatings));
      } catch {
        // ignore
      }
    }
    const savedReports = localStorage.getItem('autogroup_local_reports');
    if (savedReports) {
      try {
        setReports(JSON.parse(savedReports));
      } catch {
        // ignore
      }
    }
  }, []);

  const averageRating =
    ratings.length > 0
      ? (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1)
      : '5.0';

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

        {/* Rating summary banner */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-black text-slate-900">{averageRating}</div>
            <div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-500" />
                ))}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Based on {ratings.length} verified deliveries
              </div>
            </div>
          </div>

          <Badge variant="success" size="md">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            Pricing Integrity Compliant
          </Badge>
        </div>

        {/* Ratings list */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Delivered Customer Reviews ({ratings.length})
          </h2>

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
                    <Badge variant="danger" size="sm">Under Audit</Badge>
                  </div>
                  <p className="text-slate-600">{rep.details}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DealerLayout>
  );
}
