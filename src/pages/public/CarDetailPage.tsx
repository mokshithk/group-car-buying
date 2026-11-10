import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button, Badge, Card, Select } from '@/components/ui';
import { CarIllustration } from '@/components/feature/CarIllustration';
import { fetchModelById, fetchDistricts } from '@/lib/catalogService';
import { Model, Variant, District } from '@/types';
import { formatINR } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Users, CheckCircle, ShieldCheck, PlusCircle, Bookmark, ExternalLink, Loader2 } from 'lucide-react';

export function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [model, setModel] = useState<(Model & { variants: Variant[] }) | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState(
    profile?.district_id || ''
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      id ? fetchModelById(id) : Promise.resolve(null),
      fetchDistricts(),
    ])
      .then(([m, dList]) => {
        setModel(m);
        setDistricts(dList);
        if (dList.length > 0 && !selectedDistrictId) {
          setSelectedDistrictId(profile?.district_id || dList[0].id);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load car details.');
        setIsLoading(false);
      });
  }, [id, profile?.district_id, selectedDistrictId]);

  const selectedDistrict =
    districts.find((d) => d.id === selectedDistrictId) || districts[0] || { id: '', name: 'Selected District', state: '' };

  const handleActionRequiringAuth = (targetPath: string) => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(targetPath)}`);
    } else {
      navigate(targetPath);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-canvas">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-canvas">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-slate-800">Car Model Not Found</h2>
          <p className="text-sm text-slate-500 mt-2">{error || 'The requested car model could not be found.'}</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="primary">Return to Catalog</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <div className="mb-6">
            <Link
              to="/#cars"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Car Catalog
            </Link>
          </div>

          {/* Model Header & Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
            <div className="lg:col-span-7">
              <CarIllustration bodyType={model.body_type} imageUrl={model.image_url} alt={model.name} className="h-64 sm:h-80" />
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="brand">{model.manufacturer?.name}</Badge>
                  <Badge variant="default">{model.body_type}</Badge>
                </div>

                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                  {model.name}
                </h1>

                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Available in {model.fuel_types.join(', ')} powertrains with {model.variants.length} distinctive variant configurations. Form or join a group in your district to solicit dealer bids.
                </p>

                <div className="mt-6 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Indicative Base Price
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    Starting from {formatINR(model.starting_price)}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Indicative ex-showroom. Final on-road prices are itemized and locked upon booking.
                  </div>
                </div>
              </div>

              {/* District Selector & Group Action */}
              <div className="mt-6 p-4 rounded-2xl bg-brand-50/50 border border-brand-200/60 space-y-3">
                <Select
                  label="Select District to View Active Groups"
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  options={districts.map((d) => ({
                    value: d.id,
                    label: `${d.name} (${d.state})`,
                  }))}
                />
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() =>
                    handleActionRequiringAuth(
                      `/buyer/groups/create?modelId=${model.id}&districtId=${selectedDistrictId}`
                    )
                  }
                  leftIcon={<PlusCircle className="w-4 h-4" />}
                >
                  Create New Group in {selectedDistrict.name}
                </Button>
              </div>
            </div>
          </div>

          {/* VARIANTS TABLE & ACTIVE GROUPS */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Variants & Local Buying Groups
                </h2>
                <p className="text-xs text-slate-500">
                  Groups form by <strong>exact variant</strong> in <strong>{selectedDistrict.name}</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {model.variants.map((v) => (
                <Card key={v.id} className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Variant specs */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{v.name}</h3>
                        <Badge variant="outline" size="sm">{v.transmission}</Badge>
                        <Badge variant="default" size="sm">{v.fuel_type}</Badge>
                        {v.engine_cc && (
                          <span className="text-xs text-slate-500 font-mono">
                            {v.engine_cc} cc
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {v.features.map((feat) => (
                          <span
                            key={feat}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md"
                          >
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            {feat}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 text-sm">
                        <span className="text-slate-500">Indicative Ex-Showroom: </span>
                        <strong className="text-slate-900 font-bold">{formatINR(v.ex_showroom_price)}</strong>
                      </div>
                    </div>

                    {/* District Group Status & Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:border-l lg:border-slate-100 lg:pl-6">
                      <div className="text-center sm:text-right pr-2">
                        <div className="flex items-center justify-center sm:justify-end gap-1.5 text-xs font-semibold text-brand-700">
                          <Users className="w-4 h-4 text-brand-600" />
                          <span>Active District Group</span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {selectedDistrict.name}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() =>
                            handleActionRequiringAuth(
                              `/buyer/wishlist?addVariant=${v.id}`
                            )
                          }
                          leftIcon={<Bookmark className="w-4 h-4" />}
                          title="Save to Wishlist"
                        >
                          Wishlist
                        </Button>

                        <Button
                          variant="primary"
                          size="md"
                          onClick={() =>
                            handleActionRequiringAuth(
                              `/buyer/groups/find?variantId=${v.id}&districtId=${selectedDistrictId}`
                            )
                          }
                          rightIcon={<ExternalLink className="w-4 h-4" />}
                        >
                          Find or Join Group
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* CONSUMER PROTECTION BANNER */}
          <div className="mt-12 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-subtle flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-sm font-bold text-slate-900">
                Transparent On-Road Pricing & Zero Fake Discount Claims
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                AutoGroup never shows artificial inflated MSRPs or misleading savings percentages. All quotes come from authorized dealerships with complete breakdowns for insurance, road tax, and accessories.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
