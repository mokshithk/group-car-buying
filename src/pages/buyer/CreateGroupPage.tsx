import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Select, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { createGroup } from '@/lib/groupService';
import {
  fetchModels,
  fetchDistricts,
  fetchPlatformSettings,
  DEFAULT_PLATFORM_SETTINGS,
} from '@/lib/catalogService';
import { Model, Variant, District } from '@/types';
import { formatINR } from '@/lib/formatters';
import { Users, PlusCircle, ArrowLeft, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';

export function CreateGroupPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [models, setModels] = useState<(Model & { variants: Variant[] })[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [visibilityThreshold, setVisibilityThreshold] = useState(
    DEFAULT_PLATFORM_SETTINGS.visibilityMemberThreshold
  );
  const [visibilityDays, setVisibilityDays] = useState(
    DEFAULT_PLATFORM_SETTINGS.groupVisibilityDaysFor2Members
  );
  const [targetMembers, setTargetMembers] = useState(
    DEFAULT_PLATFORM_SETTINGS.defaultGroupTarget
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchModels(), fetchDistricts(), fetchPlatformSettings()])
      .then(([mList, dList, settings]) => {
        if (cancelled) return;
        const activeModels = mList.filter((m) => m.variants && m.variants.length > 0);
        setModels(activeModels);
        setDistricts(dList);
        setVisibilityThreshold(settings.visibilityMemberThreshold);
        setVisibilityDays(settings.groupVisibilityDaysFor2Members);
        setTargetMembers(settings.defaultGroupTarget);

        const paramVariantId = searchParams.get('variantId');
        const paramModelId = searchParams.get('modelId');
        const matchedModelFromVariant = paramVariantId
          ? activeModels.find((m) => m.variants.some((v) => v.id === paramVariantId))
          : undefined;

        const defaultModel =
          matchedModelFromVariant ||
          (paramModelId && activeModels.find((m) => m.id === paramModelId)) ||
          activeModels[0];

        const defaultDistrictId =
          profile?.district_id || searchParams.get('districtId') || dList[0]?.id || '';

        if (defaultModel) {
          setSelectedModelId(defaultModel.id);
          if (paramVariantId && defaultModel.variants.some((v) => v.id === paramVariantId)) {
            setSelectedVariantId(paramVariantId);
          } else if (defaultModel.variants.length > 0) {
            setSelectedVariantId(defaultModel.variants[0].id);
          }
        }
        setDistrictId(defaultDistrictId);
        setIsInitializing(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load catalog data.');
          setIsInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, profile?.district_id]);

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];
  const selectedVariant =
    selectedModel?.variants?.find((v) => v.id === selectedVariantId) || selectedModel?.variants?.[0];
  const selectedDistrict =
    districts.find((d) => d.id === districtId) || districts[0] || { id: '', name: 'Selected District', state: '' };
  const isLockedToProfileDistrict = Boolean(profile?.district_id);

  // Sync default variant only when changing models and current variant isn't in new model
  useEffect(() => {
    if (selectedModel && selectedModel.variants?.length > 0) {
      const stillValid = selectedModel.variants.some((v) => v.id === selectedVariantId);
      if (!stillValid) {
        setSelectedVariantId(selectedModel.variants[0].id);
      }
    }
  }, [selectedModel, selectedVariantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedVariant) return;
    setError('');
    setIsLoading(true);

    try {
      const res = await createGroup(
        selectedVariant.id,
        districtId,
        user.id,
        profile.full_name
      );

      if (res.success && res.groupId) {
        toast({
          type: 'success',
          title: 'Group Created Successfully',
          message: `Your district buying group is active. Share the invite link to reach ${visibilityThreshold} members and unlock dealer quotes!`,
        });
        navigate(`/buyer/groups/${res.groupId}`);
      } else {
        setError(res.error || 'Failed to create group');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <BuyerLayout>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <Link
            to="/buyer/groups/find"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Find Groups
          </Link>
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Start a New Buying Group
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create an aggregated tender for your desired variant in your district.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">1. Target District</CardTitle>
              <CardDescription>
                Buying groups are geographically bound so local authorized showrooms can fulfill deliveries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                disabled={isLockedToProfileDistrict}
                options={districts.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.state})`,
                }))}
                required
              />
              {isLockedToProfileDistrict && (
                <p className="text-[11px] text-slate-500">
                  Bound to your registered district. You can change your registered district in{' '}
                  <Link to="/buyer/profile" className="text-brand-600 font-semibold hover:underline">
                    Profile & Privacy
                  </Link>
                  .
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">2. Select Vehicle & Exact Variant</CardTitle>
              <CardDescription>
                AutoGroup matches members by exact variant to ensure dealers submit identical, competitive price comparisons.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Vehicle Model"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                options={models.map((m) => ({
                  value: m.id,
                  label: `${m.manufacturer?.name} ${m.name} (${m.body_type})`,
                }))}
                required
              />

              <Select
                label="Exact Variant"
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                options={(selectedModel?.variants || []).map((v) => ({
                  value: v.id,
                  label: `${v.name} (${v.transmission}, ${v.fuel_type}) — Ex: ${formatINR(v.ex_showroom_price)}`,
                }))}
                required
              />

              {/* Variant summary box */}
              {selectedVariant ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Indicative Ex-Showroom:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatINR(selectedVariant.ex_showroom_price)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Powertrain:</span>
                    <span className="text-slate-700 font-medium">
                      {selectedVariant.fuel_type || 'Petrol'} · {selectedVariant.transmission || 'Manual'}
                    </span>
                  </div>
                  {Array.isArray(selectedVariant.features) && selectedVariant.features.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                      {selectedVariant.features.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1 text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                  Select a variant above to inspect pricing and specifications.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-blue-50/40 border-brand-200/60">
            <CardHeader>
              <div className="flex items-center gap-2 text-brand-700 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span>Group Milestone & Dealer Visibility</span>
              </div>
              <CardTitle className="text-base text-slate-900">How Your Group Evolves</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <strong>Dealer Visibility Gate:</strong> Your group becomes visible to authorized dealerships in <strong>{selectedDistrict?.name || 'Selected District'}</strong> as soon as it reaches <strong>{visibilityThreshold} members</strong> (or after {visibilityDays} days with 2 members).
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <strong>Strong Group Milestone:</strong> {targetMembers} members is our milestone target ("Strong Group badge") to maximize volume attention from showroom heads, but dealers can begin quoting right at {visibilityThreshold} members.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <strong>Zero Obligation:</strong> You and any members can leave anytime prior to locking a price snapshot.
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full font-semibold"
            isLoading={isLoading}
            disabled={!selectedVariant || !districtId}
            leftIcon={<Users className="w-4 h-4" />}
          >
            Create Group in {selectedDistrict?.name || 'Selected District'}
          </Button>
        </form>
      </div>
    </BuyerLayout>
  );
}
