import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchDistricts } from '@/lib/catalogService';
import { Navbar } from './Navbar';
import {
  LayoutDashboard,
  Compass,
  Users,
  Bookmark,
  ShoppingBag,
  Sliders,
  Bell,
  Shield,
} from 'lucide-react';

interface BuyerLayoutProps {
  children: React.ReactNode;
}

export function BuyerLayout({ children }: BuyerLayoutProps) {
  const { profile } = useAuth();
  const location = useLocation();
  const [districtLabel, setDistrictLabel] = useState<string>('General');

  useEffect(() => {
    let cancelled = false;
    if (!profile?.district_id) {
      setDistrictLabel('Not Set');
      return;
    }
    fetchDistricts()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((d) => d.id === profile.district_id);
        setDistrictLabel(found ? found.name : 'Registered');
      })
      .catch(() => {
        if (!cancelled) setDistrictLabel('Registered');
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.district_id]);

  const isPathActive = (path: string) => {
    if (path === '/buyer/groups/find') {
      return location.pathname === '/buyer/groups/find' || location.pathname === '/buyer/groups/create';
    }
    if (path === '/buyer/groups') {
      return (
        location.pathname === '/buyer/groups' ||
        (location.pathname.startsWith('/buyer/groups/') &&
          location.pathname !== '/buyer/groups/find' &&
          location.pathname !== '/buyer/groups/create')
      );
    }
    if (path === '/buyer/bookings') {
      return (
        location.pathname === '/buyer/bookings' ||
        location.pathname.startsWith('/buyer/booking-confirmation/') ||
        location.pathname.startsWith('/buyer/quote/')
      );
    }
    return location.pathname === path;
  };

  const navItems = [
    { label: 'Dashboard', path: '/buyer/dashboard', icon: LayoutDashboard },
    { label: 'Find Groups', path: '/buyer/groups/find', icon: Compass },
    { label: 'My Groups', path: '/buyer/groups', icon: Users },
    { label: 'My Bookings', path: '/buyer/bookings', icon: ShoppingBag },
    { label: 'Wishlist', path: '/buyer/wishlist', icon: Bookmark },
    { label: 'Preferences', path: '/buyer/preferences', icon: Sliders },
    { label: 'Notifications', path: '/buyer/notifications', icon: Bell },
    { label: 'Profile & Privacy', path: '/buyer/profile', icon: Shield },
  ];

  // Mobile bottom tab bar items (Top 4 most critical)
  const mobileTabItems = [
    { label: 'Dashboard', path: '/buyer/dashboard', icon: LayoutDashboard },
    { label: 'Find Groups', path: '/buyer/groups/find', icon: Compass },
    { label: 'My Groups', path: '/buyer/groups', icon: Users },
    { label: 'Bookings', path: '/buyer/bookings', icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas pb-20 md:pb-0">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:block w-64 shrink-0 space-y-6">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 font-bold flex items-center justify-center text-sm">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'B'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {profile?.full_name || 'Buyer'}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  District: {districtLabel}
                </div>
              </div>
            </div>

            <nav className="mt-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isPathActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Mobile Secondary Quick Nav Strip (Preferences, Notifications, Profile, Wishlist) */}
          <div className="md:hidden -mx-1 px-1 flex items-center gap-2 overflow-x-auto pb-1">
            {navItems
              .filter((i) => !mobileTabItems.some((m) => m.path === i.path))
              .map((item) => {
                const Icon = item.icon;
                const isActive = isPathActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                      isActive
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </div>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 shadow-elevated flex items-center justify-around"
      >
        {mobileTabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = isPathActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
