import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';
import { Car, Menu, X, User, LogOut, LayoutDashboard, Bookmark, Compass } from 'lucide-react';

export function Navbar() {
  const { user, profile, dealership, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      return '/admin/dashboard';
    }
    if (profile?.role === 'dealer') {
      if (dealership?.status === 'REJECTED' || dealership?.status === 'SUSPENDED') {
        return '/dealer/status';
      }
      if (dealership?.status !== 'VERIFIED') {
        return '/dealer/pending';
      }
      return '/dealer/dashboard';
    }
    return '/buyer/dashboard';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname === '/') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(`/#${sectionId}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
            <Car className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Auto<span className="text-brand-600">Group</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a
            href="#cars"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('cars');
            }}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            Browse Cars
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('how-it-works');
            }}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            How It Works
          </a>
          {profile?.role === 'buyer' && (
            <>
              <Link
                to="/buyer/groups/find"
                className={`hover:text-brand-600 transition-colors flex items-center gap-1.5 ${
                  location.pathname === '/buyer/groups/find' ? 'text-brand-600 font-semibold' : ''
                }`}
              >
                <Compass className="w-4 h-4" /> Find Groups
              </Link>
              <Link
                to="/buyer/wishlist"
                className={`hover:text-brand-600 transition-colors flex items-center gap-1.5 ${
                  location.pathname === '/buyer/wishlist' ? 'text-brand-600 font-semibold' : ''
                }`}
              >
                <Bookmark className="w-4 h-4" /> Wishlist
              </Link>
            </>
          )}
        </nav>

        {/* Desktop Auth Controls */}
        <div className="hidden md:flex items-center gap-3">
          {user && profile ? (
            <div className="flex items-center gap-3">
              <Link to={getDashboardPath()}>
                <Button variant="secondary" size="sm" leftIcon={<LayoutDashboard className="w-4 h-4" />}>
                  {profile.role === 'admin' || profile.role === 'super_admin'
                    ? 'Admin Portal'
                    : profile.role === 'dealer'
                    ? 'Dealer Portal'
                    : 'My Dashboard'}
                </Button>
              </Link>
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900 truncate max-w-[120px]">
                    {profile.full_name}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    {profile.role}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          {user && profile && (
            <Link to={getDashboardPath()} aria-label="Open portal dashboard">
              <button className="p-2 text-brand-600 rounded-lg hover:bg-brand-50">
                <User className="w-5 h-5" />
              </button>
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
          <a
            href="#cars"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('cars');
            }}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-brand-600 cursor-pointer"
          >
            Browse Cars
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('how-it-works');
            }}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-brand-600 cursor-pointer"
          >
            How It Works
          </a>
          {profile?.role === 'buyer' && (
            <>
              <Link
                to="/buyer/groups/find"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-slate-700 hover:text-brand-600"
              >
                Find Groups
              </Link>
              <Link
                to="/buyer/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-slate-700 hover:text-brand-600"
              >
                Saved Wishlist
              </Link>
            </>
          )}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user && profile ? (
              <>
                <Link
                  to={getDashboardPath()}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button variant="primary" size="md" className="w-full">
                    Go to{' '}
                    {profile.role === 'admin' || profile.role === 'super_admin'
                      ? 'Admin Portal'
                      : profile.role === 'dealer'
                      ? 'Dealer Portal'
                      : 'My Dashboard'}
                  </Button>
                </Link>
                <Button variant="ghost" size="md" onClick={handleLogout} className="w-full text-rose-600">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="secondary" size="md" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="md" className="w-full">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
