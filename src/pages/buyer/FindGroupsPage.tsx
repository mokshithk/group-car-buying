import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card, Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { fetchGroupsForDistrict, joinGroup } from '@/lib/groupService';
import { fetchDistricts } from '@/lib/catalogService';
import { formatINR, calculateDaysUntilVisible } from '@/lib/formatters';
import { Group, District } from '@/types';
import {
  Compass,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';

export function FindGroupsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterVariantId = searchParams.get('variantId');

  const [districts, setDistricts] = useState<District[]>([]);
  const buyerDistrictId = profile?.district_id || 'd1111111-1111-1111-1111-111111111101';
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(buyerDistrictId);

  useEffect(() => {
    if (profile?.district_id) {
      setSelectedDistrictId(profile.district_id);
    }
  }, [profile?.district_id]);

  const currentDistrict =
    districts.find((d) => d.id === selectedDistrictId) ||
    districts[0] ||
    { id: selectedDistrictId, name: 'Selected District', state: '' };

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Join confirmation modal state
  const [selectedGroupToJoin, setSelectedGroupToJoin] = useState<Group | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchDistricts()
      .then(setDistricts)
      .catch((err) => console.error('Failed to load districts:', err));
  }, []);

  useEffect(() => {
    async function load() {
      if (!selectedDistrictId) return;
      setIsLoading(true);
      try {
        const data = await fetchGroupsForDistrict(selectedDistrictId);
        if (filterVariantId) {
          setGroups(data.filter((g) => g.variant_id === filterVariantId));
        } else {
          setGroups(data);
        }
      } catch (err) {
        console.error('Failed to load groups for district:', err);
      }
      setIsLoading(false);
    }
    load();
  }, [selectedDistrictId, filterVariantId]);

  const handleConfirmJoin = async () => {
    if (!selectedGroupToJoin || !user || !profile) return;
    setIsJoining(true);

    const res = await joinGroup(selectedGroupToJoin.id, user.id, profile.full_name);
    setIsJoining(false);

    if (res.success) {
      toast({
        type: 'success',
        title: 'Joined Group Successfully',
        message: 'You are now a member. You will receive alerts when dealers quote or update prices.',
      });
      setSelectedGroupToJoin(null);
      navigate(`/buyer/groups/${selectedGroupToJoin.id}`);
    } else {
      toast({
        type: 'error',
        title: 'Could Not Join Group',
        message: res.error || 'Failed to join group',
      });
    }
  };

  return (
    <BuyerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-brand-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Find Buying Groups
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active tenders in: <strong className="text-slate-800">{currentDistrict.name} ({currentDistrict.state})</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">District:</span>
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
            </div>

            <Link to="/buyer/groups/create">
              <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                Create New Group
              </Button>
            </Link>
          </div>
        </div>

        {/* Group Listing */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading district groups...</div>
        ) : groups.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              No active groups found in {currentDistrict.name}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Be the first to start a group for your desired car model and invite friends or local buyers to join.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/buyer/groups/create">
                <Button variant="primary" size="md" leftIcon={<PlusCircle className="w-4 h-4" />}>
                  Start a New Group in {currentDistrict.name}
                </Button>
              </Link>
              {selectedDistrictId !== 'd1111111-1111-1111-1111-111111111101' && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedDistrictId('d1111111-1111-1111-1111-111111111101')}
                >
                  View Bengaluru Urban Groups
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {groups.map((group) => {
              const activeCount = group.member_count || 1;
              const isTargetReached = activeCount >= (group.target_members || 10);
              const daysInfo = calculateDaysUntilVisible(group.created_at, 20);

              return (
                <Card key={group.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="brand" size="sm">
                          {group.variant?.model?.manufacturer?.name || 'Manufacturer'}
                        </Badge>
                        <h3 className="text-lg font-bold text-slate-900">
                          {group.variant?.model?.name} — {group.variant?.name}
                        </h3>
                        {/* Milestone Badge: "Strong group" */}
                        {isTargetReached && (
                          <Badge variant="milestone" size="sm">
                            <Sparkles className="w-3 h-3 text-indigo-600 mr-1" />
                            Strong Group ({activeCount}/{group.target_members})
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <Users className="w-4 h-4 text-brand-600" />
                          {activeCount} Active Member{activeCount > 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        <span>
                          Target: {group.target_members} (Milestone)
                        </span>
                        <span>•</span>
                        <span>
                          Indicative Ex-Showroom:{' '}
                          <strong className="text-slate-900">
                            {formatINR(group.variant?.ex_showroom_price)}
                          </strong>
                        </span>
                      </div>

                      {/* Visibility countdown badge if < 3 members */}
                      <div className="pt-2">
                        {activeCount >= 3 || (activeCount === 2 && daysInfo.isVisible) ? (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Visible to Authorized Dealerships for Quotations
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            {activeCount === 2 ? (
                              <span>
                                Becomes visible to dealers in{' '}
                                <strong>{daysInfo.daysRemaining} days</strong> (or immediately at 3 members)
                              </span>
                            ) : (
                              <span>
                                Becomes visible to dealers at 3 members, or after 20 days with 2 members.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                      <Link to={`/buyer/groups/${group.id}`}>
                        <Button variant="secondary" size="md">
                          View Group
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => setSelectedGroupToJoin(group)}
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        Join Group
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* JOIN CONFIRMATION MODAL WITH REQUIRED NOTICE (Section 2 & 3) */}
        <Modal
          isOpen={!!selectedGroupToJoin}
          onClose={() => setSelectedGroupToJoin(null)}
          title="Join Buying Group"
          description="Review platform terms before joining this district buying group."
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSelectedGroupToJoin(null)}
                disabled={isJoining}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmJoin}
                isLoading={isJoining}
              >
                Confirm & Join Group
              </Button>
            </div>
          }
        >
          {selectedGroupToJoin && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="font-bold text-slate-900 text-sm">
                  {selectedGroupToJoin.variant?.model?.name} — {selectedGroupToJoin.variant?.name}
                </div>
                <div className="text-slate-600">
                  District: {currentDistrict.name} ({currentDistrict.state})
                </div>
                <div className="text-slate-600">
                  Current Members: {selectedGroupToJoin.member_count || 1}
                </div>
              </div>

              {/* Mandatory Notice */}
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Joining does not oblige you to buy</span>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Joining a group simply pools interest so authorized showrooms submit competitive quotes. You can leave the group at any time before booking without any fee or penalty.
                </p>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400 inline mr-1" />
                Your name will be visible to fellow group members as First Name + Last Initial only (e.g., "Rahul S."). Showrooms will never see your phone or email until you choose to express interest or book.
              </div>
            </div>
          )}
        </Modal>
      </div>
    </BuyerLayout>
  );
}
