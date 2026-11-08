import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { fetchGroupById, fetchGroupMembers, leaveGroup, joinGroup } from '@/lib/groupService';
import { formatINR, formatMemberName, calculateDaysUntilVisible, formatDate } from '@/lib/formatters';
import { Group, GroupMember } from '@/types';
import {
  Clock,
  Sparkles,
  Share2,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  FileText,
  Compass,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Leave confirmation modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);
      const g = await fetchGroupById(id);
      if (g) {
        setGroup(g);
        const m = await fetchGroupMembers(g.id);
        setMembers(m);
      }
      setIsLoading(false);
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center text-slate-400">Loading group details...</div>
      </BuyerLayout>
    );
  }

  // Handle cancelled or expired group state (Section 2)
  if (group && (group.status === 'CANCELLED' || group.status === 'EXPIRED')) {
    return (
      <BuyerLayout>
        <div className="max-w-xl mx-auto py-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <Badge variant="danger" size="md">Group {group.status}</Badge>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              This buying group has concluded
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              The validity window has closed or the creator cancelled this tender before booking.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/buyer/groups/find">
              <Button variant="secondary" size="md" leftIcon={<Compass className="w-4 h-4" />}>
                Find a Similar Group
              </Button>
            </Link>
            <Link to="/buyer/groups/create">
              <Button variant="primary" size="md" leftIcon={<PlusCircle className="w-4 h-4" />}>
                Create a New Group
              </Button>
            </Link>
          </div>
        </div>
      </BuyerLayout>
    );
  }

  if (!group) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Group not found</h2>
          <Link to="/buyer/groups/find">
            <Button variant="secondary" size="sm">Back to Find Groups</Button>
          </Link>
        </div>
      </BuyerLayout>
    );
  }

  const activeCount = group.member_count || members.length || 1;
  const isMember = members.some((m) => m.user_id === user?.id && m.status === 'ACTIVE');
  const isCreator = members.some((m) => m.user_id === user?.id && m.is_creator && m.status === 'ACTIVE');
  const isStrongGroup = activeCount >= (group.target_members || 10);
  const daysInfo = calculateDaysUntilVisible(group.created_at, 20);
  const isVisibleToDealers = activeCount >= 3 || (activeCount === 2 && daysInfo.isVisible);

  const inviteUrl = `${window.location.origin}/buyer/groups/find?variantId=${group.variant_id}&inviteGroup=${group.id}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    toast({
      type: 'success',
      title: 'Invite Link Copied!',
      message: 'Share this link with interested buyers in your district.',
    });
    setTimeout(() => setCopiedInvite(false), 3000);
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    setIsLeaving(true);
    const res = await leaveGroup(group.id, user.id);
    setIsLeaving(false);

    if (res.success) {
      toast({
        type: 'info',
        title: 'You left the group',
        message: 'You have been removed. You can rejoin at any time while the group remains open.',
      });
      setShowLeaveModal(false);
      navigate('/buyer/groups');
    }
  };

  const handleRejoin = async () => {
    if (!user || !profile) return;
    const res = await joinGroup(group.id, user.id, profile.full_name);
    if (res.success) {
      toast({
        type: 'success',
        title: 'Rejoined Group',
        message: 'You are now an active member again.',
      });
      const updatedMembers = await fetchGroupMembers(group.id);
      setMembers(updatedMembers);
    } else {
      toast({
        type: 'error',
        title: 'Could not rejoin',
        message: res.error,
      });
    }
  };

  return (
    <BuyerLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/buyer/groups"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to My Groups
          </Link>
          {isMember && (
            <button
              onClick={() => setShowLeaveModal(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave Group
            </button>
          )}
        </div>

        {/* Group Header Card */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">{group.variant?.model?.manufacturer?.name}</Badge>
                <Badge variant="outline">{group.variant?.transmission}</Badge>
                <Badge variant="default">{group.variant?.fuel_type}</Badge>
                {isStrongGroup && (
                  <Badge variant="milestone">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 mr-1" />
                    Strong Group ({activeCount}/{group.target_members})
                  </Badge>
                )}
                {isCreator && (
                  <Badge variant="default" className="bg-slate-800 text-white border-slate-700">
                    You are Group Creator
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {group.variant?.model?.name} — {group.variant?.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  District: <strong className="text-slate-900">{group.district?.name}</strong>
                </span>
                <span>•</span>
                <span>
                  Created: <strong>{formatDate(group.created_at)}</strong>
                </span>
                <span>•</span>
                <span>
                  Indicative Ex-Showroom:{' '}
                  <strong className="text-slate-900">
                    {formatINR(group.variant?.ex_showroom_price)}
                  </strong>
                </span>
                <span>•</span>
                <span className="text-brand-700 font-semibold">
                  {group.bookings_so_far || 0} Booked So Far
                </span>
              </div>

              {/* Waiting text / Countdown or Visibility Confirmation */}
              <div className="pt-2">
                {isVisibleToDealers ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Visible to Authorized Dealers:</strong> Showrooms in {group.district?.name} are actively reviewing this group and submitting quotes.
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-bold">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Dealer Visibility Waiting Gate</span>
                    </div>
                    <p className="leading-relaxed">
                      {activeCount === 2 ? (
                        <>
                          This group has 2 members. It automatically becomes visible to dealers in{' '}
                          <strong>{daysInfo.daysRemaining} days</strong>, or immediately upon a 3rd member joining.
                        </>
                      ) : (
                        <>Becomes visible to dealers at 3 members, or after 20 days with 2 members.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <Link to={`/buyer/groups/${group.id}/offers`}>
                <Button variant="primary" size="lg" className="w-full font-bold shadow-sm" rightIcon={<FileText className="w-4 h-4" />}>
                  Compare Dealer Quotes
                </Button>
              </Link>

              {!isMember && (
                <Button variant="secondary" size="lg" className="w-full" onClick={handleRejoin}>
                  Rejoin This Group
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* PROMOTED INVITE LINK (Promoted while group has < 3 members) */}
        {activeCount < 3 && (
          <Card className="bg-gradient-to-r from-blue-500/10 via-brand-50 to-indigo-500/10 border-brand-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700">
                  <Share2 className="w-4 h-4" />
                  <span>Invite Local Buyers & Unlock Quotes Faster</span>
                </div>
                <p className="text-xs text-slate-600 max-w-lg">
                  Share your private group invite link. Once 3 buyers in {group.district?.name} join, dealers are immediately notified to submit quotations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopyInvite}
                  leftIcon={copiedInvite ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                >
                  {copiedInvite ? 'Link Copied!' : 'Copy Invite Link'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* 2-COLUMN LAYOUT: MEMBERS (REDACTED) & STATUS TIMELINE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Members list (Section 2 & 3: First name + initial only) */}
          <div className="lg:col-span-6 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base text-slate-900">
                    Group Members ({activeCount})
                  </CardTitle>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Privacy enforced: First name + last initial only</span>
                  </div>
                </div>
                {isStrongGroup && <Badge variant="milestone" size="sm">Strong</Badge>}
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100">
                  {members.map((m, index) => (
                    <div key={m.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                          {m.profile?.full_name ? m.profile.full_name.charAt(0) : index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                            {formatMemberName(m.profile?.full_name)}
                            {m.is_creator && (
                              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                                Creator
                              </span>
                            )}
                            {m.user_id === user?.id && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Joined {formatDate(m.joined_at)}
                          </div>
                        </div>
                      </div>

                      <Badge variant="success" size="sm">Active</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* STATUS TIMELINE & AUDIT LOG */}
          <div className="lg:col-span-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">Group Status Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {/* Event 1 */}
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-brand-600 ring-4 ring-white" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Group Created</div>
                      <div className="text-[11px] text-slate-500">{formatDate(group.created_at)}</div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Initiated in {group.district?.name} with milestone target of {group.target_members} members.
                      </p>
                    </div>
                  </div>

                  {/* Event 2 */}
                  <div className="relative flex items-start gap-3">
                    <div
                      className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                        isVisibleToDealers ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Dealer Visibility Unlocked</div>
                      <div className="text-[11px] text-slate-500">
                        {isVisibleToDealers ? 'Condition Met' : 'Awaiting 3 members or 20-day rule'}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {isVisibleToDealers
                          ? 'Group tender opened to verified district dealerships.'
                          : 'Dealerships will be invited once membership threshold is achieved.'}
                      </p>
                    </div>
                  </div>

                  {/* Event 3 */}
                  <div className="relative flex items-start gap-3">
                    <div
                      className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                        group.status === 'OPEN_FOR_QUOTES' || group.status === 'OFFERS_RECEIVED'
                          ? 'bg-brand-600'
                          : 'bg-slate-300'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Quotation Competition</div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Dealers submit competitive, itemized on-road prices. Buyers compare and choose "I'm interested" or "Book now".
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Privacy notice box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <strong>Ownership Rule:</strong> If the group creator leaves, the next active member is automatically designated as group owner.
              </div>
            </div>
          </div>
        </div>

        {/* LEAVE GROUP MODAL */}
        <Modal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          title="Leave This Group?"
          description="You can leave at any time before booking without any penalty."
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="secondary" size="md" onClick={() => setShowLeaveModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleLeaveGroup}
                isLoading={isLeaving}
              >
                Confirm Leave Group
              </Button>
            </div>
          }
        >
          <div className="text-xs text-slate-600 space-y-2 pt-2">
            <p>
              Are you sure you want to leave <strong>{group.variant?.model?.name} ({group.variant?.name})</strong>?
            </p>
            {isCreator && (
              <p className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                ⚠️ As the group creator, leaving will transfer group ownership to the next active member.
              </p>
            )}
            <p>You can rejoin later if you change your mind while the group is active.</p>
          </div>
        </Modal>
      </div>
    </BuyerLayout>
  );
}
