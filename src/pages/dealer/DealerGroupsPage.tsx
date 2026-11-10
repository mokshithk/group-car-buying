import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card, Input, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchDealerEligibleGroups } from '@/lib/groupService';
import { fetchDealerQuotations } from '@/lib/quoteService';
import { fetchPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '@/lib/catalogService';
import { formatINR } from '@/lib/formatters';
import { Group, Quotation } from '@/types';
import {
  Users,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export function DealerGroupsPage() {
  const { dealership } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [myQuotesByGroup, setMyQuotesByGroup] = useState<Record<string, Quotation>>({});
  const [visibilityThreshold, setVisibilityThreshold] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.visibilityMemberThreshold
  );
  const [visibilityDays, setVisibilityDays] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.groupVisibilityDaysFor2Members
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!dealership?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const districtIds = Array.from(
          new Set([dealership.district_id, ...(dealership.districts || [])].filter(Boolean))
        ) as string[];

        const [visible, myQuotes, settings] = await Promise.all([
          fetchDealerEligibleGroups(districtIds, dealership.brands || []),
          fetchDealerQuotations(dealership.id),
          fetchPlatformSettings(),
        ]);

        if (cancelled) return;

        setGroups(visible);
        const qMap: Record<string, Quotation> = {};
        for (const q of myQuotes) {
          qMap[q.group_id] = q;
        }
        setMyQuotesByGroup(qMap);
        setVisibilityThreshold(settings.visibilityMemberThreshold);
        setVisibilityDays(settings.groupVisibilityDaysFor2Members);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load eligible groups.');
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
  }, [dealership]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const brand = g.variant?.model?.manufacturer?.name || '';
      const matchesBrand = selectedBrand === 'All' || brand === selectedBrand;
      const matchesSearch =
        !searchQuery ||
        g.variant?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.variant?.model?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.district?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBrand && matchesSearch;
    });
  }, [groups, selectedBrand, searchQuery]);

  return (
    <DealerLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Eligible Group Tenders
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visible buying groups matching your authorized OEM brands and operating district(s).
          </p>
        </div>

        {/* Filter bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            placeholder="Search by model, variant, or district..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
          <Select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            options={[
              { value: 'All', label: 'All Authorized Brands' },
              ...(dealership?.brands || []).map((b) => ({
                value: b,
                label: b,
              })),
            ]}
          />
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading eligible groups...</div>
        ) : filteredGroups.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No eligible groups found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Groups with 1 member or forming groups (&lt; {visibilityDays} days with 2 members) remain hidden until reaching {visibilityThreshold} members or eligibility.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredGroups.map((group) => {
              const activeCount = group.member_count ?? 0;
              const bookingsCount = group.bookings_so_far || 0;
              const myQuote = myQuotesByGroup[group.id];

              return (
                <Card key={group.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="brand" size="sm">
                          {group.variant?.model?.manufacturer?.name}
                        </Badge>
                        <h3 className="text-lg font-bold text-slate-900">
                          {group.variant?.model?.name} — {group.variant?.name}
                        </h3>
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />
                          Visible Tender
                        </Badge>
                        {myQuote && (
                          <Badge variant="milestone" size="sm">
                            Quoted {formatINR(myQuote.on_road_price)}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <Users className="w-4 h-4 text-brand-600" />
                          {activeCount} Active Buyer{activeCount === 1 ? '' : 's'}
                        </span>
                        <span>•</span>
                        <span>District: {group.district?.name || '—'}</span>
                        <span>•</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {bookingsCount} Booking{bookingsCount !== 1 ? 's' : ''} so far
                        </span>
                        <span>•</span>
                        <span>
                          Indicative Ex-Showroom:{' '}
                          <strong className="text-slate-900">
                            {formatINR(group.variant?.ex_showroom_price)}
                          </strong>
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Powertrain: {group.variant?.fuel_type} · {group.variant?.transmission}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
                      <Link to={`/dealer/groups/${group.id}`}>
                        <Button variant="secondary" size="md">
                          Competitor Quotes
                        </Button>
                      </Link>
                      <Link to={`/dealer/groups/${group.id}/quote`}>
                        <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                          {myQuote ? 'Revise Quote' : 'Submit Quote'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DealerLayout>
  );
}
