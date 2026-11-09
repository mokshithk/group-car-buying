import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { OtpVerification } from '@/components/auth/OtpVerification';
import { useAuth } from '@/context/AuthContext';
import { Car } from 'lucide-react';

export function VerifyOtpPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile, profile } = useAuth();

  const emailParam = searchParams.get('email') || '';
  const typeParam = (searchParams.get('type') as 'signup' | 'recovery') || 'signup';
  const [email] = useState(emailParam);

  const handleSuccess = async () => {
    await refreshProfile();
    if (profile?.role === 'dealer') {
      navigate('/dealer/pending-approval', { replace: true });
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

        <OtpVerification
          email={email}
          type={typeParam}
          title="Enter 6-Digit Verification Code"
          onSuccess={handleSuccess}
          onChangeEmail={() => navigate('/register')}
        />
      </div>
    </div>
  );
}
