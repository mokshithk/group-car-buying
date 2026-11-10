import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { fetchGroupById } from '@/lib/groupService';
import {
  fetchQuotationsForGroup,
  submitQuotation,
  isQuoteExpired,
} from '@/lib/quoteService';
import { fetchPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '@/lib/catalogService';
import { formatINR } from '@/lib/formatters';
import { Group, Quotation } from '@/types';
import {
  ArrowLeft,
  Tag,
  AlertTriangle,
  AlertCircle,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

interface DraftQuoteItem {
  item_name: string;
  amount: number;
  is_optional: boolean;
}

const OPEN_GROUP_STATUSES = new Set(['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED']);

export function SubmitQuotePage() {
  const { id } = useParams<{ id: string }>();
  const { dealership } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [existingQuotes, setExistingQuotes] = useState<Quotation[]>([]);
  const [myExistingQuote, setMyExistingQuote] = useState<Quotation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quote input form state
  const [exShowroom, setExShowroom] = useState<number>(0);
  const [insurance, setInsurance] = useState<number>(0);
  const [registration, setRegistration] = useState<number>(0);
  const [discounts, setDiscounts] = useState<number>(0);
  const [accessories, setAccessories] = useState<number>(0);
  const [validityDays, setValidityDays] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.quoteValidityDefaultDays
  );
  const [terms, setTerms] = useState('');
  const [quoteItems, setQuoteItems] = useState<DraftQuoteItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

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
        const [g, settings, qList] = await Promise.all([
          fetchGroupById(id),
          fetchPlatformSettings(),
          fetchQuotationsForGroup(id, { includeInactive: true }),
        ]);

        if (cancelled) return;

        if (g) {
          setGroup(g);
          setExistingQuotes(qList);

          const myQ = qList.find((q) => q.dealership_id === dealership?.id) || null;
          setMyExistingQuote(myQ);

          if (myQ) {
            setExShowroom(myQ.ex_showroom_price);
            setInsurance(myQ.insurance);
            setRegistration(myQ.registration_charges);
            setDiscounts(myQ.discounts);
            setAccessories(myQ.accessories_extras);
            setTerms(myQ.terms || '');
            setQuoteItems(
              (myQ.quote_items || []).map((item) => ({
                item_name: item.item_name,
                amount: Number(item.amount) || 0,
                is_optional: Boolean(item.is_optional),
              }))
            );

            const remDays = Math.ceil(
              (new Date(myQ.validity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            setValidityDays(
              Number.isFinite(remDays) && remDays >= 1
                ? Math.min(90, remDays)
                : settings.quoteValidityDefaultDays
            );
          } else {
            setExShowroom(g.variant?.ex_showroom_price || 0);
            setValidityDays(settings.quoteValidityDefaultDays);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load quotation editor.');
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
  }, [id, dealership?.id]);

  // Real-time calculation: Net On-Road Price
  const computedOnRoad =
    Number(exShowroom || 0) +
    Number(insurance || 0) +
    Number(registration || 0) -
    Number(discounts || 0) +
    Number(accessories || 0);

  // Validation checks
  const isIncomplete = Number(insurance) <= 0 || Number(registration) <= 0;
  const isDeactivatedQuote = myExistingQuote?.is_active === false;
  const isGroupClosed = Boolean(group && !OPEN_GROUP_STATUSES.has(group.status));
  const isDealerVerified = dealership?.status === 'VERIFIED';

  // Calculate live ranking excluding our showroom's previous quote
  const validCompletePrices = existingQuotes
    .filter(
      (q) =>
        q.id !== myExistingQuote?.id &&
        q.is_active !== false &&
        q.is_complete &&
        !isQuoteExpired(q.validity_date)
    )
    .map((q) => q.on_road_price);

  const allPricesWithOurs = [...validCompletePrices, computedOnRoad].sort((a, b) => a - b);
  const myProjectedRank = allPricesWithOurs.indexOf(computedOnRoad) + 1;

  const handleAddLineItem = () => {
    setQuoteItems((prev) => [...prev, { item_name: '', amount: 0, is_optional: true }]);
  };

  const handleRemoveLineItem = (idx: number) => {
    setQuoteItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !dealership?.id || isSubmitting) return;

    setSubmitError(null);

    if (!isDealerVerified) {
      setSubmitError('Only VERIFIED dealerships may publish or revise quotations.');
      return;
    }
    if (isGroupClosed) {
      setSubmitError(`This group is ${group.status.toLowerCase()} and no longer accepting quotations.`);
      return;
    }
    if (isDeactivatedQuote) {
      setSubmitError('This quotation was deactivated by administration and cannot be revised.');
      return;
    }
    if (computedOnRoad <= 0) {
      setSubmitError('Total on-road price must be greater than ₹0.');
      return;
    }

    const clampedDays = Math.min(90, Math.max(1, Math.round(Number(validityDays) || 14)));
    const validityDateIso = new Date(Date.now() + clampedDays * 24 * 60 * 60 * 1000).toISOString();

    setIsSubmitting(true);
    try {
      const res = await submitQuotation({
        groupId: group.id,
        dealershipId: dealership.id,
        exShowroomPrice: Number(exShowroom) || 0,
        insurance: Number(insurance) || 0,
        registrationCharges: Number(registration) || 0,
        discounts: Number(discounts) || 0,
        accessoriesExtras: Number(accessories) || 0,
        onRoadPrice: computedOnRoad,
        validityDate: validityDateIso,
        terms: terms.trim(),
        isComplete: !isIncomplete,
        quoteItems,
      });

      if (!res.success) {
        setSubmitError(res.error || 'Could not publish quotation.');
        toast({
          type: 'error',
          title: 'Quotation Not Saved',
          message: res.error || 'Please review your quotation figures and try again.',
        });
        return;
      }

      toast({
        type: 'success',
        title: myExistingQuote ? 'Quotation Revised & Published' : 'Quotation Published Successfully',
        message: 'Your itemized on-road price has been saved and buyers in the group have been notified.',
      });
      navigate(`/dealer/groups/${group.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save quotation.';
      setSubmitError(msg);
      toast({ type: 'error', title: 'Save Failed', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DealerLayout>
        <div className="py-20 text-center text-slate-400">Loading tender quotation editor...</div>
      </DealerLayout>
    );
  }

  if (loadError || !group) {
    return (
      <DealerLayout>
        <div className="py-20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">
            {loadError || 'Group tender not found'}
          </h2>
          <Link to="/dealer/groups">
            <Button variant="secondary" size="sm">Back to Eligible Groups</Button>
          </Link>
        </div>
      </DealerLayout>
    );
  }

  return (
    <DealerLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <Link
            to={`/dealer/groups/${group.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Group Tender
          </Link>

          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Submit / Revise Quotation
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vehicle: <strong>{group.variant?.model?.name} {group.variant?.name}</strong> · District: {group.district?.name}
          </p>
        </div>

        {/* LIVE COMPETITOR BENCHMARK & RANKING (Section 3: "you are currently #2 of 4") */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm">
              #{myProjectedRank}
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Live Competitive Projection
              </div>
              <div className="text-sm font-bold text-white">
                This quote will rank #{myProjectedRank} of {allPricesWithOurs.length} complete showroom quotes
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase">Projected Net On-Road</div>
            <div className="text-base font-black text-emerald-400">{formatINR(computedOnRoad)}</div>
          </div>
        </div>

        {submitError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {(isDeactivatedQuote || isGroupClosed) && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isDeactivatedQuote
                ? 'This quotation has been deactivated by platform administrators and is read-only.'
                : `This buying group is ${group.status} and is no longer accepting quotation edits.`}
            </span>
          </div>
        )}

        {/* INCOMPLETE QUOTE WARNING (Section 2 & 3: missing components excluded from best price) */}
        {isIncomplete && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Missing Component Notice:</strong> Insurance or Registration fee is set to ₹0. <strong>Incomplete quotations are strictly excluded from buyer "Lowest Price" badges and savings calculations!</strong> Please provide all mandatory line items.
            </div>
          </div>
        )}

        {/* QUOTATION INPUT FORM */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0 pb-3 border-b border-slate-100">
              <CardTitle className="text-base text-slate-900">Itemized Cost Components</CardTitle>
              <CardDescription>
                Provide all statutory and promotional components for on-road calculation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4 pt-2">
              <Input
                label="Ex-Showroom Price (INR)"
                type="number"
                required
                value={exShowroom}
                onChange={(e) => setExShowroom(Number(e.target.value))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Comprehensive Insurance (1+3 Yrs)"
                  type="number"
                  required
                  value={insurance}
                  onChange={(e) => setInsurance(Number(e.target.value))}
                  helperText="Mandatory for complete quote status"
                />

                <Input
                  label="Registration (RTO) & Statutory Charges"
                  type="number"
                  required
                  value={registration}
                  onChange={(e) => setRegistration(Number(e.target.value))}
                  helperText="Mandatory for complete quote status"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Group Corporate Discount (INR)"
                  type="number"
                  required
                  value={discounts}
                  onChange={(e) => setDiscounts(Number(e.target.value))}
                  helperText="Subtracted directly from on-road total"
                />

                <Input
                  label="Included Basic Accessories & Extras"
                  type="number"
                  required
                  value={accessories}
                  onChange={(e) => setAccessories(Number(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Quotation Validity (Days from Today)"
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                />

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col justify-center">
                  <span className="text-slate-500 font-semibold">Net Calculated On-Road:</span>
                  <span className="text-lg font-black text-slate-900">{formatINR(computedOnRoad)}</span>
                </div>
              </div>

              <Input
                label="Showroom Delivery & Warranty Terms"
                placeholder="e.g. Free 3-year RSA, delivery timeline, complimentary mats..."
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />

              {/* Optional itemized accessories / line items */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">
                      Itemized Accessories / Add-ons (Optional)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Break down accessories, extended warranty packages, or handling items for buyers.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddLineItem}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add Item
                  </Button>
                </div>

                {quoteItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        placeholder="Item name (e.g. Floor Mats & Mud Flaps)"
                        value={item.item_name}
                        onChange={(e) =>
                          setQuoteItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, item_name: e.target.value } : row
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        min={0}
                        placeholder="Amount"
                        value={item.amount}
                        onChange={(e) =>
                          setQuoteItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, amount: Number(e.target.value) || 0 } : row
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <label className="sm:col-span-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.is_optional}
                        onChange={(e) =>
                          setQuoteItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, is_optional: e.target.checked } : row
                            )
                          )
                        }
                      />
                      Optional
                    </label>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                        title="Remove line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full font-bold"
            isLoading={isSubmitting}
            disabled={isDeactivatedQuote || isGroupClosed || !isDealerVerified}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Publish Quotation to Group ({formatINR(computedOnRoad)})
          </Button>
        </form>
      </div>
    </DealerLayout>
  );
}
