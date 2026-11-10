import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { OtpVerification } from '@/components/auth/OtpVerification';
import { fetchDistricts } from '@/lib/catalogService';
import { District } from '@/types';
import { Car, Lock, Mail, User, Phone, MapPin, ArrowRight } from 'lucide-react';

export function BuyerRegisterPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [password, setPassword] = useState('');
  const [consentShareDetails, setConsentShareDetails] = useState(false);
  const [error, setError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [smtpError, setSmtpError] = useState('');
  const [challengeToken, setChallengeToken] = useState('');

  useEffect(() => {
    fetchDistricts().then((dList) => {
      setDistricts(dList);
      if (dList.length > 0) {
        setDistrictId((prev) => prev || dList[0].id);
      }
    }).catch(console.error);
  }, []);

  const { requestSignupOtp, registerBuyer, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlreadyRegistered(false);
    if (!consentShareDetails) {
      setError('You must consent to sharing contact details with quoting dealerships upon expressing interest or booking.');
      return;
    }
    if (!/^[+\d\s-]{10,16}$/.test(phone.trim())) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const otpRes = await requestSignupOtp(email.trim(), fullName.trim());
      if (otpRes.success) {
        setDevOtp(otpRes.devOtp || '');
        setSmtpError(otpRes.smtpError || '');
        setChallengeToken(otpRes.challengeToken || '');
        setShowOtp(true);
      } else {
        setAlreadyRegistered(Boolean(otpRes.alreadyRegistered));
        setError(otpRes.error || 'Unable to start verification.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start verification.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showOtp) {
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
            type="signup"
            title="Verify Buyer Account"
            initialDevOtp={devOtp}
            smtpError={smtpError}
            initialChallengeToken={challengeToken}
            otpAlreadyDispatched={true}
            enableSupabaseLinkAutoDetect={false}
            onSuccess={async () => {
              const res = await registerBuyer({
                fullName,
                email,
                phone,
                districtId,
                password,
                consentShareDetails,
              });
              if (!res.success) {
                throw new Error(res.error || 'Registration failed after OTP verification.');
              }
              if (res.requiresEmailConfirmation) {
                navigate(`/register/verify-otp?email=${encodeURIComponent(email.trim())}&type=signup`, { replace: true });
                return;
              }
              await refreshProfile();
              navigate(redirectUrl || '/buyer/dashboard', { replace: true });
            }}
            onChangeEmail={() => setShowOtp(false)}
          />
        </div>
      </div>
    );
  }

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

        <Card className="shadow-elevated border-slate-200/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-900">Buyer Registration</CardTitle>
            <CardDescription>
              District selection determines the local buying groups and dealerships available to you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 space-y-1.5">
                <div>{error}</div>
                {alreadyRegistered && (
                  <div className="flex items-center gap-3 pt-1">
                    <Link to="/login" className="font-semibold underline hover:text-rose-900">
                      Sign In &rarr;
                    </Link>
                    <Link to="/forgot-password" className="font-semibold underline hover:text-rose-900">
                      Reset Password
                    </Link>
                  </div>
                )}
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
                  options={[
                    { value: '', label: 'Select your district...' },
                    ...districts.map((d) => ({
                      value: d.id,
                      label: `${d.name} (${d.state})`,
                    })),
                  ]}
                  required
                />
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-brand-600 shrink-0" />
                  You will only see buying groups and authorized dealer quotes in this district.
                </p>
              </div>

              <div className="space-y-1.5">
                <Input
                  label="Create Password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />
                {password.length > 0 && (
                  <div className="flex items-center gap-3 text-[11px] pt-1">
                    <span className={password.length >= 8 ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      {password.length >= 8 ? '✓' : '○'} 8+ characters
                    </span>
                    <span className={/[a-zA-Z]/.test(password) && /[0-9!@#$%^&*]/.test(password) ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      {/[a-zA-Z]/.test(password) && /[0-9!@#$%^&*]/.test(password) ? '✓' : '○'} Letters & numbers/symbols
                    </span>
                  </div>
                )}
              </div>

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
      </div>
    </div>
  );
}
