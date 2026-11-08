import { Car, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white pt-12 pb-16 text-slate-600">
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
              <span>Transparent Price Locks & Verified Dealerships</span>
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
                <span className="text-slate-500">Price Lock Guarantee Terms</span>
              </li>
              <li>
                <span className="text-slate-500">Refund & Cancellation Policy</span>
              </li>
              <li>
                <span className="text-slate-500">Dealer Code of Conduct</span>
              </li>
              <li>
                <span className="text-slate-500">Privacy & Contact Redaction</span>
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
    </footer>
  );
}
