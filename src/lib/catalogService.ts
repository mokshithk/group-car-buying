import { supabase, isSupabaseConfigured } from './supabase';
import { District, Manufacturer, Model, Variant } from '@/types';

/**
 * Service to fetch official car catalog, district records, and runtime platform settings
 * directly from Supabase. No hardcoded arrays or mock fallbacks.
 */

export interface PlatformSettingsConfig {
  visibilityMemberThreshold: number;
  groupVisibilityDaysFor2Members: number;
  groupExpiryDaysFor1Member: number;
  defaultGroupTarget: number;
  quoteValidityDefaultDays: number;
  dealerDeliveryFallbackDays: number;
  bookingAmount: number;
  platformFee: number;
  buyerCancelRetentionPercent: number;
  feeRefundOnDealerFault: boolean;
  quoteOutlierThresholdPercent: number;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsConfig = {
  visibilityMemberThreshold: 3,
  groupVisibilityDaysFor2Members: 20,
  groupExpiryDaysFor1Member: 45,
  defaultGroupTarget: 10,
  quoteValidityDefaultDays: 14,
  dealerDeliveryFallbackDays: 14,
  bookingAmount: 5000,
  platformFee: 100,
  buyerCancelRetentionPercent: 5,
  feeRefundOnDealerFault: true,
  quoteOutlierThresholdPercent: 15,
};

let cachedSettings: { value: PlatformSettingsConfig; expiresAt: number } | null = null;

export function invalidatePlatformSettingsCache(): void {
  cachedSettings = null;
}

function toPositiveInt(raw: string | undefined, fallback: number, min = 1): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.round(num));
}

function toNonNegativeNum(raw: string | undefined, fallback: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

export async function fetchPlatformSettings(forceRefresh = false): Promise<PlatformSettingsConfig> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_PLATFORM_SETTINGS;
  }

  if (!forceRefresh && cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.value;
  }

  const { data, error } = await supabase.from('settings').select('key, value');
  if (error || !data) {
    return DEFAULT_PLATFORM_SETTINGS;
  }

  const map = new Map<string, string>();
  for (const row of data as { key: string; value: string }[]) {
    map.set(row.key, row.value);
  }

  const resolved: PlatformSettingsConfig = {
    visibilityMemberThreshold: toPositiveInt(
      map.get('visibility_member_threshold'),
      DEFAULT_PLATFORM_SETTINGS.visibilityMemberThreshold
    ),
    groupVisibilityDaysFor2Members: toPositiveInt(
      map.get('group_visibility_days_for_2_members'),
      DEFAULT_PLATFORM_SETTINGS.groupVisibilityDaysFor2Members
    ),
    groupExpiryDaysFor1Member: toPositiveInt(
      map.get('group_expiry_days_for_1_member'),
      DEFAULT_PLATFORM_SETTINGS.groupExpiryDaysFor1Member
    ),
    defaultGroupTarget: toPositiveInt(
      map.get('default_group_target'),
      DEFAULT_PLATFORM_SETTINGS.defaultGroupTarget
    ),
    quoteValidityDefaultDays: toPositiveInt(
      map.get('quote_validity_default_days'),
      DEFAULT_PLATFORM_SETTINGS.quoteValidityDefaultDays
    ),
    dealerDeliveryFallbackDays: toPositiveInt(
      map.get('dealer_delivery_fallback_days'),
      DEFAULT_PLATFORM_SETTINGS.dealerDeliveryFallbackDays
    ),
    bookingAmount: toNonNegativeNum(
      map.get('booking_amount'),
      DEFAULT_PLATFORM_SETTINGS.bookingAmount
    ),
    platformFee: toNonNegativeNum(
      map.get('platform_fee'),
      DEFAULT_PLATFORM_SETTINGS.platformFee
    ),
    buyerCancelRetentionPercent: Math.min(
      100,
      toNonNegativeNum(
        map.get('buyer_cancel_retention_percent'),
        DEFAULT_PLATFORM_SETTINGS.buyerCancelRetentionPercent
      )
    ),
    feeRefundOnDealerFault: (map.get('fee_refund_on_dealer_fault') ?? 'true') !== 'false',
    quoteOutlierThresholdPercent: toPositiveInt(
      map.get('quote_outlier_threshold_percent'),
      DEFAULT_PLATFORM_SETTINGS.quoteOutlierThresholdPercent
    ),
  };

  cachedSettings = {
    value: resolved,
    expiresAt: Date.now() + 60 * 1000,
  };
  return resolved;
}

export async function fetchDistricts(): Promise<District[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('districts')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load districts: ${error.message}`);
  }

  return ((data || []) as (District & { is_active?: boolean })[]).filter(
    (d) => d.is_active !== false
  ) as District[];
}

export async function fetchManufacturers(): Promise<Manufacturer[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('manufacturers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load manufacturers: ${error.message}`);
  }

  return ((data || []) as (Manufacturer & { is_active?: boolean })[]).filter(
    (m) => m.is_active !== false
  ) as Manufacturer[];
}

export async function fetchModels(): Promise<(Model & { variants: Variant[] })[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('models')
    .select('*, manufacturer:manufacturers(*), variants(*)')
    .order('starting_price', { ascending: true });

  if (error) {
    throw new Error(`Failed to load car models: ${error.message}`);
  }

  type ModelRow = Model & {
    is_active?: boolean;
    manufacturer?: { is_active?: boolean } | null;
    variants?: (Variant & { is_active?: boolean })[];
  };

  return ((data || []) as ModelRow[])
    .filter((m) => m.is_active !== false && m.manufacturer?.is_active !== false)
    .map((m) => ({
      ...m,
      variants: (m.variants || []).filter((v) => v.is_active !== false),
    })) as (Model & { variants: Variant[] })[];
}

export async function fetchModelById(modelId: string): Promise<(Model & { variants: Variant[] }) | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('models')
    .select('*, manufacturer:manufacturers(*), variants(*)')
    .eq('id', modelId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load car model: ${error.message}`);
  }

  if (!data) return null;
  const row = data as Model & {
    is_active?: boolean;
    manufacturer?: { is_active?: boolean } | null;
    variants?: (Variant & { is_active?: boolean })[];
  };
  if (row.is_active === false || row.manufacturer?.is_active === false) {
    return null;
  }
  return {
    ...row,
    variants: (row.variants || []).filter((v) => v.is_active !== false),
  } as Model & { variants: Variant[] };
}

export async function fetchVariantById(variantId: string): Promise<Variant | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('variants')
    .select('*, model:models(*, manufacturer:manufacturers(*))')
    .eq('id', variantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load car variant: ${error.message}`);
  }

  if (!data) return null;
  const variant = data as Variant & {
    is_active?: boolean;
    model?: Model & { is_active?: boolean; manufacturer?: { is_active?: boolean } | null };
  };
  if (
    variant.is_active === false ||
    variant.model?.is_active === false ||
    variant.model?.manufacturer?.is_active === false
  ) {
    return null;
  }

  return variant;
}
