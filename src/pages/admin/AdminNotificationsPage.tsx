import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { District } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Input, Select } from '@/components/ui';
import { Bell, Send, CheckCheck, ExternalLink, Loader2 } from 'lucide-react';

interface AdminNotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link_url: string | null;
  created_at: string;
}

export function AdminNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [alerts, setAlerts] = useState<AdminNotificationRow[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  // Announcement composer
  const [target, setTarget] = useState<'ALL_BUYERS' | 'ALL_DEALERS' | 'DISTRICT_BUYERS' | 'DISTRICT_ALL'>('ALL_BUYERS');
  const [districtId, setDistrictId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingAlerts(true);
    try {
      const [nRes, dRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('districts').select('*').eq('is_active', true).order('name', { ascending: true }),
      ]);

      setAlerts((nRes.data || []) as AdminNotificationRow[]);
      const dList = (dRes.data || []) as District[];
      setDistricts(dList);
      if (dList.length > 0 && !districtId) setDistrictId(dList[0].id);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [user?.id, districtId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    toast({ type: 'success', title: 'Inbox Cleared', message: 'All admin notifications marked as read.' });
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || message.trim().length < 5) {
      toast({
        type: 'error',
        title: 'Incomplete Announcement',
        message: 'Provide both a title (3+ chars) and message (5+ chars).',
      });
      return;
    }

    const needsDistrict = target === 'DISTRICT_BUYERS' || target === 'DISTRICT_ALL';
    if (needsDistrict && !districtId) {
      toast({ type: 'error', title: 'Select District', message: 'Choose a district for district-targeted notices.' });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.rpc('admin_send_announcement', {
        p_target: target,
        p_district_id: needsDistrict ? districtId : null,
        p_title: title.trim(),
        p_message: message.trim(),
        p_link_url: linkUrl.trim() || null,
      });

      if (error) throw error;
      const count = (data as { recipient_count?: number } | null)?.recipient_count ?? 0;

      toast({
        type: 'success',
        title: 'Announcement Broadcast',
        message: `Delivered to ${count} active recipient(s).`,
      });
      setTitle('');
      setMessage('');
      setLinkUrl('');
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Broadcast Failed',
        message: err instanceof Error ? err.message : 'Unable to send announcement.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <AdminLayout
      title="Notifications & Announcements"
      breadcrumbs={[{ label: 'Notifications' }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Broadcast Composer */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleSendAnnouncement}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div>
              <h2 className="text-sm font-bold text-slate-900">Broadcast Platform Announcement</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Deliver in-app alerts to all buyers, all dealerships, or a specific district.
              </p>
            </div>

            <Select
              label="Target Audience *"
              value={target}
              onChange={(e) =>
                setTarget(
                  e.target.value as 'ALL_BUYERS' | 'ALL_DEALERS' | 'DISTRICT_BUYERS' | 'DISTRICT_ALL'
                )
              }
              options={[
                { value: 'ALL_BUYERS', label: 'All Active Buyers' },
                { value: 'ALL_DEALERS', label: 'All Active Dealers' },
                { value: 'DISTRICT_BUYERS', label: 'Buyers in Selected District' },
                { value: 'DISTRICT_ALL', label: 'Buyers & Dealers in Selected District' },
              ]}
            />

            {(target === 'DISTRICT_BUYERS' || target === 'DISTRICT_ALL') && (
              <Select
                label="Target District *"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                options={districts.map((d) => ({ value: d.id, label: `${d.name} (${d.state})` }))}
              />
            )}

            <Input
              label="Announcement Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 GST Tariff & Group Deadline Notice"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Message *
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a clear notification message..."
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
              />
            </div>

            <Input
              label="Optional Link URL"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="e.g. /buyer/groups"
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isSending}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> Send Announcement
            </Button>
          </form>
        </div>

        {/* Right: Admin Alert Inbox */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-600" />
              Admin Alert Inbox
              {unreadCount > 0 && <Badge variant="danger" size="sm">{unreadCount} unread</Badge>}
            </h2>
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleMarkAllRead}>
                <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>

          {isLoadingAlerts ? (
            <div className="py-12 flex justify-center bg-white border border-slate-200 rounded-xl">
              <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              No administrative alerts yet. System notices (suspicious group joins, deletion requests, dealer signups)
              appear here automatically.
            </div>
          ) : (
            <div className="space-y-2.5">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                    a.read ? 'bg-white border-slate-200' : 'bg-brand-50/40 border-brand-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{a.title}</span>
                      {!a.read && <Badge variant="brand" size="sm">Unread</Badge>}
                      <Badge variant="default" size="sm">{a.type}</Badge>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{a.message}</p>
                  <div className="flex items-center gap-3 pt-1">
                    {a.link_url && (
                      <Link
                        to={a.link_url}
                        className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                      >
                        Open Related Record <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    {!a.read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(a.id)}
                        className="text-slate-500 hover:text-slate-800 underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
