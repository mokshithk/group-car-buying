import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { Skeleton } from '@/components/ui';

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
  const { user, profile, dealership, isLoading } = useAuth();
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

  // If not logged in, redirect to login with original path as redirect-back
  if (!user || !profile) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If role is not allowed, redirect to appropriate home
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    if (profile.role === 'dealer') {
      return <Navigate to="/dealer/dashboard" replace />;
    } else if (profile.role === 'buyer') {
      return <Navigate to="/buyer/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // If verified dealer is required, check dealership verification status
  if (profile.role === 'dealer' && requireVerifiedDealer) {
    if (dealership && dealership.status === 'PENDING') {
      return <Navigate to="/dealer/pending-approval" replace />;
    }
  }

  return <>{children}</>;
}
