import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Navbar } from './Navbar';
import { Badge } from '@/components/ui';
import {
  LayoutDashboard,
  Users,
  Tag,
  PhoneCall,
  ShoppingBag,
  Building2,
  UserCheck,
  Star,
  Bell,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface DealerLayoutProps {
  children: React.ReactNode;
}

export function DealerLayout({ children }: DealerLayoutProps) {
  const { dealership } = useAuth();
  const location = useLocation();

  const isVerified = dealership?.status === 'VERIFIED';

  const navItems = [
    { label: 'Dashboard', path: '/dealer/dashboard', icon: LayoutDashboard },
    { label: 'Eligible Groups', path: '/dealer/groups', icon: Users },
    { label: 'My Quotations', path: '/dealer/quotes', icon: Tag },
    { label: 'Interested Leads', path: '/dealer/leads', icon: PhoneCall },
    { label: 'Bookings Received', path: '/dealer/bookings', icon: ShoppingBag },
    { label: 'Showroom Profile', path: '/dealer/profile', icon: Building2 },
    { label: 'Staff Management', path: '/dealer/staff', icon: UserCheck },
    { label: 'Customer Ratings', path: '/dealer/ratings', icon: Star },
    { label: 'Notifications', path: '/dealer/notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas pb-20 md:pb-0">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-8">
        {/* Dealership Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 space-y-6">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
            {/* Showroom card */}
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Dealership Portal
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 truncate">
                {dealership?.name || 'Showroom Name'}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {isVerified ? (
                  <Badge variant="success" size="sm">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 mr-1" /> Verified Partner
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    <ShieldAlert className="w-3 h-3 text-amber-600 mr-1" /> Pending Approval
                  </Badge>
                )}
              </div>
            </div>

            <nav className="mt-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile dealer tab bar */}
      <nav
        aria-label="Mobile Dealer Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 shadow-elevated flex items-center justify-around"
      >
        <Link
          to="/dealer/dashboard"
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
            location.pathname === '/dealer/dashboard' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/dealer/groups"
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
            location.pathname === '/dealer/groups' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Groups</span>
        </Link>
        <Link
          to="/dealer/leads"
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
            location.pathname === '/dealer/leads' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <PhoneCall className="w-5 h-5" />
          <span>Leads</span>
        </Link>
        <Link
          to="/dealer/bookings"
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
            location.pathname === '/dealer/bookings' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Bookings</span>
        </Link>
      </nav>
    </div>
  );
}
