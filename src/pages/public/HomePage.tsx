import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button, Input, Select, Badge, Card } from '@/components/ui';
import { CarIllustration } from '@/components/feature/CarIllustration';
import { INITIAL_MODELS } from '@/lib/catalogData';
import { formatINR } from '@/lib/formatters';
import { Users, FileCheck, ShieldCheck, ArrowRight, Search, Fuel, Sparkles } from 'lucide-react';

const BODY_TYPES = ['All', 'SUV', 'Sedan', 'Hatchback'];
const FUEL_TYPES = ['All', 'Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];
const BRANDS = ['All', 'Tata Motors', 'Hyundai', 'Mahindra', 'Maruti Suzuki', 'Volkswagen'];

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedBodyType, setSelectedBodyType] = useState('All');
  const [selectedFuel, setSelectedFuel] = useState('All');
  const [budgetMax, setBudgetMax] = useState<number>(3000000);

  const filteredModels = useMemo(() => {
    return INITIAL_MODELS.filter((model) => {
      // Search text match
      const matchesSearch =
        !searchQuery ||
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.manufacturer?.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Brand match
      const matchesBrand =
        selectedBrand === 'All' || model.manufacturer?.name === selectedBrand;

      // Body type match
      const matchesBody =
        selectedBodyType === 'All' || model.body_type === selectedBodyType;

      // Fuel type match
      const matchesFuel =
        selectedFuel === 'All' || model.fuel_types.includes(selectedFuel);

      // Budget match (starting price <= budgetMax)
      const matchesBudget = model.starting_price <= budgetMax;

      return matchesSearch && matchesBrand && matchesBody && matchesFuel && matchesBudget;
    });
  }, [searchQuery, selectedBrand, selectedBodyType, selectedFuel, budgetMax]);

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-surface-canvas to-surface-canvas pt-16 pb-20 md:pt-24 md:pb-28 border-b border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200/80 text-brand-800 text-xs font-semibold shadow-subtle">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                <span>Transparent District-Level Group Car Buying</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Group Buying Power for Your Next Car.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Join or form a buying group with verified buyers in your district who want the exact same car variant. Authorized local dealerships compete with their best on-road quotations.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
                <a href="#cars">
                  <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Browse Eligible Cars & Groups
                  </Button>
                </a>
                <a href="#how-it-works">
                  <Button variant="secondary" size="lg">
                    How Group Buying Works
                  </Button>
                </a>
              </div>

              {/* Notice Pill */}
              <div className="pt-4">
                <p className="text-xs text-slate-600 bg-white/80 py-2 px-4 rounded-xl border border-slate-200 inline-block shadow-subtle">
                  🔒 <strong>Consumer Notice:</strong> Platform does not sell cars or guarantee discounts. Verified dealers provide direct binding quotations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4-STEP HOW IT WORKS */}
        <section id="how-it-works" className="py-20 bg-white border-b border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <Badge variant="brand" className="mb-2">Simple 4-Step Process</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                How AutoGroup Works
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Fair, transparent, and completely free to explore without obligation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              {/* Step 1 */}
              <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-surface-canvas border border-slate-200/80 shadow-subtle">
                <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 font-bold flex items-center justify-center text-lg mb-4">
                  1
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Form or Join Group</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Choose your exact vehicle variant and district. Join an existing group or start a new group with a single click.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-surface-canvas border border-slate-200/80 shadow-subtle">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold flex items-center justify-center text-lg mb-4">
                  2
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Dealers Compete</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When a group has 3+ members (or 2 members after 20 days), authorized local dealerships view the tender and submit itemized quotations.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-surface-canvas border border-slate-200/80 shadow-subtle">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center text-lg mb-4">
                  3
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Compare Quotes</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Compare complete on-road breakdowns (ex-showroom, insurance, RTO, discounts). Expired or incomplete quotes are excluded.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-surface-canvas border border-slate-200/80 shadow-subtle">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-lg mb-4">
                  4
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Lock Price & Book</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Express interest or lock your price with a ₹5,000 booking amount + ₹100 platform fee. Price is strictly locked until delivery.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CAR CATALOG WITH WORKING FILTERS */}
        <section id="cars" className="py-20 bg-surface-canvas">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <Badge variant="brand" className="mb-2">Available Models</Badge>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Browse Vehicles & Form Groups
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Filter by brand, fuel type, body shape, or budget to discover active district tenders.
                </p>
              </div>
              <div className="text-sm font-semibold text-slate-500">
                Showing {filteredModels.length} models
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search query */}
                <Input
                  label="Search Model or Brand"
                  placeholder="e.g. Nexon, Creta, Mahindra..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />

                {/* Brand Filter */}
                <Select
                  label="Brand"
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  options={BRANDS.map((b) => ({ value: b, label: b }))}
                />

                {/* Body Type Filter */}
                <Select
                  label="Body Type"
                  value={selectedBodyType}
                  onChange={(e) => setSelectedBodyType(e.target.value)}
                  options={BODY_TYPES.map((bt) => ({ value: bt, label: bt }))}
                />

                {/* Fuel Filter */}
                <Select
                  label="Fuel Type"
                  value={selectedFuel}
                  onChange={(e) => setSelectedFuel(e.target.value)}
                  options={FUEL_TYPES.map((f) => ({ value: f, label: f }))}
                />
              </div>

              {/* Budget Range Slider */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <span className="text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                    Max Starting Price:
                  </span>
                  <input
                    type="range"
                    min="500000"
                    max="3000000"
                    step="50000"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(Number(e.target.value))}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                    {formatINR(budgetMax)}
                  </span>
                </div>
                {(searchQuery || selectedBrand !== 'All' || selectedBodyType !== 'All' || selectedFuel !== 'All' || budgetMax < 3000000) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedBrand('All');
                      setSelectedBodyType('All');
                      setSelectedFuel('All');
                      setBudgetMax(3000000);
                    }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Models Grid */}
            {filteredModels.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No matching models found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your filter criteria or search keyword.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredModels.map((model) => (
                  <Card key={model.id} hoverable className="flex flex-col group">
                    <div className="relative">
                      <CarIllustration bodyType={model.body_type} />
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <Badge variant="default" size="sm" className="bg-white/90 backdrop-blur-sm">
                          {model.manufacturer?.name}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 pt-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                            {model.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Fuel className="w-3.5 h-3.5 text-slate-400" />
                              {model.fuel_types.join(', ')}
                            </span>
                            <span>•</span>
                            <span>{model.variants.length} Variants</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500">
                            Indicative Starting Price
                          </div>
                          <div className="text-base font-bold text-slate-900">
                            Starting from {formatINR(model.starting_price)}
                          </div>
                          <div className="text-[10px] text-slate-600">
                            (indicative ex-showroom)
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-auto flex items-center justify-between gap-3">
                      <Link to={`/cars/${model.id}`} className="w-full">
                        <Button variant="outline" size="md" className="w-full font-semibold">
                          View Variants & Groups
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* TRUST & SAFETY SECTION */}
        <section className="py-16 bg-white border-t border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
              <div className="flex flex-col items-center md:items-start p-6 rounded-2xl bg-surface-canvas border border-slate-200">
                <ShieldCheck className="w-8 h-8 text-emerald-600 mb-3" />
                <h4 className="text-base font-bold text-slate-900">Locked Price Snapshots</h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Upon booking, a legally binding price snapshot is stored. The dealership must honor the locked on-road price until delivery.
                </p>
              </div>

              <div className="flex flex-col items-center md:items-start p-6 rounded-2xl bg-surface-canvas border border-slate-200">
                <Users className="w-8 h-8 text-brand-600 mb-3" />
                <h4 className="text-base font-bold text-slate-900">Privacy & Redacted Contacts</h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Members appear as first name + initial only. Dealers never see your phone or email until you specifically choose to connect or book.
                </p>
              </div>

              <div className="flex flex-col items-center md:items-start p-6 rounded-2xl bg-surface-canvas border border-slate-200">
                <FileCheck className="w-8 h-8 text-amber-600 mb-3" />
                <h4 className="text-base font-bold text-slate-900">Fair Cancellation Terms</h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Transparent 5% retention on buyer cancellation. Full 100% refund of booking amount + platform fee if dealer cancels or fails to honor price.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
