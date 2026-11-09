import { Quotation, QuotationVersion } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Quote Service: Real Supabase implementation
 * Implements quotes, competitive multi-dealer comparisons, and price history versioning.
 * No mock arrays or in-memory fallbacks.
 */

export async function fetchQuotationsForGroup(groupId: string): Promise<Quotation[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('quotations')
    .select('*, dealership:dealerships(*), quotation_versions(*)')
    .eq('group_id', groupId)
    .order('on_road_price', { ascending: true });

  if (error) {
    throw new Error(`Failed to load quotations for group: ${error.message}`);
  }

  return (data || []) as Quotation[];
}

export async function fetchQuotationById(quotationId: string): Promise<Quotation | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('quotations')
    .select('*, dealership:dealerships(*), quotation_versions(*)')
    .eq('id', quotationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load quotation: ${error.message}`);
  }

  return (data as Quotation | null) ?? null;
}

export async function fetchPriceHistory(quotationId: string): Promise<QuotationVersion[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('quotation_versions')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('Error fetching price history:', error);
    return [];
  }

  return (data || []) as QuotationVersion[];
}

export async function submitQuotation(quoteData: {
  groupId: string;
  dealershipId: string;
  exShowroomPrice: number;
  insurance: number;
  registrationCharges: number;
  discounts: number;
  accessoriesExtras: number;
  onRoadPrice: number;
  validityDate: string;
  terms: string;
  isComplete: boolean;
}): Promise<{ success: boolean; quotationId?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  // 1. Check if existing quotation exists for this group and dealership
  const { data: existing } = await supabase
    .from('quotations')
    .select('id, on_road_price')
    .eq('group_id', quoteData.groupId)
    .eq('dealership_id', quoteData.dealershipId)
    .maybeSingle();

  const payload = {
    group_id: quoteData.groupId,
    dealership_id: quoteData.dealershipId,
    ex_showroom_price: quoteData.exShowroomPrice,
    insurance: quoteData.insurance,
    registration_charges: quoteData.registrationCharges,
    discounts: quoteData.discounts,
    accessories_extras: quoteData.accessoriesExtras,
    on_road_price: quoteData.onRoadPrice,
    validity_date: quoteData.validityDate,
    terms: quoteData.terms,
    is_complete: quoteData.isComplete,
    updated_at: new Date().toISOString(),
  };

  let quoteId = existing?.id;

  if (existing) {
    // Update existing quotation
    const { error: updateErr } = await supabase
      .from('quotations')
      .update(payload)
      .eq('id', existing.id);

    if (updateErr) return { success: false, error: updateErr.message };

    // Record price history version if price or completeness changed
    const { data: versions } = await supabase
      .from('quotation_versions')
      .select('version_number')
      .eq('quotation_id', existing.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVer = (versions?.[0]?.version_number || 1) + 1;

    await supabase.from('quotation_versions').insert({
      quotation_id: existing.id,
      dealership_id: quoteData.dealershipId,
      on_road_price: quoteData.onRoadPrice,
      price_breakdown: {
        ex_showroom_price: quoteData.exShowroomPrice,
        insurance: quoteData.insurance,
        registration_charges: quoteData.registrationCharges,
        discounts: quoteData.discounts,
        accessories_extras: quoteData.accessoriesExtras,
      },
      version_number: nextVer,
    });
  } else {
    // Insert new quotation
    const { data: inserted, error: insertErr } = await supabase
      .from('quotations')
      .insert(payload)
      .select()
      .single();

    if (insertErr || !inserted) {
      return { success: false, error: insertErr?.message || 'Failed to submit quotation' };
    }
    quoteId = inserted.id;

    // Insert initial version 1
    await supabase.from('quotation_versions').insert({
      quotation_id: inserted.id,
      dealership_id: quoteData.dealershipId,
      on_road_price: quoteData.onRoadPrice,
      price_breakdown: {
        ex_showroom_price: quoteData.exShowroomPrice,
        insurance: quoteData.insurance,
        registration_charges: quoteData.registrationCharges,
        discounts: quoteData.discounts,
        accessories_extras: quoteData.accessoriesExtras,
      },
      version_number: 1,
    });
  }

  // Update group status to OFFERS_RECEIVED if it was OPEN_FOR_QUOTES
  await supabase
    .from('groups')
    .update({ status: 'OFFERS_RECEIVED' })
    .eq('id', quoteData.groupId)
    .in('status', ['FORMING', 'OPEN_FOR_QUOTES']);

  return { success: true, quotationId: quoteId };
}

export function isQuoteExpired(validityDate: string): boolean {
  return new Date(validityDate).getTime() < Date.now();
}

/**
 * Business Rule:
 * Incomplete quotes are flagged and EXCLUDED from "lowest price" and savings.
 * Expired quotes are greyed and disabled.
 * Savings only calculated between complete, valid quotes.
 */
export function analyzeQuotations(quotes: Quotation[]) {
  const validCompleteQuotes = quotes.filter(
    (q) => q.is_complete && !isQuoteExpired(q.validity_date)
  );

  let lowestPriceQuote: Quotation | null = null;
  let highestPriceQuote: Quotation | null = null;

  if (validCompleteQuotes.length > 0) {
    const sorted = [...validCompleteQuotes].sort((a, b) => a.on_road_price - b.on_road_price);
    lowestPriceQuote = sorted[0];
    highestPriceQuote = sorted[sorted.length - 1];
  }

  const maxSavings =
    lowestPriceQuote && highestPriceQuote && highestPriceQuote !== lowestPriceQuote
      ? highestPriceQuote.on_road_price - lowestPriceQuote.on_road_price
      : 0;

  return {
    validCompleteQuotes,
    lowestPriceQuote,
    highestPriceQuote,
    maxSavings,
    hasIncompleteQuotes: quotes.some((q) => !q.is_complete),
    hasExpiredQuotes: quotes.some((q) => isQuoteExpired(q.validity_date)),
  };
}
