import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchGroupById } from '@/lib/groupService';
import { fetchQuotationsForGroup, isQuoteExpired } from '@/lib/quoteService';
import { formatINR, formatDate } from '@/lib/formatters';
import { Group, Quotation } from '@/types';
import {
  Building2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export function DealerGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { dealership } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);
      const g = await fetchGroupById(id);
      if (g) {
        setGroup(g);
        const qList = await fetchQuotationsForGroup(g.id);
        setQuotes(qList);
      }
      setIsLoading(false);
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <DealerLayout>
        <div className="py-20 text-center text-slate-400">Loading tender data...</div>
      </DealerLayout>
    );
  }

  if (!group) {
    return (
      <DealerLayout>
        <div className="py-20 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Group tender not found</h2>
          <Link to="/dealer/groups">
            <Button variant="secondary" size="sm">Back to Eligible Groups</Button>
          </Link>
        </div>
      </DealerLayout>
    );
  }

  // Calculate live ranking by complete on-road price (Section 3: "you are currently #2 of 4")
  const validCompleteQuotes = quotes
    .filter((q) => q.is_complete && !isQuoteExpired(q.validity_date))
    .sort((a, b) => a.on_road_price - b.on_road_price);

  const myQuote = quotes.find((q) => q.dealership_id === dealership?.id) || quotes[0];
  const myRank = validCompleteQuotes.findIndex((q) => q.id === myQuote?.id) + 1;

  return (
    <DealerLayout>
      <div className="space-y-6">
        <div>
          <Link
            to="/dealer/groups"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Eligible Groups
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="brand">{group.variant?.model?.manufacturer?.name}</Badge>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {group.variant?.model?.name} — {group.variant?.name}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                District: <strong>{group.district?.name}</strong> ·{' '}
                <strong>{group.member_count || 1} Active Buyers</strong> ·{' '}
                <strong className="text-emerald-700">{group.bookings_so_far || 0} Bookings so far</strong>
              </p>
            </div>

            <Link to={`/dealer/groups/${group.id}/quote`}>
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                {myQuote ? 'Revise Your Quotation' : 'Submit Quotation'}
              </Button>
            </Link>
          </div>
        </div>

        {/* LIVE COMPETITIVE RANKING BANNER (Section 3) */}
        {myQuote && myRank > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm">
                #{myRank}
              </div>
              <div>
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Live Quotation Standing
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  You are currently #{myRank} of {validCompleteQuotes.length} active dealer quotes
                </div>
                <div className="text-xs text-slate-300">
                  Your submitted on-road price: <strong>{formatINR(myQuote.on_road_price)}</strong>
                </div>
              </div>
            </div>

            {myRank > 1 && (
              <Link to={`/dealer/groups/${group.id}/quote`}>
                <Button variant="secondary" size="sm" className="bg-white text-slate-900 hover:bg-slate-100 font-bold">
                  Sharpen Price to Compete for #1
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* ALL COMPETITORS' QUOTES VIEWER (Section 2 & 3: dealer names & full breakdown) */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base text-slate-900">
              Live Competitor Bidding Breakdown ({quotes.length} Showrooms)
            </CardTitle>
            <div className="text-xs text-slate-500">
              Platform transparency rule: All verified dealership quotes are visible to competing showrooms.
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Dealership</th>
                    <th className="py-3 px-4">Ex-Showroom</th>
                    <th className="py-3 px-4">Insurance</th>
                    <th className="py-3 px-4">RTO / Taxes</th>
                    <th className="py-3 px-4 text-emerald-700">Discounts</th>
                    <th className="py-3 px-4">Accessories</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Total On-Road</th>
                    <th className="py-3 px-4">Validity</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotes.map((q) => {
                    const isMyShowroom = q.dealership_id === dealership?.id;
                    const expired = isQuoteExpired(q.validity_date);

                    return (
                      <tr
                        key={q.id}
                        className={`transition-colors ${
                          isMyShowroom ? 'bg-brand-50/40 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900">
                              {q.dealership?.name}
                            </span>
                            {isMyShowroom && (
                              <Badge variant="brand" size="sm">Your Showroom</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{formatINR(q.ex_showroom_price)}</td>
                        <td className="py-3.5 px-4">{formatINR(q.insurance)}</td>
                        <td className="py-3.5 px-4">{formatINR(q.registration_charges)}</td>
                        <td className="py-3.5 px-4 text-emerald-700 font-bold">
                          -{formatINR(q.discounts)}
                        </td>
                        <td className="py-3.5 px-4">{formatINR(q.accessories_extras)}</td>
                        <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                          {formatINR(q.on_road_price)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{formatDate(q.validity_date)}</td>
                        <td className="py-3.5 px-4">
                          {!q.is_complete ? (
                            <Badge variant="warning" size="sm">Incomplete (Excluded)</Badge>
                          ) : expired ? (
                            <Badge variant="danger" size="sm">Expired</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Active</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DealerLayout>
  );
}
