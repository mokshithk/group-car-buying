import { Group, GroupMember, WishlistItem, BuyerPreferences } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Group Service: Real Supabase implementation
 * Implements business rules for groups, memberships, visibility, and buyer lists.
 * No mock arrays or in-memory fallbacks.
 */

export async function fetchGroupsForDistrict(districtId: string): Promise<Group[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('groups')
    .select('*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status, user_id), bookings(id, status)')
    .eq('district_id', districtId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch groups for district: ${error.message}`);
  }

  return (data || []).map((item: any) => {
    const activeMembers = item.group_members?.filter((m: any) => m.status === 'ACTIVE') || [];
    const activeCount = activeMembers.length;
    const bookingsCount = item.bookings?.filter((b: any) => b.status === 'PAID' || b.status === 'DELIVERED').length || 0;
    const daysOld = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
    
    // Visibility rule: Active >= 3 OR (Active == 2 AND elapsed days >= 20). 1 member is NEVER visible.
    const isVisible = activeCount >= 3 || (activeCount === 2 && daysOld >= 20);
    const daysUntilVisible = activeCount === 2 ? Math.max(0, 20 - daysOld) : (activeCount === 1 ? 20 : 0);

    return {
      ...item,
      member_count: activeCount,
      bookings_so_far: bookingsCount,
      is_visible_to_dealers: isVisible,
      days_until_visible: daysUntilVisible,
    };
  });
}

export async function fetchGroupById(groupId: string): Promise<Group | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('groups')
    .select('*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status, user_id), bookings(id, status)')
    .eq('id', groupId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch group: ${error.message}`);
  }

  if (!data) return null;

  const activeMembers = data.group_members?.filter((m: any) => m.status === 'ACTIVE') || [];
  const activeCount = activeMembers.length;
  const bookingsCount = data.bookings?.filter((b: any) => b.status === 'PAID' || b.status === 'DELIVERED').length || 0;
  const daysOld = Math.floor((Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const isVisible = activeCount >= 3 || (activeCount === 2 && daysOld >= 20);
  const daysUntilVisible = activeCount === 2 ? Math.max(0, 20 - daysOld) : (activeCount === 1 ? 20 : 0);

  return {
    ...data,
    member_count: activeCount,
    bookings_so_far: bookingsCount,
    is_visible_to_dealers: isVisible,
    days_until_visible: daysUntilVisible,
  };
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('*, profile:profiles(*)')
    .eq('group_id', groupId)
    .eq('status', 'ACTIVE')
    .order('joined_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch group members: ${error.message}`);
  }

  return (data || []) as GroupMember[];
}

export async function joinGroup(
  groupId: string,
  userId: string,
  _userFullName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  // 1. Fetch group to find target variant_id
  const { data: targetGroup, error: grpErr } = await supabase
    .from('groups')
    .select('id, variant_id, status')
    .eq('id', groupId)
    .maybeSingle();

  if (grpErr || !targetGroup) {
    return { success: false, error: 'Group not found.' };
  }

  // 2. Enforce Business Rule: One group per buyer per variant
  const { data: existingMemberships, error: memErr } = await supabase
    .from('group_members')
    .select('id, group_id, status, group:groups(variant_id)')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (!memErr && existingMemberships) {
    const duplicate = existingMemberships.find(
      (m: any) => m.group?.variant_id === targetGroup.variant_id && m.group_id !== groupId
    );
    if (duplicate) {
      return {
        success: false,
        error: 'You are already an active member of another group for this exact car variant. Platform rule: one group per buyer per variant.',
      };
    }
  }

  // 3. Upsert active membership
  const { error: insertErr } = await supabase.from('group_members').upsert(
    {
      group_id: groupId,
      user_id: userId,
      status: 'ACTIVE',
      is_creator: false,
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: 'group_id, user_id' }
  );

  if (insertErr) {
    return { success: false, error: insertErr.message };
  }

  // 4. Check if group should transition from FORMING to OPEN_FOR_QUOTES (3 or more members)
  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'ACTIVE');

  if (count && count >= 3 && targetGroup.status === 'FORMING') {
    await supabase.from('groups').update({ status: 'OPEN_FOR_QUOTES' }).eq('id', groupId);
  }

  return { success: true };
}

export async function leaveGroup(
  groupId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  // Find membership
  const { data: membership, error: fetchErr } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (fetchErr || !membership) {
    return { success: true }; // Already left or not in group
  }

  // Update status to LEFT
  const { error: updateErr } = await supabase
    .from('group_members')
    .update({ status: 'LEFT', left_at: new Date().toISOString() })
    .eq('id', membership.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // If creator leaves, promote the next active member
  if (membership.is_creator) {
    const { data: nextActive } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'ACTIVE')
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextActive) {
      await supabase
        .from('group_members')
        .update({ is_creator: true })
        .eq('id', nextActive.id);

      await supabase
        .from('groups')
        .update({ created_by: nextActive.user_id })
        .eq('id', groupId);
    }
  }

  return { success: true };
}

export async function createGroup(
  variantId: string,
  districtId: string,
  userId: string,
  _userFullName?: string
): Promise<{ success: boolean; groupId?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  // Enforce rule: One group per buyer per variant
  const { data: existingMemberships } = await supabase
    .from('group_members')
    .select('id, group:groups(variant_id)')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (existingMemberships) {
    const duplicate = existingMemberships.find(
      (m: any) => m.group?.variant_id === variantId
    );
    if (duplicate) {
      return {
        success: false,
        error: 'You already belong to an active group for this car variant. One group per buyer per variant is enforced.',
      };
    }
  }

  // Insert group
  const { data: newGroup, error: grpError } = await supabase
    .from('groups')
    .insert({
      variant_id: variantId,
      district_id: districtId,
      target_members: 10,
      status: 'FORMING',
      created_by: userId,
    })
    .select()
    .single();

  if (grpError || !newGroup) {
    return { success: false, error: grpError?.message || 'Failed to create group.' };
  }

  // Insert creator as active member
  const { error: memError } = await supabase.from('group_members').insert({
    group_id: newGroup.id,
    user_id: userId,
    is_creator: true,
    status: 'ACTIVE',
  });

  if (memError) {
    return { success: false, error: memError.message };
  }

  return { success: true, groupId: newGroup.id };
}

// Wishlist helpers
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('wishlist')
    .select('*, variant:variants(*, model:models(*, manufacturer:manufacturers(*)))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching wishlist:', error);
    return [];
  }

  return (data || []) as WishlistItem[];
}

export async function toggleWishlist(variantId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data: existing } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (existing) {
    await supabase.from('wishlist').delete().eq('id', existing.id);
    return false; // Removed
  } else {
    await supabase.from('wishlist').insert({
      user_id: userId,
      variant_id: variantId,
    });
    return true; // Added
  }
}

// Buyer Preferences helpers
export async function getBuyerPreferences(userId: string): Promise<BuyerPreferences | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('buyer_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as BuyerPreferences;
}

export async function saveBuyerPreferences(
  userId: string,
  prefs: Partial<BuyerPreferences>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const payload = {
    user_id: userId,
    district_id: prefs.district_id,
    preferred_brands: prefs.preferred_brands || [],
    preferred_fuel_types: prefs.preferred_fuel_types || [],
    budget_min: prefs.budget_min,
    budget_max: prefs.budget_max,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('buyer_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
