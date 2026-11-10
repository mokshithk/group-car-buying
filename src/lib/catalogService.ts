import { supabase, isSupabaseConfigured } from './supabase';
import { District, Model, Variant } from '@/types';

/**
 * Service to fetch official car catalog & district records directly from Supabase.
 * No hardcoded arrays or in-memory fallback.
 */

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

  return (data as Variant | null) ?? null;
}
