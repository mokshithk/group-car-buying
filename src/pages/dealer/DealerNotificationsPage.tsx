import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/formatters';
import { Notification } from '@/types';
import {
  Bell,
  CheckCheck,
  Trash2,
  Tag,
  ShoppingBag,
  Users,
  PhoneCall,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

export function DealerNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts((data || []) as Notification[]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load dealership notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleMarkOneRead = async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      toast({ type: 'error', title: 'Update Failed', message: error.message });
      return;
    }
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    toast({ type: 'info', title: 'Alerts marked as read' });
  };

  const handleClear = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      toast({ type: 'error', title: 'Clear Failed', message: error.message });
      return;
    }
    setAlerts([]);
    toast({ type: 'info', title: 'Alerts cleared' });
  };

  const hasUnread = alerts.some((a) => !a.read);

  return (
    <DealerLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Dealership Notification Feed
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time tender updates, competitor bids, buyer leads, and booking events.
            </p>
          </div>

          {alerts.length > 0 && (
            <div className="flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMarkAllRead}
                  leftIcon={<CheckCheck className="w-4 h-4" />}
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-slate-400 hover:text-rose-600"
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No alerts right now</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              You will be notified whenever a new tender unlocks, a competitor quotes, or a buyer books.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => {
              const icon =
                a.type === 'NEW_BOOKING' ? (
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                ) : a.type === 'PRICE_CHANGE' ? (
                  <Tag className="w-4 h-4 text-blue-600" />
                ) : a.type === 'NEW_LEAD' ? (
                  <PhoneCall className="w-4 h-4 text-amber-600" />
                ) : a.type === 'NEW_GROUP' || a.type === 'NEW_ELIGIBLE_GROUP' ? (
                  <Users className="w-4 h-4 text-brand-600" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                );

              return (
                <Card
                  key={a.id}
                  className={`p-4 transition-colors ${
                    !a.read ? 'border-brand-300 bg-brand-50/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900">{a.title}</h4>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(a.created_at)}
                          </span>
                          {!a.read && <Badge variant="brand" size="sm">New</Badge>}
                        </div>
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{a.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {a.link_url &&
                          (a.link_url.startsWith('http') ? (
                            <a
                              href={a.link_url}
                              onClick={() => handleMarkOneRead(a.id)}
                              className="font-semibold text-brand-600 hover:underline"
                            >
                              View in Portal →
                            </a>
                          ) : (
                            <Link
                              to={a.link_url}
                              onClick={() => handleMarkOneRead(a.id)}
                              className="font-semibold text-brand-600 hover:underline"
                            >
                              View in Portal →
                            </Link>
                          ))}
                        {!a.read && (
                          <button
                            type="button"
                            onClick={() => handleMarkOneRead(a.id)}
                            className="text-slate-400 hover:text-slate-700 font-medium"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
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
