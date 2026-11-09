import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { HomePage } from '@/pages/public/HomePage';
import { CarDetailPage } from '@/pages/public/CarDetailPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterRoleChooserPage } from '@/pages/auth/RegisterRoleChooserPage';
import { BuyerRegisterPage } from '@/pages/auth/BuyerRegisterPage';
import { DealerRegisterPage } from '@/pages/auth/DealerRegisterPage';
import { VerifyOtpPage } from '@/pages/auth/VerifyOtpPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { PendingApprovalPage } from '@/pages/dealer/PendingApprovalPage';
import { BuyerDashboardPage } from '@/pages/buyer/BuyerDashboardPage';
import { FindGroupsPage } from '@/pages/buyer/FindGroupsPage';
import { MyGroupsPage } from '@/pages/buyer/MyGroupsPage';
import { CreateGroupPage } from '@/pages/buyer/CreateGroupPage';
import { GroupDetailPage } from '@/pages/buyer/GroupDetailPage';
import { OffersComparisonPage } from '@/pages/buyer/OffersComparisonPage';
import { InterestedPage } from '@/pages/buyer/InterestedPage';
import { BookingPaymentPage } from '@/pages/buyer/BookingPaymentPage';
import { BookingConfirmationPage } from '@/pages/buyer/BookingConfirmationPage';
import { MyBookingsPage } from '@/pages/buyer/MyBookingsPage';
import { NotificationsPage } from '@/pages/buyer/NotificationsPage';
import { ProfilePrivacyPage } from '@/pages/buyer/ProfilePrivacyPage';
import { WishlistPage } from '@/pages/buyer/WishlistPage';
import { BuyerPreferencesPage } from '@/pages/buyer/BuyerPreferencesPage';
import { DealerDashboardPage } from '@/pages/dealer/DealerDashboardPage';
import { DealerGroupsPage } from '@/pages/dealer/DealerGroupsPage';
import { DealerGroupDetailPage } from '@/pages/dealer/DealerGroupDetailPage';
import { SubmitQuotePage } from '@/pages/dealer/SubmitQuotePage';
import { DealerLeadsPage } from '@/pages/dealer/DealerLeadsPage';
import { DealerBookingsPage } from '@/pages/dealer/DealerBookingsPage';
import { DealerRatingsReportsPage } from '@/pages/dealer/DealerRatingsReportsPage';
import { DealerNotificationsPage } from '@/pages/dealer/DealerNotificationsPage';
import { ShowroomProfilePage } from '@/pages/dealer/ShowroomProfilePage';
import { StaffManagementPage } from '@/pages/dealer/StaffManagementPage';

import { isSupabaseConfigured } from '@/lib/supabase';
import { SupabaseErrorScreen } from '@/components/common/SupabaseErrorScreen';

export default function App() {
  if (!isSupabaseConfigured()) {
    return <SupabaseErrorScreen />;
  }

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
                <Route path="/register" element={<RegisterRoleChooserPage />} />
                <Route path="/register/buyer" element={<BuyerRegisterPage />} />
                <Route path="/register/dealer" element={<DealerRegisterPage />} />
                <Route path="/register/verify-otp" element={<VerifyOtpPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/dealer/pending-approval" element={<PendingApprovalPage />} />
                <Route path="/dealer/pending" element={<PendingApprovalPage />} />

                {/* Buyer Protected Pages */}
                <Route
                  path="/buyer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <BuyerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/groups/find"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <FindGroupsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/groups/create"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <CreateGroupPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/groups"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <MyGroupsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/groups/:id"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <GroupDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/groups/:id/offers"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <OffersComparisonPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/quote/:quoteId/interested"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <InterestedPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/quote/:quoteId/book"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <BookingPaymentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/booking-confirmation/:bookingId"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <BookingConfirmationPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/bookings"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <MyBookingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer/profile"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <ProfilePrivacyPage />
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

                {/* Dealer Protected Pages */}
                <Route
                  path="/dealer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']} requireVerifiedDealer>
                      <DealerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/groups"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']} requireVerifiedDealer>
                      <DealerGroupsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/groups/:id"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']} requireVerifiedDealer>
                      <DealerGroupDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/groups/:id/quote"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']} requireVerifiedDealer>
                      <SubmitQuotePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/leads"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']} requireVerifiedDealer>
                      <DealerLeadsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/bookings"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']} requireVerifiedDealer>
                      <DealerBookingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/ratings"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']}>
                      <DealerRatingsReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']}>
                      <DealerNotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/profile"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']}>
                      <ShowroomProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dealer/staff"
                  element={
                    <ProtectedRoute allowedRoles={['dealer']}>
                      <StaffManagementPage />
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
