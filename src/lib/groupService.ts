import { Group, GroupMember, WishlistItem, BuyerPreferences } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { INITIAL_MODELS, INITIAL_DISTRICTS } from './catalogData';

// Local store for fallback preview / offline testing
const LOCAL_GROUPS_KEY = 'autogroup_local_groups';
const LOCAL_MEMBERS_KEY = 'autogroup_local_members';
const LOCAL_WISHLIST_KEY = 'autogroup_local_wishlist';
const LOCAL_PREFS_KEY = 'autogroup_local_preferences';

function getInitialLocalGroups(): Group[] {
  const saved = localStorage.getItem(LOCAL_GROUPS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  // Pre-populate initial groups mirroring seed.sql (Valid hex IDs: f1111111-..., c1111111-...)
  const initial: Group[] = [
    {
      id: 'f1111111-1111-1111-1111-111111111101',
      variant_id: 'c1111111-1111-1111-1111-111111111102', // Nexon Creative Plus DCA
      district_id: 'd1111111-1111-1111-1111-111111111101', // Bengaluru Urban
      target_members: 10,
      status: 'OPEN_FOR_QUOTES',
      created_by: '11111111-1111-1111-1111-111111111101',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      member_count: 3,
      bookings_so_far: 1,
      is_visible_to_dealers: true,
      days_until_visible: 0,
    },
    {
      id: 'f1111111-1111-1111-1111-111111111102',
      variant_id: 'c1111111-1111-1111-1111-111111111105', // Creta SX(O) Turbo DCT
      district_id: 'd1111111-1111-1111-1111-111111111101', // Bengaluru Urban
      target_members: 10,
      status: 'OPEN_FOR_QUOTES',
      created_by: '11111111-1111-1111-1111-111111111102',
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      member_count: 2,
      bookings_so_far: 0,
      is_visible_to_dealers: true, // Visible by 20-day rule (25 days elapsed)
      days_until_visible: 0,
    },
    {
      id: 'f1111111-1111-1111-1111-111111111103',
      variant_id: 'c1111111-1111-1111-1111-111111111107', // XUV700 AX5
      district_id: 'd1111111-1111-1111-1111-111111111101', // Bengaluru Urban
      target_members: 10,
      status: 'FORMING',
      created_by: '11111111-1111-1111-1111-111111111103',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      member_count: 2,
      bookings_so_far: 0,
      is_visible_to_dealers: false,
      days_until_visible: 18,
    },
    {
      id: 'f1111111-1111-1111-1111-111111111104',
      variant_id: 'c1111111-1111-1111-1111-111111111110', // Virtus GT Plus
      district_id: 'd1111111-1111-1111-1111-111111111101', // Bengaluru Urban
      target_members: 10,
      status: 'FORMING',
      created_by: '11111111-1111-1111-1111-111111111104',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      member_count: 1,
      bookings_so_far: 0,
      is_visible_to_dealers: false,
      days_until_visible: 20,
    },
  ];

  localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(initial));
  return initial;
}

export function populateGroupRelations(g: Group): Group {
  for (const model of INITIAL_MODELS) {
    const v = model.variants.find((variant) => variant.id === g.variant_id);
    if (v) {
      return {
        ...g,
        variant: { ...v, model },
        district: INITIAL_DISTRICTS.find((d) => d.id === g.district_id) || INITIAL_DISTRICTS[0],
      };
    }
  }
  return g;
}

export async function fetchGroupsForDistrict(districtId: string): Promise<Group[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status)')
        .eq('district_id', districtId);

      if (!error && data && data.length > 0) {
        return data.map((item: any) => {
          const activeCount = item.group_members?.filter((m: any) => m.status === 'ACTIVE').length || 0;
          return {
            ...item,
            member_count: activeCount,
            is_visible_to_dealers: activeCount >= 3,
          };
        });
      }
    } catch {
      // fallback to local
    }
  }

  const local = getInitialLocalGroups();
  return local
    .filter((g) => g.district_id === districtId)
    .map(populateGroupRelations);
}

export async function fetchGroupById(groupId: string): Promise<Group | null> {
  const local = getInitialLocalGroups();
  const g = local.find((item) => item.id === groupId);
  if (!g) return null;
  return populateGroupRelations(g);
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const saved = localStorage.getItem(LOCAL_MEMBERS_KEY);
  let members: GroupMember[] = [];
  if (saved) {
    try {
      members = JSON.parse(saved);
    } catch {
      members = [];
    }
  }

  const groupMembers = members.filter((m) => m.group_id === groupId && m.status === 'ACTIVE');
  if (groupMembers.length === 0) {
    // Return sample seeded members (Valid hex IDs: fc111111-..., 11111111-...)
    return [
      {
        id: 'fc111111-1111-1111-1111-111111111101',
        group_id: groupId,
        user_id: '11111111-1111-1111-1111-111111111101',
        is_creator: true,
        status: 'ACTIVE',
        joined_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          id: '11111111-1111-1111-1111-111111111101',
          role: 'buyer',
          full_name: 'Rahul Sharma',
          phone: '+91 98765 43210',
          consent_share_details: true,
          created_at: '',
          updated_at: '',
        },
      },
      {
        id: 'fc111111-1111-1111-1111-111111111102',
        group_id: groupId,
        user_id: '11111111-1111-1111-1111-111111111102',
        is_creator: false,
        status: 'ACTIVE',
        joined_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          id: '11111111-1111-1111-1111-111111111102',
          role: 'buyer',
          full_name: 'Ananya Verma',
          phone: '+91 98111 22334',
          consent_share_details: true,
          created_at: '',
          updated_at: '',
        },
      },
    ];
  }
  return groupMembers;
}

export async function joinGroup(
  groupId: string,
  userId: string,
  userFullName: string
): Promise<{ success: boolean; error?: string }> {
  const groups = getInitialLocalGroups();
  const targetGroup = groups.find((g) => g.id === groupId);
  if (!targetGroup) return { success: false, error: 'Group not found' };

  // Rule check: Matching is by SAME VARIANT only. One group per buyer per variant.
  const savedMembers = localStorage.getItem(LOCAL_MEMBERS_KEY);
  const allMembers: GroupMember[] = savedMembers ? JSON.parse(savedMembers) : [];

  const existingVariantMembership = allMembers.find((m) => {
    if (m.user_id !== userId || m.status !== 'ACTIVE') return false;
    const g = groups.find((grp) => grp.id === m.group_id);
    return g?.variant_id === targetGroup.variant_id;
  });

  if (existingVariantMembership) {
    return {
      success: false,
      error: 'You are already an active member of another group for this exact car variant. Platform rule: one group per buyer per variant.',
    };
  }

  // Add membership
  const newMember: GroupMember = {
    id: crypto.randomUUID(),
    group_id: groupId,
    user_id: userId,
    is_creator: false,
    status: 'ACTIVE',
    joined_at: new Date().toISOString(),
    profile: {
      id: userId,
      role: 'buyer',
      full_name: userFullName,
      phone: '+91 98765 43210',
      consent_share_details: true,
      created_at: '',
      updated_at: '',
    },
  };

  allMembers.push(newMember);
  localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(allMembers));

  // Update group member count
  targetGroup.member_count = (targetGroup.member_count || 1) + 1;
  if (targetGroup.member_count >= 3 && targetGroup.status === 'FORMING') {
    targetGroup.status = 'OPEN_FOR_QUOTES';
    targetGroup.is_visible_to_dealers = true;
  }
  localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));

  return { success: true };
}

export async function leaveGroup(
  groupId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const savedMembers = localStorage.getItem(LOCAL_MEMBERS_KEY);
  let allMembers: GroupMember[] = savedMembers ? JSON.parse(savedMembers) : [];

  const memberIndex = allMembers.findIndex(
    (m) => m.group_id === groupId && m.user_id === userId && m.status === 'ACTIVE'
  );
  if (memberIndex === -1) {
    // If leaving a seed group
    const groups = getInitialLocalGroups();
    const g = groups.find((item) => item.id === groupId);
    if (g && (g.member_count || 0) > 0) {
      g.member_count = Math.max(0, (g.member_count || 1) - 1);
      localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));
    }
    return { success: true };
  }

  const leavingMember = allMembers[memberIndex];
  leavingMember.status = 'LEFT';
  leavingMember.left_at = new Date().toISOString();

  // If creator leaves, promote next active member
  if (leavingMember.is_creator) {
    const nextMember = allMembers.find(
      (m) => m.group_id === groupId && m.status === 'ACTIVE' && m.id !== leavingMember.id
    );
    if (nextMember) {
      nextMember.is_creator = true;
    }
  }

  localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(allMembers));

  const groups = getInitialLocalGroups();
  const g = groups.find((item) => item.id === groupId);
  if (g && (g.member_count || 0) > 0) {
    g.member_count = (g.member_count || 1) - 1;
    localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));
  }

  return { success: true };
}

export async function createGroup(
  variantId: string,
  districtId: string,
  userId: string,
  userFullName: string
): Promise<{ success: boolean; groupId?: string; error?: string }> {
  const groups = getInitialLocalGroups();

  // Rule: Check if buyer already has an active group for this variant
  const savedMembers = localStorage.getItem(LOCAL_MEMBERS_KEY);
  const allMembers: GroupMember[] = savedMembers ? JSON.parse(savedMembers) : [];

  const existingVariantMembership = allMembers.find((m) => {
    if (m.user_id !== userId || m.status !== 'ACTIVE') return false;
    const g = groups.find((grp) => grp.id === m.group_id);
    return g?.variant_id === variantId;
  });

  if (existingVariantMembership) {
    return {
      success: false,
      error: 'You already belong to an active group for this car variant. One group per buyer per variant is enforced.',
    };
  }

  const newGroupId = crypto.randomUUID();
  const newGroup: Group = {
    id: newGroupId,
    variant_id: variantId,
    district_id: districtId,
    target_members: 10,
    status: 'FORMING',
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    member_count: 1,
    bookings_so_far: 0,
    is_visible_to_dealers: false,
    days_until_visible: 20,
  };

  groups.unshift(newGroup);
  localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));

  // Add creator as member
  const creatorMember: GroupMember = {
    id: crypto.randomUUID(),
    group_id: newGroupId,
    user_id: userId,
    is_creator: true,
    status: 'ACTIVE',
    joined_at: new Date().toISOString(),
    profile: {
      id: userId,
      role: 'buyer',
      full_name: userFullName,
      phone: '+91 98765 43210',
      consent_share_details: true,
      created_at: '',
      updated_at: '',
    },
  };

  allMembers.push(creatorMember);
  localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(allMembers));

  return { success: true, groupId: newGroupId };
}

// Wishlist helpers
export function getWishlist(userId: string): WishlistItem[] {
  const saved = localStorage.getItem(`${LOCAL_WISHLIST_KEY}_${userId}`);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function toggleWishlist(variantId: string, userId: string): boolean {
  const current = getWishlist(userId);
  const exists = current.some((item) => item.variant_id === variantId);

  let updated: WishlistItem[];
  if (exists) {
    updated = current.filter((item) => item.variant_id !== variantId);
  } else {
    updated = [
      ...current,
      {
        id: 'wl-' + Math.random().toString(36).substring(2, 9),
        user_id: userId,
        variant_id: variantId,
        created_at: new Date().toISOString(),
      },
    ];
  }

  localStorage.setItem(`${LOCAL_WISHLIST_KEY}_${userId}`, JSON.stringify(updated));
  return !exists; // returns true if added, false if removed
}

// Preferences helpers
export function getBuyerPreferences(userId: string): BuyerPreferences {
  const saved = localStorage.getItem(`${LOCAL_PREFS_KEY}_${userId}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  return {
    id: 'pref-' + userId,
    user_id: userId,
    district_id: 'd1111111-1111-1111-1111-111111111101',
    preferred_brands: ['Tata Motors', 'Hyundai'],
    preferred_fuel_types: ['Petrol', 'Diesel'],
    budget_min: 800000,
    budget_max: 2000000,
    updated_at: new Date().toISOString(),
  };
}

export function saveBuyerPreferences(userId: string, prefs: BuyerPreferences): void {
  localStorage.setItem(`${LOCAL_PREFS_KEY}_${userId}`, JSON.stringify(prefs));
}
