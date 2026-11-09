import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui';
import { Car, ShoppingBag, Building2, ArrowRight, CheckCircle2 } from 'lucide-react';

export function RegisterRoleChooserPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
              <Car className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Auto<span className="text-brand-600">Group</span>
            </span>
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Choose Your Account Type</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Select how you plan to use the AutoGroup platform. Account roles are strictly determined by registration.
          </p>
        </div>

        {/* 2-Option Chooser Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buyer Option */}
          <Card hoverable className="flex flex-col justify-between border-slate-200/90 hover:border-brand-500 transition-all p-2">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-3">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <Badge variant="brand" className="w-fit mb-2">Car Buyers</Badge>
              <CardTitle className="text-lg text-slate-900">I&apos;m a Buyer</CardTitle>
              <CardDescription className="text-xs leading-relaxed text-slate-600">
                Join or form local buying groups with other verified buyers in your district. Pool volume on the exact same variant to receive competitive dealership bids.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Free to join; zero buying obligation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Compare authorized showroom quotes side-by-side</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Lock guaranteed delivery price snapshots</span>
                </li>
              </ul>

              <Link to="/register/buyer" className="block pt-2">
                <Button variant="primary" size="lg" className="w-full font-semibold" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Register as Buyer
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Dealership Option */}
          <Card hoverable className="flex flex-col justify-between border-slate-200/90 hover:border-slate-800 transition-all p-2">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <Badge variant="default" className="w-fit mb-2">Showrooms & OEM Dealers</Badge>
              <CardTitle className="text-lg text-slate-900">I&apos;m a Dealership</CardTitle>
              <CardDescription className="text-xs leading-relaxed text-slate-600">
                Access qualified district-level group purchase tenders. Submit on-road price quotations, receive high-intent buyer leads, and close volume sales.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>High-intent buyers looking for your brand</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Compete with transparent quotation breakdown</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified dealership status protection</span>
                </li>
              </ul>

              <Link to="/register/dealer" className="block pt-2">
                <Button variant="secondary" size="lg" className="w-full font-semibold border-slate-300 text-slate-900 hover:bg-slate-100" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Register Dealership
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Footer Link */}
        <div className="mt-8 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
