import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { OtpVerification } from '@/components/auth/OtpVerification';
import { useAuth } from '@/context/AuthContext';
import { Car } from 'lucide-react';

export function VerifyOtpPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile, profile, dealership } = useAuth();

  const emailParam = searchParams.get('email') || '';
  const typeParam = (searchParams.get('type') as 'signup' | 'recovery') || 'signup';
  const [email] = useState(emailParam);

  const handleSuccess = async () => {
    const res = await refreshProfile();
    const currentRole = res?.profile?.role || profile?.role;
    if (currentRole === 'admin' || currentRole === 'super_admin') {
      navigate(res?.profile?.must_change_password ? '/admin/set-password' : '/admin/dashboard', { replace: true });
    } else if (currentRole === 'dealer') {
      const dStatus = res?.dealership?.status || dealership?.status;
      if (dStatus === 'REJECTED' || dStatus === 'SUSPENDED') {
        navigate('/dealer/status', { replace: true });
      } else if (dStatus === 'PENDING') {
        navigate('/dealer/pending', { replace: true });
      } else {
        navigate('/dealer/dashboard', { replace: true });
      }
    } else {
      navigate('/buyer/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
              <Car className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Auto<span className="text-brand-600">Group</span>
            </span>
          </Link>
        </div>

        {!email ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
            <h2 className="text-base font-bold text-slate-900">No Email Specified</h2>
            <p className="text-xs text-slate-500">
              Please sign in or start registration so we know which email address to verify.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link to="/login" className="text-xs font-semibold text-brand-600 hover:underline">
                Back to Sign In
              </Link>
              <Link to="/register" className="text-xs font-semibold text-slate-700 hover:underline">
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <OtpVerification
            email={email}
            type={typeParam}
            provider="supabase_otp"
            allowCreateUser={false}
            title="Enter 6-Digit Verification Code"
            description={`Enter the 6-digit email verification code sent to ${email} to activate your account.`}
            onSuccess={handleSuccess}
            onChangeEmail={() => navigate('/login')}
          />
        )}
      </div>
    </div>
  );
}
