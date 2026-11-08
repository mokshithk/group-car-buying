import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card, Input, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchGroupsForDistrict } from '@/lib/groupService';
import { formatINR } from '@/lib/formatters';
import { Group } from '@/types';
import {
  Users,
  Search,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export function DealerGroupsPage() {
  const { dealership } = useAuth();
  const districtId = dealership?.district_id || 'd1111111-1111-1111-1111-111111111101';

  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const allGroups = await fetchGroupsForDistrict(districtId);

      // Business Rule (Section 2):
      // Dealer sees ONLY groups meeting the visibility rule:
      // (>= 3 members, or == 2 members after 20 days)
      const visible = allGroups.filter(
        (g) => (g.member_count || 1) >= 3 || g.is_visible_to_dealers
      );
      setGroups(visible);
      setIsLoading(false);
    }
    load();
  }, [districtId]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const brand = g.variant?.model?.manufacturer?.name || '';
      const matchesBrand = selectedBrand === 'All' || brand === selectedBrand;
      const matchesSearch =
        !searchQuery ||
        g.variant?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.variant?.model?.name.toLowerCase().includes(searchQuery.toLowerCase());
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
            Groups in your operating district that have met the visibility requirement and are open for quotations.
          </p>
        </div>

        {/* Filter bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            placeholder="Search by model or variant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
          <Select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            options={[
              { value: 'All', label: 'All Authorized Brands' },
              ...(dealership?.brands || ['Tata Motors', 'Hyundai']).map((b) => ({
                value: b,
                label: b,
              })),
            ]}
          />
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading eligible groups...</div>
        ) : filteredGroups.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No eligible groups found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Groups with 1 member or forming groups (&lt; 20 days with 2 members) are hidden until meeting the visibility threshold.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredGroups.map((group) => {
              const activeCount = group.member_count || 1;
              const bookingsCount = group.bookings_so_far || 0;

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
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <Users className="w-4 h-4 text-brand-600" />
                          {activeCount} Active Buyer{activeCount > 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        {/* Bookings-so-far counter per group (Section 2) */}
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
                          Submit / Edit Quote
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
