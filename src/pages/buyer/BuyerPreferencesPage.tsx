import React, { useState, useEffect } from 'react';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Select, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { getBuyerPreferences, saveBuyerPreferences } from '@/lib/groupService';
import { fetchDistricts } from '@/lib/catalogService';
import { District } from '@/types';
import { formatINR } from '@/lib/formatters';
import { Sliders, Save, Check } from 'lucide-react';

const AVAILABLE_BRANDS = ['Tata Motors', 'Hyundai', 'Mahindra', 'Maruti Suzuki', 'Volkswagen', 'Toyota'];
const AVAILABLE_FUELS = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];

export function BuyerPreferencesPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [districts, setDistricts] = useState<District[]>([]);
  const [preferredBrands, setPreferredBrands] = useState<string[]>(['Tata Motors', 'Hyundai']);
  const [preferredFuels, setPreferredFuels] = useState<string[]>(['Petrol', 'Diesel']);
  const [budgetMax, setBudgetMax] = useState<number>(2000000);
  const [districtId, setDistrictId] = useState(
    profile?.district_id || ''
  );

  useEffect(() => {
    fetchDistricts()
      .then((dList) => {
        setDistricts(dList);
        if (dList.length > 0 && !districtId) {
          setDistrictId(profile?.district_id || dList[0].id);
        }
      })
      .catch((err) => console.error('Error fetching districts:', err));

    if (!user) return;
    getBuyerPreferences(user.id).then((prefs) => {
      if (prefs) {
        if (prefs.preferred_brands) setPreferredBrands(prefs.preferred_brands);
        if (prefs.preferred_fuel_types) setPreferredFuels(prefs.preferred_fuel_types);
        if (prefs.budget_max) setBudgetMax(prefs.budget_max);
        if (prefs.district_id) setDistrictId(prefs.district_id);
      }
    });
  }, [user, profile?.district_id, districtId]);

  const toggleBrand = (brand: string) => {
    if (preferredBrands.includes(brand)) {
      setPreferredBrands(preferredBrands.filter((b) => b !== brand));
    } else {
      setPreferredBrands([...preferredBrands, brand]);
    }
  };

  const toggleFuel = (fuel: string) => {
    if (preferredFuels.includes(fuel)) {
      setPreferredFuels(preferredFuels.filter((f) => f !== fuel));
    } else {
      setPreferredFuels([...preferredFuels, fuel]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    await saveBuyerPreferences(user.id, {
      district_id: districtId,
      preferred_brands: preferredBrands,
      preferred_fuel_types: preferredFuels,
      budget_max: budgetMax,
    });

    toast({
      type: 'success',
      title: 'Preferences Saved',
      message: 'Your recommendations and dashboard tenders have been updated.',
    });
  };

  return (
    <BuyerLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              My Buying Preferences
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Customize which vehicle brands and tenders you want prioritized in your dashboard.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Primary District</CardTitle>
              <CardDescription>
                Your home district determines the physical dealership tenders you are matched with.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                options={districts.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.state})`,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Preferred Brands</CardTitle>
              <CardDescription>Select OEM manufacturers you are actively exploring.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_BRANDS.map((brand) => {
                  const isSelected = preferredBrands.includes(brand);
                  return (
                    <button
                      type="button"
                      key={brand}
                      onClick={() => toggleBrand(brand)}
                      className={`text-xs px-3.5 py-2 rounded-xl font-medium border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{brand}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Fuel & Powertrain Types</CardTitle>
              <CardDescription>Select powertrain technologies you are open to purchasing.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_FUELS.map((fuel) => {
                  const isSelected = preferredFuels.includes(fuel);
                  return (
                    <button
                      type="button"
                      key={fuel}
                      onClick={() => toggleFuel(fuel)}
                      className={`text-xs px-3.5 py-2 rounded-xl font-medium border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{fuel}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Target Budget Ceiling</CardTitle>
              <CardDescription>Maximum on-road budget consideration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Max Indicative Budget:</span>
                <span className="text-base font-bold text-slate-900">{formatINR(budgetMax)}</span>
              </div>
              <input
                type="range"
                min="600000"
                max="3500000"
                step="50000"
                value={budgetMax}
                onChange={(e) => setBudgetMax(Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
            </CardContent>
          </Card>

          <Button type="submit" variant="primary" size="lg" leftIcon={<Save className="w-4 h-4" />}>
            Save Preferences
          </Button>
        </form>
      </div>
    </BuyerLayout>
  );
}
