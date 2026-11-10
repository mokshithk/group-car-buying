import { useState } from 'react';
import { Car, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal, Button } from '@/components/ui';

type PolicyKey = 'price-lock' | 'refund' | 'conduct' | 'privacy';

const POLICY_DOCS: Record<PolicyKey, { title: string; body: string }> = {
  'price-lock': {
    title: 'Price Lock Guarantee Terms',
    body: 'When a buyer pays the platform booking deposit and fee against an active, complete showroom quotation, the full itemized on-road price breakdown (ex-showroom, insurance, RTO/registration, discounts, and accessories) is recorded as an immutable price snapshot and honored until vehicle delivery.',
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    body: 'Buyer-initiated cancellations retain the configured dealership retention percentage (default 5%) from the booking deposit and do not refund the platform convenience fee. Dealership-fault cancellations issue a 100% deposit refund plus platform fee refund (when enabled by platform policy), leaving 0% retained by the showroom.',
  },
  conduct: {
    title: 'Dealer Code of Conduct',
    body: 'Only KYC/GST-verified OEM dealerships may submit quotations. Dealers must include both insurance and registration charges for complete offers, honor all price-locked snapshots, and refrain from hidden charges. Violations trigger administrative warnings or dealership suspension.',
  },
  privacy: {
    title: 'Privacy & Contact Redaction Policy',
    body: 'Fellow buying group members only see redacted display names (e.g., Rahul S.). Buyer phone numbers and email addresses are never exposed to other buyers and are shared with a specific verified dealership only when you explicitly click "I\'m Interested" or "Book Now".',
  },
};

export function Footer() {
  const [activePolicy, setActivePolicy] = useState<PolicyKey | null>(null);

  return (
    <footer className="border-t border-slate-200 bg-white pt-12 pb-16 text-slate-600 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
                <Car className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Auto<span className="text-brand-600">Group</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              AutoGroup empowers car buyers in the same district wanting the same car variant to pool collective purchasing interest. Authorized local dealerships compete with transparent on-road quotations.
            </p>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/80 w-fit">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Transparent Price Locks &amp; Verified Dealerships</span>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/#cars" className="hover:text-brand-600 transition-colors">
                  Browse Car Variants
                </Link>
              </li>
              <li>
                <Link to="/#how-it-works" className="hover:text-brand-600 transition-colors">
                  How Group Buying Works
                </Link>
              </li>
              <li>
                <Link to="/register/buyer" className="hover:text-brand-600 transition-colors">
                  Start or Join a Group
                </Link>
              </li>
              <li>
                <Link to="/register/dealer" className="hover:text-brand-600 transition-colors">
                  Dealership Enrollment
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Governance */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Governance
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => setActivePolicy('price-lock')}
                  className="text-slate-600 hover:text-brand-600 transition-colors text-left"
                >
                  Price Lock Guarantee Terms
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActivePolicy('refund')}
                  className="text-slate-600 hover:text-brand-600 transition-colors text-left"
                >
                  Refund &amp; Cancellation Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActivePolicy('conduct')}
                  className="text-slate-600 hover:text-brand-600 transition-colors text-left"
                >
                  Dealer Code of Conduct
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActivePolicy('privacy')}
                  className="text-slate-600 hover:text-brand-600 transition-colors text-left"
                >
                  Privacy &amp; Contact Redaction
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Mandatory Regulatory Disclaimers (Section 1) */}
        <div className="pt-8 border-t border-slate-100 text-xs text-slate-600 space-y-2.5">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 leading-relaxed">
            <strong>Mandatory Consumer Notice:</strong> AutoGroup is a neutral buyer aggregation and quotation comparison platform. <strong>AutoGroup does NOT sell automobiles and does NOT guarantee specific discounts.</strong> All quotations, price snapshots, vehicle deliveries, and statutory warranties are issued directly by verified authorized third-party automobile dealerships. Final on-road prices are determined through competitive dealer quotations and locked upon verified booking.
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-[11px] text-slate-500">
            <div>© {new Date().getFullYear()} AutoGroup Platform. All rights reserved.</div>
            <div className="flex gap-4">
              <span>Zero Misleading Savings Policy</span>
              <span>•</span>
              <span>Verified OEM Dealerships Only</span>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(activePolicy)}
        onClose={() => setActivePolicy(null)}
        title={activePolicy ? POLICY_DOCS[activePolicy].title : ''}
        footer={
          <Button variant="primary" size="sm" onClick={() => setActivePolicy(null)}>
            Close
          </Button>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          {activePolicy ? POLICY_DOCS[activePolicy].body : ''}
        </p>
      </Modal>
    </footer>
  );
}
