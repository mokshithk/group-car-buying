import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Car, Lock, Mail, User, Phone, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';

const SEED_DISTRICTS = [
  { value: 'd1111111-1111-1111-1111-111111111101', label: 'Bengaluru Urban (Karnataka)' },
  { value: 'd1111111-1111-1111-1111-111111111102', label: 'Bengaluru Rural (Karnataka)' },
  { value: 'd1111111-1111-1111-1111-111111111103', label: 'Mysuru (Karnataka)' },
  { value: 'd1111111-1111-1111-1111-111111111104', label: 'Dakshina Kannada (Karnataka)' },
  { value: 'd1111111-1111-1111-1111-111111111105', label: 'Mumbai City (Maharashtra)' },
  { value: 'd1111111-1111-1111-1111-111111111106', label: 'Pune (Maharashtra)' },
  { value: 'd1111111-1111-1111-1111-111111111108', label: 'Chennai (Tamil Nadu)' },
  { value: 'd1111111-1111-1111-1111-111111111110', label: 'Hyderabad (Telangana)' },
  { value: 'd1111111-1111-1111-1111-111111111111', label: 'Central Delhi (Delhi)' },
  { value: 'd1111111-1111-1111-1111-111111111112', label: 'Gurugram (Haryana)' },
];

export function BuyerRegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [districtId, setDistrictId] = useState(SEED_DISTRICTS[0].value);
  const [password, setPassword] = useState('');
  const [consentShareDetails, setConsentShareDetails] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessUnconfirmed, setIsSuccessUnconfirmed] = useState(false);

  const { registerBuyer } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentShareDetails) {
      setError('You must consent to sharing contact details with quoting dealerships upon expressing interest or booking.');
      return;
    }

    setError('');
    setIsLoading(true);

    const res = await registerBuyer({
      fullName,
      email,
      phone,
      districtId,
      password,
      consentShareDetails,
    });
    setIsLoading(false);

    if (res.success) {
      if (res.requiresEmailConfirmation) {
        setIsSuccessUnconfirmed(true);
      } else {
        navigate(redirectUrl || '/buyer/dashboard', { replace: true });
      }
    } else {
      setError(res.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
              <Car className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Auto<span className="text-brand-600">Group</span>
            </span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Create Buyer Account</h2>
          <p className="mt-1 text-sm text-slate-500">
            Form local buying groups to receive competitive quotes in your district
          </p>
        </div>

        {isSuccessUnconfirmed ? (
          <Card className="shadow-elevated border-slate-200/80 p-8 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 border border-emerald-100 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Registration Successful!</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              We have sent an activation email to <strong>{email}</strong>. Please check your inbox and click the confirmation link to activate your account.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
              <Link to="/login">
                <Button variant="primary" className="w-full">
                  Go to Login
                </Button>
              </Link>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-left text-xs text-amber-900 space-y-1">
                <p className="font-semibold text-amber-950">Tip for testing / development:</p>
                <p>
                  In your Supabase project, go to <strong>Authentication &gt; Providers &gt; Email</strong> and turn OFF <strong>"Confirm email"</strong>. This skips verification emails and logs users in immediately without rate limits.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="shadow-elevated border-slate-200/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-900">Buyer Registration</CardTitle>
            <CardDescription>
              District selection determines the local buying groups and dealerships available to you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Rahul Sharma"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="rahul@gmail.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <Input
                  label="Mobile Number"
                  type="tel"
                  placeholder="9876543210"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>

              <div className="space-y-1">
                <Select
                  label="Your District (Crucial for Group Matching)"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  options={SEED_DISTRICTS}
                  required
                />
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-brand-600 shrink-0" />
                  You will only see buying groups and authorized dealer quotes in this district.
                </p>
              </div>

              <Input
                label="Create Password"
                type="password"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
              />

              {/* Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentShareDetails}
                    onChange={(e) => setConsentShareDetails(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    required
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    I consent to AutoGroup sharing my name and contact number with an authorized dealership{' '}
                    <strong>only when I tap "I'm interested" or "Book now"</strong> on their quote. My contact details will never be public to other group members.
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-semibold mt-4"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Buyer Account
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                  Sign In
                </Link>
                {' · '}
                <Link to="/register/dealer" className="font-semibold text-slate-700 hover:text-brand-600">
                  Register as Dealership
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
