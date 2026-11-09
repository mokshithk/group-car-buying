import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchGroupsForDistrict, getWishlist } from '@/lib/groupService';
import { formatINR } from '@/lib/formatters';
import { Group } from '@/types';
import {
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Bookmark,
  Clock,
  CheckCircle2,
  Tag,
} from 'lucide-react';

export function BuyerDashboardPage() {
  const { profile, user } = useAuth();
  const districtId = profile?.district_id || 'd1111111-1111-1111-1111-111111111101';

  const [activeGroups, setActiveGroups] = useState<Group[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const groups = await fetchGroupsForDistrict(districtId);
      setActiveGroups(groups.slice(0, 3));
      if (user) {
        const wl = await getWishlist(user.id);
        setWishlistCount(wl.length);
      }
      setIsLoading(false);
    }
    load();
  }, [districtId, user]);

  return (
    <BuyerLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Buyer'} 👋
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Active tenders and quotation comparisons in your district.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/buyer/groups/find">
              <Button variant="secondary" size="sm" leftIcon={<Compass className="w-4 h-4" />}>
                Find Groups
              </Button>
            </Link>
            <Link to="/buyer/groups/create">
              <Button variant="primary" size="sm" leftIcon={<Users className="w-4 h-4" />}>
                Create Group
              </Button>
            </Link>
          </div>
        </div>

        {/* EXPIRING QUOTE WARNING BANNER (Section 3) */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-bold text-amber-900">
              Quotation Expiring Soon: Tata Nexon Creative Plus DCA
            </div>
            <p className="text-amber-800 mt-0.5 leading-relaxed">
              Dealership quotation from <strong>Apex Motors</strong> is set to expire in 48 hours. Review the on-road price breakdown and lock your price if you wish to proceed.
            </p>
          </div>
          <Link to="/buyer/groups/f1111111-1111-1111-1111-111111111101/offers" className="shrink-0">
            <Button variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 text-xs">
              Review Quote
            </Button>
          </Link>
        </div>

        {/* SUMMARY STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Active Groups</span>
              <Users className="w-4 h-4 text-brand-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {activeGroups.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">In your district</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Live Quotes</span>
              <Tag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">4</div>
            <div className="text-[11px] text-slate-500 mt-1">From verified showrooms</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">My Bookings</span>
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">1</div>
            <div className="text-[11px] text-indigo-600 font-medium mt-1">Price locked</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Saved Wishlist</span>
              <Bookmark className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {wishlistCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Variants tracked</div>
          </Card>
        </div>

        {/* MY ACTIVE GROUPS WITH STATUS-BASED ACTIONS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">My District Groups</h2>
            <Link to="/buyer/groups" className="text-xs font-semibold text-brand-600 hover:underline">
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400">Loading your active groups...</div>
          ) : activeGroups.length === 0 ? (
            <Card className="text-center py-12 p-6">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No active groups</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                You haven't joined any district buying groups yet.
              </p>
              <Link to="/buyer/groups/find">
                <Button variant="primary" size="sm">
                  Find Buying Groups
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeGroups.map((group) => {
                const activeCount = group.member_count || 1;
                const isStrong = activeCount >= (group.target_members || 10);

                return (
                  <Card key={group.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="brand" size="sm">
                            {group.variant?.model?.manufacturer?.name}
                          </Badge>
                          <h3 className="text-base font-bold text-slate-900">
                            {group.variant?.model?.name} — {group.variant?.name}
                          </h3>
                          {isStrong && (
                            <Badge variant="milestone" size="sm">
                              <Sparkles className="w-3 h-3 text-indigo-600 mr-1" /> Strong
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>{activeCount} Members</span>
                          <span>•</span>
                          <span>Ex-Showroom: {formatINR(group.variant?.ex_showroom_price)}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">Quotes available</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link to={`/buyer/groups/${group.id}`}>
                          <Button variant="secondary" size="sm">
                            Group Info
                          </Button>
                        </Link>
                        <Link to={`/buyer/groups/${group.id}/offers`}>
                          <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                            Compare Quotes
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

        {/* RECENT ACTIVITY FEED */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Platform Activity</h2>
          <Card className="divide-y divide-slate-100 p-2">
            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Tag className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="font-semibold text-slate-900">
                  Southern Star Auto lowered quotation for Tata Nexon Creative Plus DCA
                </div>
                <div className="text-slate-500 mt-0.5">
                  On-road price revised to ₹14,08,000 (extra ₹10,000 corporate group incentive applied).
                </div>
                <div className="text-[10px] text-slate-400 mt-1">2 hours ago</div>
              </div>
            </div>

            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="font-semibold text-slate-900">
                  New member joined Hyundai Creta SX (O) Turbo DCT
                </div>
                <div className="text-slate-500 mt-0.5">
                  Member <strong>Vikram R.</strong> joined your district tender. Group now has 2 members.
                </div>
                <div className="text-[10px] text-slate-400 mt-1">1 day ago</div>
              </div>
            </div>

            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="font-semibold text-slate-900">
                  Dealer Visibility Threshold Reached
                </div>
                <div className="text-slate-500 mt-0.5">
                  Your Tata Nexon tender reached 3 active members and unlocked dealership competitive quoting.
                </div>
                <div className="text-[10px] text-slate-400 mt-1">3 days ago</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </BuyerLayout>
  );
}
