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

  return (data || []) as District[];
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

  return (data || []) as (Model & { variants: Variant[] })[];
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

  return (data as (Model & { variants: Variant[] }) | null) ?? null;
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
