import { useState } from 'react';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Notification } from '@/types';
import { Bell, CheckCheck, Trash2, Tag, Users, ShieldAlert } from 'lucide-react';

export function NotificationsPage() {
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'd0111111-1111-1111-1111-111111111101',
      user_id: '11111111-1111-1111-1111-111111111101',
      title: 'Quotation Price Revised',
      message: 'Southern Star Auto reduced on-road price for Tata Nexon Creative Plus DCA to ₹14,08,000.',
      type: 'PRICE_CHANGE',
      read: false,
      link_url: '/buyer/groups/f1111111-1111-1111-1111-111111111101/offers',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'd0111111-1111-1111-1111-111111111102',
      user_id: '11111111-1111-1111-1111-111111111101',
      title: 'New Member Joined Your Group',
      message: 'Ananya V. joined Hyundai Creta SX(O) Turbo DCT in Bengaluru Urban.',
      type: 'GENERAL',
      read: false,
      link_url: '/buyer/groups/f1111111-1111-1111-1111-111111111102',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'd0111111-1111-1111-1111-111111111103',
      user_id: '11111111-1111-1111-1111-111111111101',
      title: 'Dealer Visibility Threshold Achieved',
      message: 'Your group reached 3 members! Authorized district showrooms are now submitting quotations.',
      type: 'NEW_ELIGIBLE_GROUP',
      read: true,
      link_url: '/buyer/groups/f1111111-1111-1111-1111-111111111101',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast({ type: 'info', title: 'All marked as read' });
  };

  const handleClearAll = () => {
    setNotifications([]);
    toast({ type: 'info', title: 'Notifications cleared' });
  };

  return (
    <BuyerLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Notifications Center
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time alerts for dealer quotation revisions, group milestones, and bookings.
            </p>
          </div>

          {notifications.length > 0 && (
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
                onClick={handleClearAll}
                className="text-slate-400 hover:text-rose-600"
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">You're all caught up!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              You will receive notifications here whenever a dealer updates a price or a group condition changes.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const icon =
                notif.type === 'PRICE_CHANGE' ? (
                  <Tag className="w-4 h-4 text-emerald-600" />
                ) : notif.type === 'NEW_ELIGIBLE_GROUP' ? (
                  <Users className="w-4 h-4 text-brand-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                );

              return (
                <Card
                  key={notif.id}
                  className={`p-4 transition-colors ${
                    !notif.read ? 'border-brand-300 bg-brand-50/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900">{notif.title}</h4>
                        {!notif.read && <Badge variant="brand" size="sm">New</Badge>}
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                      {notif.link_url && (
                        <a
                          href={notif.link_url}
                          className="inline-block mt-2 font-semibold text-brand-600 hover:underline"
                        >
                          View Details →
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
    </BuyerLayout>
  );
}
