import { Quotation, QuotationVersion } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Quote Service: Real Supabase implementation.
 * Server triggers automatically log quotation_versions and advance group status
 * to OFFERS_RECEIVED on quotation insert/update.
 */

function sortVersionsDesc(versions?: QuotationVersion[]): QuotationVersion[] | undefined {
  if (!versions) return versions;
  return [...versions].sort((a, b) => Number(b.version_number) - Number(a.version_number));
}

export async function fetchQuotationsForGroup(
  groupId: string,
  options?: { includeInactive?: boolean }
): Promise<Quotation[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  let query = supabase
    .from('quotations')
    .select('*, dealership:dealerships(*), quotation_versions(*), quote_items(*)')
    .eq('group_id', groupId)
    .order('on_road_price', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load quotations for group: ${error.message}`);
  }

  return ((data || []) as Quotation[]).map((q) => ({
    ...q,
    quotation_versions: sortVersionsDesc(q.quotation_versions),
  }));
}

export async function fetchDealerQuotations(dealershipId: string): Promise<Quotation[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('quotations')
    .select(
      '*, dealership:dealerships(*), quotation_versions(*), quote_items(*), group:groups(*, district:districts(*), variant:variants(*, model:models(*, manufacturer:manufacturers(*))))'
    )
    .eq('dealership_id', dealershipId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load dealership quotations: ${error.message}`);
  }

  return ((data || []) as Quotation[]).map((q) => ({
    ...q,
    quotation_versions: sortVersionsDesc(q.quotation_versions),
  }));
}

export async function fetchQuotationById(quotationId: string): Promise<Quotation | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('quotations')
    .select(
      '*, dealership:dealerships(*), quotation_versions(*), quote_items(*), group:groups(*, district:districts(*), variant:variants(*, model:models(*, manufacturer:manufacturers(*))))'
    )
    .eq('id', quotationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load quotation: ${error.message}`);
  }

  if (!data) return null;
  const quote = data as Quotation;
  return {
    ...quote,
    quotation_versions: sortVersionsDesc(quote.quotation_versions),
  };
}

export async function fetchPriceHistory(quotationId: string): Promise<QuotationVersion[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('quotation_versions')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch price history: ${error.message}`);
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
  quoteItems?: Array<{ item_name: string; amount: number; is_optional: boolean }>;
}): Promise<{ success: boolean; quotationId?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  if (quoteData.exShowroomPrice <= 0) {
    return { success: false, error: 'Ex-showroom price must be greater than ₹0.' };
  }
  if (
    quoteData.insurance < 0 ||
    quoteData.registrationCharges < 0 ||
    quoteData.discounts < 0 ||
    quoteData.accessoriesExtras < 0
  ) {
    return { success: false, error: 'Pricing breakdown amounts cannot be negative.' };
  }
  if (quoteData.onRoadPrice < 0) {
    return {
      success: false,
      error: 'Net on-road price cannot be negative. Reduce discounts or verify breakdown figures.',
    };
  }

  const { data: existing, error: existErr } = await supabase
    .from('quotations')
    .select('id, is_active')
    .eq('group_id', quoteData.groupId)
    .eq('dealership_id', quoteData.dealershipId)
    .maybeSingle();

  if (existErr) {
    return { success: false, error: existErr.message };
  }

  if (existing && existing.is_active === false) {
    return {
      success: false,
      error: 'This quotation was deactivated by administration and cannot be edited.',
    };
  }

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
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  let quoteId = existing?.id;

  if (existing) {
    const { error: updateErr } = await supabase
      .from('quotations')
      .update(payload)
      .eq('id', existing.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('quotations')
      .insert(payload)
      .select('id')
      .single();

    if (insertErr || !inserted) {
      return { success: false, error: insertErr?.message || 'Failed to submit quotation.' };
    }
    quoteId = inserted.id;
  }

  if (quoteId && quoteData.quoteItems) {
    const cleanItems = quoteData.quoteItems
      .map((item) => ({
        quotation_id: quoteId,
        item_name: item.item_name.trim(),
        amount: Number(item.amount) || 0,
        is_optional: Boolean(item.is_optional),
      }))
      .filter((item) => item.item_name.length > 0);

    const { error: delItemsErr } = await supabase
      .from('quote_items')
      .delete()
      .eq('quotation_id', quoteId);

    if (!delItemsErr && cleanItems.length > 0) {
      await supabase.from('quote_items').insert(cleanItems);
    }
  }

  return { success: true, quotationId: quoteId };
}

export function isQuoteExpired(validityDate: string): boolean {
  if (!validityDate) return true;
  const ts = new Date(validityDate).getTime();
  return Number.isNaN(ts) || ts < Date.now();
}

export function isQuoteComplete(quote: {
  insurance?: number | null;
  registrationCharges?: number | null;
  registration_charges?: number | null;
  exShowroomPrice?: number | null;
  ex_showroom_price?: number | null;
}): boolean {
  const insurance = Number(quote.insurance ?? 0);
  const registration = Number(quote.registrationCharges ?? quote.registration_charges ?? 0);
  return insurance > 0 && registration > 0;
}

export function rankQuotes<
  T extends {
    id: string;
    on_road_price: number;
    insurance?: number | null;
    registration_charges?: number | null;
    is_complete?: boolean;
    is_active?: boolean;
    validity_date: string;
  },
>(quotes: T[]) {
  const validCompleteQuotes = quotes.filter(
    (q) =>
      (q.is_active ?? true) &&
      (q.is_complete ?? isQuoteComplete(q)) &&
      !isQuoteExpired(q.validity_date)
  );

  const rankedCompleteQuotes = [...validCompleteQuotes].sort(
    (a, b) => Number(a.on_road_price) - Number(b.on_road_price)
  );

  const lowestCompleteQuote = rankedCompleteQuotes[0] ?? null;
  const isLowestPrice = (quoteId: string) =>
    Boolean(lowestCompleteQuote && lowestCompleteQuote.id === quoteId);

  return {
    rankedCompleteQuotes,
    lowestCompleteQuote,
    isLowestPrice,
  };
}

export function analyzeQuotations<
  T extends {
    id: string;
    on_road_price: number;
    insurance?: number | null;
    registration_charges?: number | null;
    is_complete?: boolean;
    is_active?: boolean;
    validity_date: string;
  },
>(quotes: T[]) {
  const { rankedCompleteQuotes, lowestCompleteQuote } = rankQuotes(quotes);
  const hasIncompleteQuotes = quotes.some((q) => !(q.is_complete ?? isQuoteComplete(q)));

  const lowestPrice = lowestCompleteQuote ? Number(lowestCompleteQuote.on_road_price) : 0;
  const highestPrice =
    rankedCompleteQuotes.length > 0
      ? Number(rankedCompleteQuotes[rankedCompleteQuotes.length - 1].on_road_price)
      : 0;
  const maxSavings = rankedCompleteQuotes.length > 1 ? Math.max(0, highestPrice - lowestPrice) : 0;

  return {
    lowestPriceQuote: lowestCompleteQuote,
    hasIncompleteQuotes,
    maxSavings,
    rankedCompleteQuotes,
  };
}
