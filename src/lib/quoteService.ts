import { Quotation, QuotationVersion } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

const LOCAL_QUOTES_KEY = 'autogroup_local_quotations';
const LOCAL_VERSIONS_KEY = 'autogroup_local_quotation_versions';

function getInitialLocalQuotes(): Quotation[] {
  const saved = localStorage.getItem(LOCAL_QUOTES_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  // Seed quotations mirroring seed.sql
  const initial: Quotation[] = [
    {
      id: 'q1111111-1111-1111-1111-111111111101',
      group_id: 'g1111111-1111-1111-1111-111111111101', // Nexon group
      dealership_id: 'dl111111-1111-1111-1111-111111111101',
      ex_showroom_price: 1220000,
      insurance: 44000,
      registration_charges: 183000,
      discounts: 35000,
      accessories_extras: 12000,
      on_road_price: 1424000,
      validity_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      terms: 'Includes 3-year extended warranty and zero depreciation cover. Delivery within 21 days.',
      is_complete: true,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      dealership: {
        id: 'dl111111-1111-1111-1111-111111111101',
        name: 'Apex Motors (Bengaluru)',
        status: 'VERIFIED',
        address: '45 Outer Ring Road, Marathahalli, Bengaluru',
        district_id: 'd1111111-1111-1111-1111-111111111101',
        contact_phone: '+91 98450 11223',
        contact_email: 'contact@apexmotors-fake.com',
        gst_number: '29AAAAA0000A1Z5',
        brands: ['Tata Motors', 'Hyundai'],
        districts: ['d1111111-1111-1111-1111-111111111101'],
        created_at: '',
        updated_at: '',
      },
    },
    {
      id: 'q1111111-1111-1111-1111-111111111102',
      group_id: 'g1111111-1111-1111-1111-111111111101', // Nexon group
      dealership_id: 'dl111111-1111-1111-1111-111111111102',
      ex_showroom_price: 1220000,
      insurance: 42000,
      registration_charges: 183000,
      discounts: 45000,
      accessories_extras: 8000,
      on_road_price: 1408000, // Lowest complete price
      validity_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      terms: 'Special corporate group rate. Free basic accessories kit and fast-track delivery.',
      is_complete: true,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      dealership: {
        id: 'dl111111-1111-1111-1111-111111111102',
        name: 'Southern Star Auto (Bengaluru)',
        status: 'VERIFIED',
        address: '88 Hosur Main Road, Koramangala, Bengaluru',
        district_id: 'd1111111-1111-1111-1111-111111111101',
        contact_phone: '+91 98450 44556',
        contact_email: 'sales@southernstar-fake.com',
        gst_number: '29BBBBB0000B1Z6',
        brands: ['Tata Motors', 'Mahindra'],
        districts: ['d1111111-1111-1111-1111-111111111101'],
        created_at: '',
        updated_at: '',
      },
    },
    {
      id: 'q1111111-1111-1111-1111-111111111103',
      group_id: 'g1111111-1111-1111-1111-111111111101', // Nexon group
      dealership_id: 'dl111111-1111-1111-1111-111111111103',
      ex_showroom_price: 1220000,
      insurance: 46000,
      registration_charges: 183000,
      discounts: 20000,
      accessories_extras: 15000,
      on_road_price: 1444000,
      validity_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // EXPIRED!
      terms: 'Previous festival promo pricing. Expired offer.',
      is_complete: true,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      dealership: {
        id: 'dl111111-1111-1111-1111-111111111103',
        name: 'Metro Velocity Cars (Bengaluru)',
        status: 'VERIFIED',
        address: '12 Bellary Road, Hebbal, Bengaluru',
        district_id: 'd1111111-1111-1111-1111-111111111101',
        contact_phone: '+91 98450 77889',
        contact_email: 'info@metrovelocity-fake.com',
        gst_number: '29CCCCC0000C1Z7',
        brands: ['Hyundai', 'Kia'],
        districts: ['d1111111-1111-1111-1111-111111111101'],
        created_at: '',
        updated_at: '',
      },
    },
    {
      id: 'q1111111-1111-1111-1111-111111111104',
      group_id: 'g1111111-1111-1111-1111-111111111101',
      dealership_id: 'dl111111-1111-1111-1111-111111111104',
      ex_showroom_price: 1220000,
      insurance: 0, // Incomplete!
      registration_charges: 0, // Incomplete!
      discounts: 50000,
      accessories_extras: 0,
      on_road_price: 1170000, // Artificially low because insurance & RTO are omitted!
      validity_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      terms: 'Partial estimate only. Mandatory insurance and road tax excluded.',
      is_complete: false, // Flagged INCOMPLETE - must be EXCLUDED from best price!
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dealership: {
        id: 'dl111111-1111-1111-1111-111111111104',
        name: 'Pioneer Auto Hub (Bengaluru)',
        status: 'VERIFIED',
        address: '201 Bannerghatta Road, Bengaluru',
        district_id: 'd1111111-1111-1111-1111-111111111101',
        contact_phone: '+91 98450 99001',
        contact_email: 'sales@pioneer-fake.com',
        gst_number: '29DDDDD0000D1Z8',
        brands: ['Tata Motors'],
        districts: ['d1111111-1111-1111-1111-111111111101'],
        created_at: '',
        updated_at: '',
      },
    },
  ];

  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(initial));
  return initial;
}

export async function fetchQuotationsForGroup(groupId: string): Promise<Quotation[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, dealership:dealerships(*)')
        .eq('group_id', groupId);

      if (!error && data && data.length > 0) {
        return data as Quotation[];
      }
    } catch {
      // fallback
    }
  }

  const quotes = getInitialLocalQuotes();
  return quotes.filter((q) => q.group_id === groupId);
}

export function isQuoteExpired(validityDate: string): boolean {
  return new Date(validityDate).getTime() < Date.now();
}

/**
 * Business Rule (Section 2):
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

export function fetchPriceHistory(quotationId: string): QuotationVersion[] {
  const saved = localStorage.getItem(`${LOCAL_VERSIONS_KEY}_${quotationId}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  // Sample version history
  return [
    {
      id: 'qv-1',
      quotation_id: quotationId,
      dealership_id: 'dl111111-1111-1111-1111-111111111101',
      on_road_price: 1435000,
      price_breakdown: {
        ex_showroom_price: 1220000,
        insurance: 44000,
        registration_charges: 183000,
        discounts: 25000,
        accessories_extras: 13000,
      },
      changed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      version_number: 1,
    },
    {
      id: 'qv-2',
      quotation_id: quotationId,
      dealership_id: 'dl111111-1111-1111-1111-111111111101',
      on_road_price: 1424000,
      price_breakdown: {
        ex_showroom_price: 1220000,
        insurance: 44000,
        registration_charges: 183000,
        discounts: 35000, // extra ₹10,000 group discount added
        accessories_extras: 12000,
      },
      changed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      version_number: 2,
    },
  ];
}
