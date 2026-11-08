import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { HomePage } from '@/pages/public/HomePage';
import { CarDetailPage } from '@/pages/public/CarDetailPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { BuyerRegisterPage } from '@/pages/auth/BuyerRegisterPage';
import { DealerRegisterPage } from '@/pages/auth/DealerRegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { PendingApprovalPage } from '@/pages/dealer/PendingApprovalPage';
import { FindGroupsPage } from '@/pages/buyer/FindGroupsPage';
import { WishlistPage } from '@/pages/buyer/WishlistPage';
import { BuyerPreferencesPage } from '@/pages/buyer/BuyerPreferencesPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-surface-canvas">
            <main className="flex-1">
              <Routes>
                {/* Public Pages */}
                <Route path="/" element={<HomePage />} />
                <Route path="/cars/:id" element={<CarDetailPage />} />

                {/* Auth Pages */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register/buyer" element={<BuyerRegisterPage />} />
                <Route path="/register/dealer" element={<DealerRegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/dealer/pending-approval" element={<PendingApprovalPage />} />

                {/* Buyer Protected Pages */}
                <Route
                  path="/buyer/groups/find"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <FindGroupsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/wishlist"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <WishlistPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/preferences"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <BuyerPreferencesPage />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
