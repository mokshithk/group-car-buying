import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card, Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchGroupById, fetchBuyerJoinedGroups } from '@/lib/groupService';
import {
  fetchQuotationsForGroup,
  analyzeQuotations,
  fetchPriceHistory,
  isQuoteExpired,
} from '@/lib/quoteService';
import { formatINR, formatDate, formatDateTime } from '@/lib/formatters';
import { Group, Quotation, QuotationVersion } from '@/types';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  History,
  Download,
  Building2,
  Printer,
  ChevronRight,
  FileText,
} from 'lucide-react';

export function OffersComparisonPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [membershipStatus, setMembershipStatus] = useState<'ACTIVE' | 'BOOKED' | 'NONE'>('NONE');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Breakdown & Version history modal state
  const [selectedQuoteForBreakdown, setSelectedQuoteForBreakdown] = useState<Quotation | null>(null);
  const [quoteVersions, setQuoteVersions] = useState<QuotationVersion[]>([]);

  // Printable quote download modal state
  const [quoteToPrint, setQuoteToPrint] = useState<Quotation | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const [g, joinedGroups] = await Promise.all([
          fetchGroupById(id),
          user ? fetchBuyerJoinedGroups(user.id) : Promise.resolve([]),
        ]);
        if (cancelled) return;

        const match = joinedGroups.find((jg) => jg.id === id);
        if (match?.membership_status === 'BOOKED') {
          setMembershipStatus('BOOKED');
        } else if (match) {
          setMembershipStatus('ACTIVE');
        } else {
          setMembershipStatus('NONE');
        }

        if (g) {
          setGroup(g);
          const qList = await fetchQuotationsForGroup(g.id);
          if (!cancelled) {
            setQuotes(qList);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load quotations.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const handleOpenBreakdown = async (q: Quotation) => {
    setSelectedQuoteForBreakdown(q);
    try {
      const versions = await fetchPriceHistory(q.id);
      setQuoteVersions(versions);
    } catch {
      setQuoteVersions(q.quotation_versions || []);
    }
  };

  const handlePrintQuote = (q: Quotation) => {
    setQuoteToPrint(q);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center text-slate-400">Loading quotation comparisons...</div>
      </BuyerLayout>
    );
  }

  if (loadError || !group) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">
            {loadError || 'Group not found'}
          </h2>
          <Link to="/buyer/groups">
            <Button variant="secondary" size="sm">Back to My Groups</Button>
          </Link>
        </div>
      </BuyerLayout>
    );
  }

  const isGroupOpen = ['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED'].includes(group.status);
  const canTransactOnGroup = isGroupOpen && membershipStatus === 'ACTIVE';

  const {
    lowestPriceQuote,
    maxSavings,
    hasIncompleteQuotes,
  } = analyzeQuotations(quotes);

  return (
    <BuyerLayout>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to={`/buyer/groups/${group.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Group Overview
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="brand">{group.variant?.model?.manufacturer?.name}</Badge>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Quotation Comparison: {group.variant?.model?.name} {group.variant?.name}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Authorized showroom tenders in <strong>{group.district?.name}</strong>. Compare transparent, itemized on-road figures.
              </p>
            </div>
          </div>
        </div>

        {membershipStatus === 'BOOKED' && (
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-3 text-xs text-indigo-900">
            <span>You already hold a locked booking from this buying group.</span>
            <Link to="/buyer/bookings">
              <Button variant="secondary" size="sm">View My Booking</Button>
            </Link>
          </div>
        )}

        {membershipStatus === 'NONE' && isGroupOpen && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
            <span>Join this group on the overview page before expressing showroom interest or booking.</span>
            <Link to={`/buyer/groups/${group.id}`}>
              <Button variant="secondary" size="sm">Go to Group Overview</Button>
            </Link>
          </div>
        )}

        {/* SAVINGS HIGHLIGHT CARD (Strictly between complete, valid quotes) */}
        {lowestPriceQuote && !isQuoteExpired(lowestPriceQuote.validity_date) && maxSavings > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-500/10 border border-emerald-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Verified Complete Quotation Advantage
                </div>
                <div className="text-lg font-black text-emerald-950 mt-0.5">
                  Best Complete Price: {formatINR(lowestPriceQuote.on_road_price)} by {lowestPriceQuote.dealership?.name}
                </div>
                <div className="text-xs text-emerald-800 mt-0.5">
                  Up to <strong>{formatINR(maxSavings)}</strong> lower than competing complete dealer quotes for this group.
                </div>
              </div>
            </div>

            {canTransactOnGroup && (
              <Button
                variant="success"
                size="sm"
                onClick={() => navigate(`/buyer/quote/${lowestPriceQuote.id}/book`)}
                className="shrink-0"
              >
                Book Best On-Road Price
              </Button>
            )}
          </div>
        )}

        {/* INCOMPLETE QUOTE WARNING NOTICE (Section 2) */}
        {hasIncompleteQuotes && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Consumer Notice:</strong> One or more dealers submitted incomplete quotes omitting mandatory insurance or registration fees. <strong>Incomplete quotes are strictly excluded from "Lowest Price" and savings calculations</strong> to avoid misleading figures.
            </div>
          </div>
        )}

        {quotes.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No active quotations yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Once authorized district dealers submit complete on-road quotations for this group, they will appear here side by side.
            </p>
          </Card>
        ) : (
        <>

        {/* DESKTOP COMPARISON TABLE */}
        <div className="hidden lg:block">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Authorized Dealership</th>
                    <th className="py-3.5 px-4">Ex-Showroom</th>
                    <th className="py-3.5 px-4">Insurance</th>
                    <th className="py-3.5 px-4">RTO / Taxes</th>
                    <th className="py-3.5 px-4 text-emerald-700">Group Discounts</th>
                    <th className="py-3.5 px-4">Accessories</th>
                    <th className="py-3.5 px-4 font-bold text-slate-900">On-Road Price</th>
                    <th className="py-3.5 px-4">Validity</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotes.map((q) => {
                    const expired = isQuoteExpired(q.validity_date);
                    const isLowest = lowestPriceQuote?.id === q.id;

                    return (
                      <tr
                        key={q.id}
                        className={`transition-colors ${
                          expired
                            ? 'bg-slate-50/70 text-slate-400 opacity-60'
                            : isLowest
                            ? 'bg-emerald-50/30'
                            : 'hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Dealer name */}
                        <td className="py-4 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{q.dealership?.name || 'Dealership'}</span>
                          </div>
                          {!q.is_complete && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                              ⚠️ INCOMPLETE QUOTE (Excluded)
                            </span>
                          )}
                          {expired && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                              EXPIRED
                            </span>
                          )}
                          {isLowest && !expired && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                              ★ LOWEST COMPLETE PRICE
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4">{formatINR(q.ex_showroom_price)}</td>
                        <td className="py-4 px-4">{formatINR(q.insurance)}</td>
                        <td className="py-4 px-4">{formatINR(q.registration_charges)}</td>
                        <td className="py-4 px-4 text-emerald-700 font-bold">
                          -{formatINR(q.discounts)}
                        </td>
                        <td className="py-4 px-4">{formatINR(q.accessories_extras)}</td>

                        {/* On-road price */}
                        <td className="py-4 px-4">
                          <div className="text-sm font-black text-slate-900">
                            {formatINR(q.on_road_price)}
                          </div>
                        </td>

                        {/* Validity */}
                        <td className="py-4 px-4">
                          <div className={expired ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                            {formatDate(q.validity_date)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenBreakdown(q)}
                              title="View Price Breakdown & History"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePrintQuote(q)}
                              title="Download / Print Quote"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* "I'm interested" choice (Section 2) */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={expired || !q.is_complete || !canTransactOnGroup}
                              onClick={() => navigate(`/buyer/quote/${q.id}/interested`)}
                            >
                              I'm Interested
                            </Button>

                            {/* "Book now" choice (Section 2) */}
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={expired || !q.is_complete || !canTransactOnGroup}
                              onClick={() => navigate(`/buyer/quote/${q.id}/book`)}
                            >
                              Book Now
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* MOBILE SWIPEABLE CARDS VIEW (Section 6: Responsive) */}
        <div className="lg:hidden space-y-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Showing {quotes.length} Quotes
          </div>
          {quotes.map((q) => {
            const expired = isQuoteExpired(q.validity_date);
            const isLowest = lowestPriceQuote?.id === q.id;

            return (
              <Card
                key={q.id}
                className={`p-5 transition-all ${
                  expired
                    ? 'opacity-60 bg-slate-50 border-slate-200'
                    : isLowest
                    ? 'border-emerald-300 ring-1 ring-emerald-300/50'
                    : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <span>{q.dealership?.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {!q.is_complete && (
                          <Badge variant="warning" size="sm">Incomplete (Excluded)</Badge>
                        )}
                        {expired && <Badge variant="danger" size="sm">Expired Offer</Badge>}
                        {isLowest && !expired && <Badge variant="success" size="sm">★ Lowest Complete</Badge>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500">On-Road</div>
                      <div className="text-base font-black text-slate-900">
                        {formatINR(q.on_road_price)}
                      </div>
                    </div>
                  </div>

                  {/* Breakdown pill */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">Ex-Showroom:</span>{' '}
                      <span className="font-semibold">{formatINR(q.ex_showroom_price)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Insurance:</span>{' '}
                      <span className="font-semibold">{formatINR(q.insurance)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">RTO / Taxes:</span>{' '}
                      <span className="font-semibold">{formatINR(q.registration_charges)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Discounts:</span>{' '}
                      <span className="font-semibold text-emerald-700">-{formatINR(q.discounts)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Valid until: {formatDate(q.validity_date)}</span>
                    <button
                      onClick={() => handleOpenBreakdown(q)}
                      className="text-brand-600 font-semibold flex items-center gap-0.5 hover:underline"
                    >
                      Breakdown <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mobile Actions */}
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={expired || !q.is_complete || !canTransactOnGroup}
                      onClick={() => navigate(`/buyer/quote/${q.id}/interested`)}
                    >
                      I'm Interested
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={expired || !q.is_complete || !canTransactOnGroup}
                      onClick={() => navigate(`/buyer/quote/${q.id}/book`)}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        </>
        )}

        {/* QUOTATION BREAKDOWN & PRICE HISTORY MODAL */}
        <Modal
          isOpen={!!selectedQuoteForBreakdown}
          onClose={() => setSelectedQuoteForBreakdown(null)}
          title="Itemized Quotation Breakdown"
          description={selectedQuoteForBreakdown?.dealership?.name}
          footer={
            <div className="flex justify-between items-center w-full">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (selectedQuoteForBreakdown) handlePrintQuote(selectedQuoteForBreakdown);
                }}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Printable Quote
              </Button>
              <Button variant="primary" size="sm" onClick={() => setSelectedQuoteForBreakdown(null)}>
                Close
              </Button>
            </div>
          }
        >
          {selectedQuoteForBreakdown && (
            <div className="space-y-5 pt-2 text-xs">
              {/* Line items table */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Ex-Showroom Price:</span>
                  <span className="font-semibold text-slate-900">
                    {formatINR(selectedQuoteForBreakdown.ex_showroom_price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Comprehensive Insurance (1+3 yrs):</span>
                  <span className="font-semibold text-slate-900">
                    {formatINR(selectedQuoteForBreakdown.insurance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Registration & Statutory RTO:</span>
                  <span className="font-semibold text-slate-900">
                    {formatINR(selectedQuoteForBreakdown.registration_charges)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Group Buyer Discount / Incentives:</span>
                  <span>-{formatINR(selectedQuoteForBreakdown.discounts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Basic Accessories & Extras:</span>
                  <span className="font-semibold text-slate-900">
                    {formatINR(selectedQuoteForBreakdown.accessories_extras)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                  <span>Final Net On-Road Price:</span>
                  <span>{formatINR(selectedQuoteForBreakdown.on_road_price)}</span>
                </div>
              </div>

              {/* Terms */}
              {selectedQuoteForBreakdown.terms && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Showroom Specific Terms:</h4>
                  <p className="text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                    {selectedQuoteForBreakdown.terms}
                  </p>
                </div>
              )}

              {selectedQuoteForBreakdown.quote_items && selectedQuoteForBreakdown.quote_items.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-1.5">Itemized Add-ons & Line Items:</h4>
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                    {selectedQuoteForBreakdown.quote_items.map((item) => (
                      <div key={item.id} className="px-3 py-2 flex items-center justify-between">
                        <span className="text-slate-700">
                          {item.item_name}
                          {item.is_optional && (
                            <span className="ml-1.5 text-[10px] text-slate-400">(Optional)</span>
                          )}
                        </span>
                        <span className="font-semibold text-slate-900">{formatINR(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price History Timeline (Section 2: price history on quote updates) */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-brand-600" />
                  <span>Price Modification History</span>
                </h4>
                {quoteVersions.length === 0 ? (
                  <p className="text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    Original quotation submitted on {formatDateTime(selectedQuoteForBreakdown.created_at)}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {quoteVersions.map((ver) => (
                      <div
                        key={ver.id}
                        className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            Version {ver.version_number}: {formatINR(ver.on_road_price)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDateTime(ver.changed_at)}
                          </div>
                        </div>
                        <Badge variant="outline" size="sm">
                          Discount: {formatINR(ver.price_breakdown.discounts)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* PRINTABLE / DOWNLOADABLE QUOTE MODAL (Section 2) */}
        <Modal
          isOpen={!!quoteToPrint}
          onClose={() => setQuoteToPrint(null)}
          title="Printable Quotation Certificate"
          description="Official certified quote snapshot with unique verification code"
          maxWidth="lg"
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button variant="secondary" size="md" onClick={() => setQuoteToPrint(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleTriggerPrint}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print / Save PDF
              </Button>
            </div>
          }
        >
          {quoteToPrint && (
            <div className="p-6 bg-white border border-slate-300 rounded-xl space-y-6 text-xs text-slate-800 font-sans print:border-none print:p-0">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">AUTOGROUP QUOTATION VOUCHER</div>
                  <div className="text-slate-500 text-[11px]">Official District Group Buying Tender</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Unique Code</div>
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    AG-Q-{quoteToPrint.id.substring(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Summary metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500">Authorized Dealership:</div>
                  <div className="font-bold text-slate-900 text-sm">{quoteToPrint.dealership?.name}</div>
                  <div className="text-slate-600">{quoteToPrint.dealership?.address}</div>
                  <div className="text-slate-600">GSTIN: {quoteToPrint.dealership?.gst_number}</div>
                </div>

                <div>
                  <div className="text-slate-500">Vehicle & Variant:</div>
                  <div className="font-bold text-slate-900 text-sm">
                    {group.variant?.model?.name} — {group.variant?.name}
                  </div>
                  <div className="text-slate-600">District: {group.district?.name}</div>
                  <div className="text-slate-600">Offer Valid Until: {formatDate(quoteToPrint.validity_date)}</div>
                </div>
              </div>

              {/* Price table */}
              <table className="w-full text-left border-t border-b border-slate-200 py-2">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">Ex-Showroom Price</td>
                    <td className="py-1.5 text-right font-semibold">{formatINR(quoteToPrint.ex_showroom_price)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">Insurance (Zero Dep Cover)</td>
                    <td className="py-1.5 text-right font-semibold">{formatINR(quoteToPrint.insurance)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">Road Tax & Registration</td>
                    <td className="py-1.5 text-right font-semibold">{formatINR(quoteToPrint.registration_charges)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 text-emerald-700">
                    <td className="py-1.5 font-bold">Group Buyer Corporate Discount</td>
                    <td className="py-1.5 text-right font-bold">-{formatINR(quoteToPrint.discounts)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">Accessories & Extras</td>
                    <td className="py-1.5 text-right font-semibold">{formatINR(quoteToPrint.accessories_extras)}</td>
                  </tr>
                  <tr className="text-sm font-black text-slate-900">
                    <td className="py-2">Total Net On-Road Price</td>
                    <td className="py-2 text-right">{formatINR(quoteToPrint.on_road_price)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-[10px] text-slate-500 leading-relaxed pt-2">
                This document is a formal quotation certificate generated via AutoGroup. Present this code at the showroom or proceed directly to online booking to lock this on-road price through final vehicle delivery.
              </div>
            </div>
          )}
        </Modal>
      </div>
    </BuyerLayout>
  );
}
