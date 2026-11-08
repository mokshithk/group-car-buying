import { useState } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Bell, CheckCheck, Trash2, Tag, ShoppingBag, Users, PhoneCall, RotateCcw } from 'lucide-react';

interface DealerAlert {
  id: string;
  title: string;
  message: string;
  type: 'NEW_GROUP' | 'PRICE_CHANGE' | 'NEW_LEAD' | 'NEW_BOOKING' | 'BUYER_CANCEL';
  read: boolean;
  timestamp: string;
  link?: string;
}

export function DealerNotificationsPage() {
  const { toast } = useToast();

  const [alerts, setAlerts] = useState<DealerAlert[]>([
    {
      id: 'da-1',
      title: 'New Confirmed Booking Received',
      message: 'Buyer Rahul S. completed booking deposit for Tata Nexon Creative Plus DCA. Price locked at ₹14,24,000.',
      type: 'NEW_BOOKING',
      read: false,
      timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      link: '/dealer/bookings',
    },
    {
      id: 'da-2',
      title: 'Competitor Price Decrease Alert',
      message: 'Southern Star Auto reduced on-road quotation to ₹14,08,000. Your rank is currently #2 of 4.',
      type: 'PRICE_CHANGE',
      read: false,
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      link: '/dealer/groups',
    },
    {
      id: 'da-3',
      title: 'New Interested Buyer Lead',
      message: 'Customer clicked "I\'m interested" on your quotation. Buyer phone number unlocked.',
      type: 'NEW_LEAD',
      read: true,
      timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      link: '/dealer/leads',
    },
    {
      id: 'da-4',
      title: 'New Eligible Buying Group',
      message: 'Creta SX(O) Turbo DCT reached 2 members and 20 days elapsed. Tender is now visible for bidding.',
      type: 'NEW_GROUP',
      read: true,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      link: '/dealer/groups',
    },
  ]);

  const handleMarkAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    toast({ type: 'info', title: 'Alerts marked as read' });
  };

  const handleClear = () => {
    setAlerts([]);
    toast({ type: 'info', title: 'Alerts cleared' });
  };

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
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMarkAllRead}
                leftIcon={<CheckCheck className="w-4 h-4" />}
              >
                Mark all read
              </Button>
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

        {alerts.length === 0 ? (
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
                ) : a.type === 'NEW_GROUP' ? (
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
                        {!a.read && <Badge variant="brand" size="sm">New</Badge>}
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{a.message}</p>
                      {a.link && (
                        <a
                          href={a.link}
                          className="inline-block mt-2 font-semibold text-brand-600 hover:underline"
                        >
                          View in Portal →
                        </a>
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
