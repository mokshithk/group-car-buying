import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_IDLE_TIMEOUT_MS, ADMIN_IDLE_WARNING_MS } from '@/lib/adminHelpers';
import { Button, Modal, Input } from '@/components/ui';
import {
  LayoutDashboard,
  Building2,
  Users,
  CarFront,
  MapPin,
  Layers,
  FileSpreadsheet,
  ShoppingBag,
  Flag,
  Star,
  UserCog,
  Settings,
  Bell,
  ScrollText,
  Download,
  UserCheck,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Search,
  Clock,
  ChevronRight,
} from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface AdminLayoutProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  headerActions?: React.ReactNode;
  idleTimeoutMs?: number;
  idleWarningMs?: number;
  children: React.ReactNode;
}

interface NavGroup {
  group: string;
  items: {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    superAdminOnly?: boolean;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Dealers', path: '/admin/dealers', icon: Building2 },
      { label: 'Buyers', path: '/admin/buyers', icon: Users },
      { label: 'Groups', path: '/admin/groups', icon: Layers },
      { label: 'Quotations', path: '/admin/quotations', icon: FileSpreadsheet },
      { label: 'Bookings & Refunds', path: '/admin/bookings', icon: ShoppingBag },
    ],
  },
  {
    group: 'Catalogue & Regions',
    items: [
      { label: 'Car Catalogue', path: '/admin/catalogue', icon: CarFront },
      { label: 'Districts', path: '/admin/districts', icon: MapPin },
    ],
  },
  {
    group: 'Trust & Moderation',
    items: [
      { label: 'Reports & Disputes', path: '/admin/reports', icon: Flag },
      { label: 'Ratings', path: '/admin/ratings', icon: Star },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Admins & Invites', path: '/admin/admins', icon: UserCog, superAdminOnly: true },
      { label: 'Settings', path: '/admin/settings', icon: Settings },
      { label: 'Notifications', path: '/admin/notifications', icon: Bell },
      { label: 'Audit Logs', path: '/admin/audit', icon: ScrollText },
      { label: 'Exports', path: '/admin/exports', icon: Download },
      { label: 'My Account', path: '/admin/account', icon: UserCheck },
    ],
  },
];

export function AdminLayout({
  title,
  breadcrumbs = [],
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Quick search...',
  headerActions,
  idleTimeoutMs = ADMIN_IDLE_TIMEOUT_MS,
  idleWarningMs = ADMIN_IDLE_WARNING_MS,
  children,
}: AdminLayoutProps) {
  const { user, profile, isSuperAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(idleWarningMs / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSignOut = useCallback(async () => {
    setShowIdleWarning(false);
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearAllTimers();
    setShowIdleWarning(false);

    const warnAfter = Math.max(1000, idleTimeoutMs - idleWarningMs);
    warningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true);
      const totalWarnSecs = Math.max(1, Math.round(idleWarningMs / 1000));
      setSecondsLeft(totalWarnSecs);
      countdownIntervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }, warnAfter);

    logoutTimerRef.current = setTimeout(() => {
      handleSignOut();
    }, idleTimeoutMs);
  }, [clearAllTimers, handleSignOut, idleTimeoutMs, idleWarningMs]);

  useEffect(() => {
    resetIdleTimer();

    const onActivity = () => {
      // Do not silently dismiss once the explicit warning modal is visible
      if (Date.now() - lastActivityRef.current < 1000) return;
      if (Date.now() - lastActivityRef.current >= idleTimeoutMs - idleWarningMs) return;
      resetIdleTimer();
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      clearAllTimers();
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [resetIdleTimer, clearAllTimers, idleTimeoutMs, idleWarningMs]);

  // Close mobile drawer on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const signedInEmail = user?.email || profile?.email || 'admin';

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-200 flex items-center justify-between">
        <Link to="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-brand-400" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">AutoGroup</div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
              Admin Console
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav aria-label="Admin Navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((section) => {
          const visibleItems = section.items.filter((i) => !i.superAdminOnly || isSuperAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.group} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.group}
              </div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path + '/'));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      isActive
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 bg-slate-50/70">
        <div className="px-2 py-1.5 text-[11px] text-slate-600 space-y-0.5">
          <div className="font-semibold text-slate-900 truncate">{profile?.full_name || 'Administrator'}</div>
          <div className="font-mono text-[10px] uppercase text-slate-500">
            Role: {isSuperAdmin ? 'super_admin' : 'admin'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-canvas flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile / Tablet Drawer Sidebar */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] bg-white border-r border-slate-200 h-full z-10 shadow-elevated">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 -ml-1 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="min-w-0">
                {breadcrumbs.length > 0 && (
                  <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5 flex-wrap">
                    <Link to="/admin/dashboard" className="hover:text-slate-900">
                      Admin
                    </Link>
                    {breadcrumbs.map((b, idx) => (
                      <React.Fragment key={`${b.label}-${idx}`}>
                        <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                        {b.to ? (
                          <Link to={b.to} className="hover:text-slate-900">
                            {b.label}
                          </Link>
                        ) : (
                          <span className="text-slate-700 font-medium">{b.label}</span>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                )}
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
                  {title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full xl:w-auto max-w-full">
              {onSearchChange && (
                <div className="w-full sm:w-56 min-w-0">
                  <Input
                    type="text"
                    value={searchValue || ''}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="py-1.5 text-xs rounded-lg"
                    leftIcon={<Search className="w-3.5 h-3.5" />}
                  />
                </div>
              )}

              {headerActions && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {headerActions}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 sm:pl-2 sm:border-l sm:border-slate-200 text-xs max-w-full">
                <span className="text-slate-700 font-medium break-words sm:whitespace-nowrap" data-testid="admin-signed-in-label">
                  Signed in as <strong className="text-slate-900">{signedInEmail}</strong> (Admin)
                </span>
                <span className="hidden sm:inline-block font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
                  {isSuperAdmin ? 'super_admin' : 'admin'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* 30-Minute Idle Timeout Warning Modal */}
      <Modal
        isOpen={showIdleWarning}
        onClose={resetIdleTimer}
        title="Session Expiring Due to Inactivity"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-slate-600">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Your admin session has been idle and will automatically sign out in{' '}
              <strong className="font-mono text-sm tabular-nums">{secondsLeft}s</strong>.
            </span>
          </div>
          <p>Select "Stay Signed In" to continue working.</p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out Now
            </Button>
            <Button variant="primary" size="sm" onClick={resetIdleTimer}>
              Stay Signed In
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
