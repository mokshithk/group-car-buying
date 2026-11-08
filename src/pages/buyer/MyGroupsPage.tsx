import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchGroupsForDistrict } from '@/lib/groupService';
import { INITIAL_DISTRICTS } from '@/lib/catalogData';
import { Group } from '@/types';
import { Users, PlusCircle, ArrowRight, Compass, ShieldCheck } from 'lucide-react';

export function MyGroupsPage() {
  const { profile } = useAuth();
  const buyerDistrictId = profile?.district_id || 'd1111111-1111-1111-1111-111111111101';
  const currentDistrict =
    INITIAL_DISTRICTS.find((d) => d.id === buyerDistrictId) || INITIAL_DISTRICTS[0];

  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      // Fetch groups in district (representing user's active groups)
      const data = await fetchGroupsForDistrict(buyerDistrictId);
      // For preview, show user's active groups (first 2 groups)
      setMyGroups(data.slice(0, 3));
      setIsLoading(false);
    }
    load();
  }, [buyerDistrictId]);

  return (
    <BuyerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                My Buying Groups
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Groups you have created or joined in {currentDistrict.name}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/buyer/groups/find">
              <Button variant="secondary" size="sm" leftIcon={<Compass className="w-4 h-4" />}>
                Find More Groups
              </Button>
            </Link>
            <Link to="/buyer/groups/create">
              <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                New Group
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading your groups...</div>
        ) : myGroups.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">You haven't joined any groups yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
              Join an existing group or create one to pool purchasing power with neighbors in {currentDistrict.name}.
            </p>
            <div className="flex justify-center gap-3">
              <Link to="/buyer/groups/find">
                <Button variant="secondary" size="md">
                  Find Groups
                </Button>
              </Link>
              <Link to="/buyer/groups/create">
                <Button variant="primary" size="md">
                  Create Group
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {myGroups.map((group) => {
              const activeCount = group.member_count || 1;
              const statusBadges = {
                FORMING: <Badge variant="warning" size="sm">FORMING (Awaiting Members)</Badge>,
                OPEN_FOR_QUOTES: <Badge variant="brand" size="sm">OPEN FOR QUOTES</Badge>,
                OFFERS_RECEIVED: <Badge variant="success" size="sm">OFFERS RECEIVED</Badge>,
                COMPLETED: <Badge variant="default" size="sm">COMPLETED</Badge>,
                CANCELLED: <Badge variant="danger" size="sm">CANCELLED</Badge>,
                EXPIRED: <Badge variant="default" size="sm">EXPIRED</Badge>,
              };

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
                        {statusBadges[group.status] || <Badge variant="default" size="sm">{group.status}</Badge>}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">
                          {activeCount} Active Member{activeCount > 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        <span>
                          District: {currentDistrict.name}
                        </span>
                        <span>•</span>
                        <span>
                          {group.bookings_so_far || 0} Booked so far
                        </span>
                      </div>

                      {activeCount >= 3 && (
                        <div className="pt-1 text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Visible to authorized dealers — compare received quotations now</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Link to={`/buyer/groups/${group.id}`}>
                        <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                          {group.status === 'OPEN_FOR_QUOTES' || group.status === 'OFFERS_RECEIVED'
                            ? 'Compare Offers & Details'
                            : 'View Group Details'}
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
    </BuyerLayout>
  );
}
