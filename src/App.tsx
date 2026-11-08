import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui';
import { LoginPage } from '@/pages/auth/LoginPage';
import { BuyerRegisterPage } from '@/pages/auth/BuyerRegisterPage';
import { DealerRegisterPage } from '@/pages/auth/DealerRegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { PendingApprovalPage } from '@/pages/dealer/PendingApprovalPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-surface-canvas">
            <main className="flex-1">
              <Routes>
                {/* Public & Auth */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register/buyer" element={<BuyerRegisterPage />} />
                <Route path="/register/dealer" element={<DealerRegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/dealer/pending-approval" element={<PendingApprovalPage />} />

                {/* Default root */}
                <Route
                  path="/"
                  element={
                    <div className="p-8 text-center">
                      <h1 className="text-3xl font-bold text-slate-900">AutoGroup Platform</h1>
                      <div className="mt-4 flex justify-center gap-4">
                        <a href="/login" className="text-brand-600 font-semibold underline">Login</a>
                        <a href="/register/buyer" className="text-brand-600 font-semibold underline">Register Buyer</a>
                        <a href="/register/dealer" className="text-brand-600 font-semibold underline">Register Dealer</a>
                      </div>
                    </div>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
