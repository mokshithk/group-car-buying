import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card, Tabs } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchDealerQuotations, isQuoteExpired } from '@/lib/quoteService';
import { formatINR, formatDate, formatDateTime } from '@/lib/formatters';
import { Quotation } from '@/types';
import {
  Tag,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  FileText,
} from 'lucide-react';

type QuoteFilterTab = 'ALL' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE';

const OPEN_GROUP_STATUSES = new Set(['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED']);

export function DealerQuotationsPage() {
  const { dealership } = useAuth();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [activeTab, setActiveTab] = useState<QuoteFilterTab>('ALL');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!dealership?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const list = await fetchDealerQuotations(dealership.id);
        if (!cancelled) {
          setQuotations(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load your quotations.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dealership?.id]);

  const counts = useMemo(() => {
    let active = 0;
    let expired = 0;
    let inactive = 0;

    for (const q of quotations) {
      if (q.is_active === false) {
        inactive += 1;
      } else if (isQuoteExpired(q.validity_date)) {
        expired += 1;
      } else {
        active += 1;
      }
    }

    return {
      all: quotations.length,
      active,
      expired,
      inactive,
    };
  }, [quotations]);

  const filteredQuotes = useMemo(() => {
    return quotations.filter((q) => {
      if (activeTab === 'INACTIVE') return q.is_active === false;
      if (activeTab === 'EXPIRED') return q.is_active !== false && isQuoteExpired(q.validity_date);
      if (activeTab === 'ACTIVE') return q.is_active !== false && !isQuoteExpired(q.validity_date);
      return true;
    });
  }, [quotations, activeTab]);

  return (
    <DealerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-brand-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                My Submitted Quotations
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Track every tender quotation submitted by {dealership?.name || 'your showroom'}, revision history, and live validity.
            </p>
          </div>

          <Link to="/dealer/groups">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Browse Eligible Groups
            </Button>
          </Link>
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase text-slate-500">Total Quotes</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{counts.all}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase text-slate-500">Active</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{counts.active}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase text-slate-500">Expired</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{counts.expired}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase text-slate-500">Deactivated</div>
            <div className="text-2xl font-black text-rose-700 mt-1">{counts.inactive}</div>
          </Card>
        </div>

        <Tabs
          tabs={[
            { id: 'ALL', label: `All (${counts.all})` },
            { id: 'ACTIVE', label: `Active (${counts.active})` },
            { id: 'EXPIRED', label: `Expired (${counts.expired})` },
            { id: 'INACTIVE', label: `Deactivated (${counts.inactive})` },
          ]}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as QuoteFilterTab)}
        />

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading your quotations...</div>
        ) : filteredQuotes.length === 0 ? (
          <Card className="text-center py-16 p-8 space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {quotations.length === 0
                ? 'No quotations submitted yet'
                : 'No quotations match this filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Review eligible local buying groups matching your authorized OEM brands and submit itemized on-road pricing.
            </p>
            {quotations.length === 0 && (
              <Link to="/dealer/groups">
                <Button variant="primary" size="sm">View Eligible Groups</Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredQuotes.map((q) => {
              const expired = isQuoteExpired(q.validity_date);
              const deactivated = q.is_active === false;
              const groupOpen = q.group ? OPEN_GROUP_STATUSES.has(q.group.status) : true;
              const revisionCount = q.quotation_versions?.length || 1;

              return (
                <Card key={q.id} className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {q.group?.variant?.model?.manufacturer?.name && (
                          <Badge variant="brand" size="sm">
                            {q.group.variant.model.manufacturer.name}
                          </Badge>
                        )}
                        <h3 className="text-base font-bold text-slate-900">
                          {q.group?.variant?.model?.name || 'Vehicle Model'} — {q.group?.variant?.name || 'Variant'}
                        </h3>
                        {deactivated ? (
                          <Badge variant="danger" size="sm">Deactivated by Admin</Badge>
                        ) : expired ? (
                          <Badge variant="warning" size="sm">
                            <Clock className="w-3 h-3 mr-1" /> Expired
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        )}
                        {!q.is_complete && (
                          <Badge variant="warning" size="sm">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Incomplete
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span>
                          District: <strong>{q.group?.district?.name || '—'}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Net On-Road: <strong className="text-slate-900">{formatINR(q.on_road_price)}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">
                          Discount: -{formatINR(q.discounts)}
                        </span>
                        <span>•</span>
                        <span>Valid until {formatDate(q.validity_date)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span>Ex-Showroom: {formatINR(q.ex_showroom_price)}</span>
                        <span>·</span>
                        <span>Insurance: {formatINR(q.insurance)}</span>
                        <span>·</span>
                        <span>RTO: {formatINR(q.registration_charges)}</span>
                        <span>·</span>
                        <span>Accessories: {formatINR(q.accessories_extras)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <History className="w-3 h-3" /> {revisionCount} version{revisionCount === 1 ? '' : 's'}
                        </span>
                        <span>·</span>
                        <span>Updated {formatDateTime(q.updated_at)}</span>
                      </div>

                      {deactivated && q.deactivated_reason && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                          Deactivation reason: {q.deactivated_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/dealer/groups/${q.group_id}`}>
                        <Button variant="secondary" size="sm">
                          Competition
                        </Button>
                      </Link>
                      {!deactivated && groupOpen && (
                        <Link to={`/dealer/groups/${q.group_id}/quote`}>
                          <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                            Revise Quote
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DealerLayout>
  );
}
