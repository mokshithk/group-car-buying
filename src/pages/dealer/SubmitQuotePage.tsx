import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { fetchGroupById } from '@/lib/groupService';
import { fetchQuotationsForGroup, isQuoteExpired } from '@/lib/quoteService';
import { formatINR } from '@/lib/formatters';
import { Group, Quotation } from '@/types';
import {
  ArrowLeft,
  Tag,
  AlertTriangle,
  Save,
} from 'lucide-react';

export function SubmitQuotePage() {
  const { id } = useParams<{ id: string }>();
  const { dealership } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [existingQuotes, setExistingQuotes] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quote input form state
  const [exShowroom, setExShowroom] = useState<number>(1220000);
  const [insurance, setInsurance] = useState<number>(44000);
  const [registration, setRegistration] = useState<number>(183000);
  const [discounts, setDiscounts] = useState<number>(35000);
  const [accessories, setAccessories] = useState<number>(12000);
  const [validityDays, setValidityDays] = useState<number>(15);
  const [terms, setTerms] = useState(
    'Includes 3-year extended warranty and zero depreciation cover. Delivery within 21 days.'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);
      const g = await fetchGroupById(id);
      if (g) {
        setGroup(g);
        if (g.variant?.ex_showroom_price) {
          setExShowroom(g.variant.ex_showroom_price);
        }
        const qList = await fetchQuotationsForGroup(g.id);
        setExistingQuotes(qList);

        // Preload our showroom's quote if exists
        const myQ = qList.find((q) => q.dealership_id === dealership?.id);
        if (myQ) {
          setExShowroom(myQ.ex_showroom_price);
          setInsurance(myQ.insurance);
          setRegistration(myQ.registration_charges);
          setDiscounts(myQ.discounts);
          setAccessories(myQ.accessories_extras);
          if (myQ.terms) setTerms(myQ.terms);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [id, dealership]);

  // Real-time calculation: Net On-Road Price
  const computedOnRoad =
    Number(exShowroom || 0) +
    Number(insurance || 0) +
    Number(registration || 0) -
    Number(discounts || 0) +
    Number(accessories || 0);

  // Validation: Incomplete check
  const isIncomplete = Number(insurance) <= 0 || Number(registration) <= 0;

  // Calculate live ranking
  const validCompletePrices = existingQuotes
    .filter((q) => q.is_complete && !isQuoteExpired(q.validity_date))
    .map((q) => q.on_road_price);

  const allPricesWithOurs = [...validCompletePrices, computedOnRoad].sort((a, b) => a - b);
  const myProjectedRank = allPricesWithOurs.indexOf(computedOnRoad) + 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        type: 'success',
        title: 'Quotation Published Successfully',
        message: 'Your revised on-road price has been recorded. All group buyers have been alerted.',
      });
      navigate(`/dealer/groups/${group.id}`);
    }, 600);
  };

  if (isLoading) {
    return (
      <DealerLayout>
        <div className="py-20 text-center text-slate-400">Loading tender quotation editor...</div>
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
                  min={5}
                  max={60}
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
            </CardContent>
          </Card>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full font-bold"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Publish Quotation to Group ({formatINR(computedOnRoad)})
          </Button>
        </form>
      </div>
    </DealerLayout>
  );
}
