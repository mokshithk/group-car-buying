import { Group, GroupMember, Profile, WishlistItem, BuyerPreferences } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { fetchPlatformSettings, PlatformSettingsConfig } from './catalogService';

const OPEN_GROUP_STATUSES = new Set(['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED']);

interface PublicMetricRow {
  group_id: string;
  active_members: number;
  bookings_so_far: number;
  is_visible_to_dealers: boolean;
}

async function fetchPublicMetricsMap(groupIds: string[]): Promise<Map<string, PublicMetricRow>> {
  const map = new Map<string, PublicMetricRow>();
  if (groupIds.length === 0) return map;

  try {
    const { data, error } = await supabase.rpc('get_group_public_metrics', {
      p_group_ids: groupIds,
    });
    if (!error && Array.isArray(data)) {
      for (const row of data as PublicMetricRow[]) {
        map.set(row.group_id, row);
      }
    }
  } catch {
    // Graceful fallback before migration 008
  }
  return map;
}

function hydrateGroupRow(
  item: any,
  settings: PlatformSettingsConfig,
  metricsMap: Map<string, PublicMetricRow>
): Group {
  const metric = metricsMap.get(item.id);
  const activeMembers = (item.group_members || []).filter((m: any) => m.status === 'ACTIVE');
  const activeCount = metric ? Number(metric.active_members ?? 0) : activeMembers.length;
  const bookingsCount = metric
    ? Number(metric.bookings_so_far ?? 0)
    : (item.bookings || []).filter((b: any) => b.status === 'PAID' || b.status === 'DELIVERED').length;

  const daysOld = Math.max(0, Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)));
  const minMembers = settings.visibilityMemberThreshold;
  const visDays = settings.groupVisibilityDaysFor2Members;
  const isOpen = OPEN_GROUP_STATUSES.has(item.status);

  const computedVisible =
    isOpen && (activeCount >= minMembers || (activeCount === 2 && daysOld >= visDays));
  const isVisible = metric ? Boolean(metric.is_visible_to_dealers) && isOpen : computedVisible;

  let daysUntilVisible = 0;
  if (isOpen && !isVisible) {
    daysUntilVisible = activeCount === 2 ? Math.max(0, visDays - daysOld) : visDays;
  }

  return {
    ...item,
    member_count: activeCount,
    bookings_so_far: bookingsCount,
    is_visible_to_dealers: isVisible,
    days_until_visible: daysUntilVisible,
  };
}

export async function fetchGroupsForDistrict(
  districtId: string,
  options?: { includeClosed?: boolean }
): Promise<Group[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const [settings, { data, error }] = await Promise.all([
    fetchPlatformSettings(),
    supabase
      .from('groups')
      .select(
        '*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status, user_id), bookings(id, status)'
      )
      .eq('district_id', districtId)
      .order('created_at', { ascending: false }),
  ]);

  if (error) {
    throw new Error(`Failed to fetch groups for district: ${error.message}`);
  }

  const rows = (data || []).filter((row: any) =>
    options?.includeClosed ? true : OPEN_GROUP_STATUSES.has(row.status)
  );
  const metricsMap = await fetchPublicMetricsMap(rows.map((r: any) => r.id));

  return rows.map((row: any) => hydrateGroupRow(row, settings, metricsMap));
}

export async function fetchBuyerJoinedGroups(userId: string): Promise<Group[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const [settings, { data, error }] = await Promise.all([
    fetchPlatformSettings(),
    supabase
      .from('group_members')
      .select(
        'status, group:groups(*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status, user_id), bookings(id, status))'
      )
      .eq('user_id', userId)
      .in('status', ['ACTIVE', 'BOOKED'])
      .order('joined_at', { ascending: false }),
  ]);

  if (error) {
    throw new Error(`Failed to fetch joined groups: ${error.message}`);
  }

  const groupRows = (data || [])
    .map((m: any) => (m.group ? { ...m.group, membership_status: m.status } : null))
    .filter((g: any) => Boolean(g));

  const uniqueMap = new Map<string, any>();
  for (const g of groupRows) {
    if (!uniqueMap.has(g.id)) {
      uniqueMap.set(g.id, g);
    } else if (g.membership_status === 'BOOKED') {
      uniqueMap.set(g.id, g);
    }
  }
  const uniqueGroups = Array.from(uniqueMap.values());
  const metricsMap = await fetchPublicMetricsMap(uniqueGroups.map((g: any) => g.id));

  return uniqueGroups.map((g: any) => ({
    ...hydrateGroupRow(g, settings, metricsMap),
    membership_status: g.membership_status,
  }));
}

export async function fetchDealerEligibleGroups(
  districtIds: string[],
  brands: string[] = []
): Promise<Group[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const cleanDistricts = Array.from(new Set(districtIds.filter(Boolean)));
  if (cleanDistricts.length === 0) return [];

  const [settings, { data, error }] = await Promise.all([
    fetchPlatformSettings(),
    supabase
      .from('groups')
      .select(
        '*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status, user_id), bookings(id, status)'
      )
      .in('district_id', cleanDistricts)
      .in('status', ['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED'])
      .order('created_at', { ascending: false }),
  ]);

  if (error) {
    throw new Error(`Failed to fetch eligible dealer groups: ${error.message}`);
  }

  const normalizedBrands = brands.map((b) => b.trim().toLowerCase()).filter(Boolean);
  const filteredRows = (data || []).filter((g: any) => {
    if (normalizedBrands.length === 0) return true;
    const mfr = g.variant?.model?.manufacturer;
    const mfrId = (mfr?.id || g.variant?.model?.manufacturer_id || '').toLowerCase();
    const mfrName = (mfr?.name || '').toLowerCase();
    return normalizedBrands.includes(mfrName) || normalizedBrands.includes(mfrId);
  });

  const metricsMap = await fetchPublicMetricsMap(filteredRows.map((g: any) => g.id));
  return filteredRows
    .map((row: any) => hydrateGroupRow(row, settings, metricsMap))
    .filter((g) => Boolean(g.is_visible_to_dealers));
}

export async function fetchGroupById(groupId: string): Promise<Group | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const [settings, { data, error }] = await Promise.all([
    fetchPlatformSettings(),
    supabase
      .from('groups')
      .select(
        '*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status, user_id), bookings(id, status)'
      )
      .eq('id', groupId)
      .maybeSingle(),
  ]);

  if (error) {
    throw new Error(`Failed to fetch group: ${error.message}`);
  }

  if (!data) return null;
  const metricsMap = await fetchPublicMetricsMap([groupId]);
  return hydrateGroupRow(data, settings, metricsMap);
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  // Prefer privacy-safe SECURITY DEFINER RPC so fellow members show "FirstName L."
  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_group_member_summaries', {
      p_group_id: groupId,
    });
    if (!rpcErr && Array.isArray(rpcRows)) {
      return rpcRows.map((row: any) => ({
        id: row.id,
        group_id: row.group_id,
        user_id: row.user_id,
        is_creator: Boolean(row.is_creator),
        status: row.status,
        joined_at: row.joined_at,
        profile: { full_name: row.display_name } as Profile,
      }));
    }
  } catch {
    // Fallback before migration 008
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

  const { data: rpcData, error: rpcErr } = await supabase.rpc('join_buying_group', {
    p_group_id: groupId,
  });

  if (!rpcErr && rpcData) {
    const payload = rpcData as { success?: boolean; error?: string };
    return {
      success: Boolean(payload.success),
      error: payload.error,
    };
  }

  if (rpcErr && !rpcErr.message.includes('join_buying_group')) {
    return { success: false, error: rpcErr.message };
  }

  // Fallback path when RPC is not yet deployed
  const [settings, { data: targetGroup, error: grpErr }] = await Promise.all([
    fetchPlatformSettings(),
    supabase.from('groups').select('id, variant_id, status').eq('id', groupId).maybeSingle(),
  ]);

  if (grpErr || !targetGroup) {
    return { success: false, error: grpErr?.message || 'Group not found.' };
  }
  if (!OPEN_GROUP_STATUSES.has(targetGroup.status)) {
    return {
      success: false,
      error: `This buying group is already ${targetGroup.status.toLowerCase()} and cannot accept new members.`,
    };
  }

  const { data: existingMemberships } = await supabase
    .from('group_members')
    .select('id, group_id, status, group:groups(variant_id, status)')
    .eq('user_id', userId)
    .in('status', ['ACTIVE', 'BOOKED']);

  const bookedSameGroup = (existingMemberships || []).find(
    (m: any) => m.group_id === groupId && m.status === 'BOOKED'
  );
  if (bookedSameGroup) {
    return { success: false, error: 'You already locked a booking from this buying group.' };
  }

  const duplicate = (existingMemberships || []).find(
    (m: any) =>
      m.status === 'ACTIVE' &&
      m.group?.variant_id === targetGroup.variant_id &&
      m.group_id !== groupId &&
      OPEN_GROUP_STATUSES.has(m.group?.status)
  );
  if (duplicate) {
    return {
      success: false,
      error: 'You are already an active member of another group for this exact car variant.',
    };
  }

  const { error: insertErr } = await supabase.from('group_members').upsert(
    {
      group_id: groupId,
      user_id: userId,
      status: 'ACTIVE',
      is_creator: false,
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: 'group_id,user_id' }
  );

  if (insertErr) {
    return { success: false, error: insertErr.message };
  }

  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'ACTIVE');

  if (count && count >= settings.visibilityMemberThreshold && targetGroup.status === 'FORMING') {
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

  const { data: rpcData, error: rpcErr } = await supabase.rpc('leave_buying_group', {
    p_group_id: groupId,
  });

  if (!rpcErr && rpcData) {
    const payload = rpcData as { success?: boolean; error?: string };
    return {
      success: Boolean(payload.success),
      error: payload.error,
    };
  }

  if (rpcErr && !rpcErr.message.includes('leave_buying_group')) {
    return { success: false, error: rpcErr.message };
  }

  const { data: membership, error: fetchErr } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (fetchErr) {
    return { success: false, error: fetchErr.message };
  }
  if (!membership) {
    return { success: true };
  }

  const { error: updateErr } = await supabase
    .from('group_members')
    .update({ status: 'LEFT', is_creator: false, left_at: new Date().toISOString() })
    .eq('id', membership.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
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

  const { data: rpcData, error: rpcErr } = await supabase.rpc('create_buying_group', {
    p_variant_id: variantId,
    p_district_id: districtId || null,
  });

  if (!rpcErr && rpcData) {
    const payload = rpcData as { success?: boolean; group_id?: string; error?: string };
    return {
      success: Boolean(payload.success),
      groupId: payload.group_id,
      error: payload.error,
    };
  }

  if (rpcErr && !rpcErr.message.includes('create_buying_group')) {
    return { success: false, error: rpcErr.message };
  }

  const settings = await fetchPlatformSettings();

  const { data: existingMemberships } = await supabase
    .from('group_members')
    .select('id, group:groups(variant_id, status)')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  const duplicate = (existingMemberships || []).find(
    (m: any) => m.group?.variant_id === variantId && OPEN_GROUP_STATUSES.has(m.group?.status)
  );
  if (duplicate) {
    return {
      success: false,
      error: 'You already belong to an active group for this car variant. One group per buyer per variant is enforced.',
    };
  }

  const { data: newGroup, error: grpError } = await supabase
    .from('groups')
    .insert({
      variant_id: variantId,
      district_id: districtId,
      target_members: settings.defaultGroupTarget,
      status: 'FORMING',
      created_by: userId,
    })
    .select()
    .single();

  if (grpError || !newGroup) {
    return { success: false, error: grpError?.message || 'Failed to create group.' };
  }

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

export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('wishlist')
    .select('*, variant:variants(*, model:models(*, manufacturer:manufacturers(*)))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load wishlist: ${error.message}`);
  }

  return ((data || []) as any[]).filter(
    (row) =>
      row.variant &&
      row.variant.is_active !== false &&
      row.variant.model?.is_active !== false &&
      row.variant.model?.manufacturer?.is_active !== false
  ) as WishlistItem[];
}

export async function addToWishlist(
  variantId: string,
  userId: string
): Promise<{ success: boolean; alreadySaved?: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  const { data: existing, error: checkErr } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (checkErr) {
    return { success: false, error: checkErr.message };
  }
  if (existing) {
    return { success: true, alreadySaved: true };
  }

  const { error } = await supabase.from('wishlist').insert({
    user_id: userId,
    variant_id: variantId,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, alreadySaved: false };
}

export async function removeFromWishlist(
  variantId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('user_id', userId)
    .eq('variant_id', variantId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function toggleWishlist(variantId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data: existing, error: fetchErr } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  if (existing) {
    const { error } = await supabase.from('wishlist').delete().eq('id', existing.id);
    if (error) throw new Error(error.message);
    return false;
  }

  const { error } = await supabase.from('wishlist').insert({
    user_id: userId,
    variant_id: variantId,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function getBuyerPreferences(userId: string): Promise<BuyerPreferences | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('buyer_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load preferences: ${error.message}`);
  }
  return (data as BuyerPreferences | null) ?? null;
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
    district_id: prefs.district_id || null,
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
