import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/lib/adminHelpers';
import { ForbiddenPage } from '@/pages/admin/ForbiddenPage';
import { UserRole } from '@/types';
import { Skeleton, Button } from '@/components/ui';
import { AlertTriangle, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireVerifiedDealer?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireVerifiedDealer = false,
}: ProtectedRouteProps) {
  const { user, profile, dealership, mustChangePassword, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-3/4 mx-auto rounded-lg" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // 1. If not logged in, redirect to login with original path as redirect-back
  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // 2. If logged in but profile is missing or role is unknown, show clear error & sign-out button
  if (!profile || !profile.role || !['buyer', 'dealer', 'admin', 'super_admin'].includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas p-6">
        <div className="w-full max-w-md p-6 bg-white rounded-2xl border border-slate-200 shadow-elevated text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Account Profile Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your login session is authenticated, but no valid profile or recognized role was found for your account in the database.
          </p>
          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={logout}
              className="w-full"
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out &amp; Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Role Guards: Buyers & dealers get 403 Forbidden on any /admin route; others redirect cleanly
  const isTargetingAdminRoute =
    location.pathname.startsWith('/admin') ||
    (allowedRoles && allowedRoles.every((r) => isAdminRole(r)));

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    if (isTargetingAdminRoute) {
      return <ForbiddenPage />;
    }
    if (isAdminRole(profile.role)) {
      return <Navigate to={mustChangePassword ? '/admin/set-password' : '/admin/dashboard'} replace />;
    } else if (profile.role === 'dealer') {
      const dStatus = dealership?.status;
      if (dStatus === 'REJECTED' || dStatus === 'SUSPENDED') {
        return <Navigate to="/dealer/status" replace />;
      } else if (dStatus === 'PENDING') {
        return <Navigate to="/dealer/pending" replace />;
      }
      return <Navigate to="/dealer/dashboard" replace />;
    } else if (profile.role === 'buyer') {
      return <Navigate to="/buyer/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // 4. First-login forced password change for newly provisioned admins
  if (isAdminRole(profile.role) && mustChangePassword && location.pathname !== '/admin/set-password') {
    return <Navigate to="/admin/set-password" replace />;
  }

  // 5. Dealer status checks
  if (profile.role === 'dealer') {
    const dStatus = dealership?.status;
    if (dStatus === 'REJECTED' || dStatus === 'SUSPENDED') {
      if (location.pathname !== '/dealer/status') {
        return <Navigate to="/dealer/status" replace />;
      }
    } else if (dStatus === 'PENDING' && requireVerifiedDealer) {
      if (location.pathname !== '/dealer/pending' && location.pathname !== '/dealer/pending-approval') {
        return <Navigate to="/dealer/pending" replace />;
      }
    }
  }

  return <>{children}</>;
}
