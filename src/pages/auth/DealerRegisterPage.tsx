import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { OtpVerification } from '@/components/auth/OtpVerification';
import { fetchDistricts, fetchManufacturers } from '@/lib/catalogService';
import { District } from '@/types';
import { Building2, Lock, Mail, User, Phone, FileText, CheckSquare, ArrowRight, ShieldAlert } from 'lucide-react';

const FALLBACK_BRANDS = [
  'Tata Motors',
  'Hyundai',
  'Mahindra',
  'Maruti Suzuki',
  'Kia',
  'Toyota',
  'Volkswagen',
  'Skoda',
  'Honda',
  'MG',
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function DealerRegisterPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>(FALLBACK_BRANDS);
  const [dealershipName, setDealershipName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [smtpError, setSmtpError] = useState('');
  const [challengeToken, setChallengeToken] = useState('');

  useEffect(() => {
    Promise.all([fetchDistricts(), fetchManufacturers()])
      .then(([dList, mList]) => {
        setDistricts(dList);
        if (dList.length > 0) {
          setDistrictId((prev) => prev || dList[0].id);
        }
        if (mList.length > 0) {
          const names = mList.map((m) => m.name);
          setAvailableBrands(names);
          const defaultBrand = names.includes('Tata Motors') ? 'Tata Motors' : names[0];
          setSelectedBrands((prev) => (prev.length > 0 ? prev : [defaultBrand]));
        } else {
          setSelectedBrands((prev) => (prev.length > 0 ? prev : [FALLBACK_BRANDS[0]]));
        }
      })
      .catch(console.error);
  }, []);

  const { requestSignupOtp, registerDealer, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleBrandToggle = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      if (selectedBrands.length > 1) {
        setSelectedBrands(selectedBrands.filter((b) => b !== brand));
      }
    } else {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlreadyRegistered(false);
    const normalizedGst = gstNumber.trim().toUpperCase();
    if (!GSTIN_REGEX.test(normalizedGst)) {
      setError('Please enter a valid 15-character Indian GSTIN (e.g. 29AAAAA0000A1Z5).');
      return;
    }
    if (!/^[+\d\s-]{10,16}$/.test(phone.trim())) {
      setError('Please enter a valid 10-digit showroom contact number.');
      return;
    }
    if (selectedBrands.length === 0) {
      setError('Please select at least one authorized OEM brand.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const otpRes = await requestSignupOtp(email.trim(), ownerName.trim());
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
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
                <Building2 className="w-5 h-5 text-brand-400" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                Auto<span className="text-brand-600">Group</span> <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">DEALER</span>
              </span>
            </Link>
          </div>
          <OtpVerification
            email={email}
            type="signup"
            title="Verify Dealership Account"
            initialDevOtp={devOtp}
            smtpError={smtpError}
            initialChallengeToken={challengeToken}
            otpAlreadyDispatched={true}
            enableSupabaseLinkAutoDetect={false}
            onSuccess={async () => {
              const res = await registerDealer({
                dealershipName: dealershipName.trim(),
                ownerName: ownerName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                districtId,
                address: address.trim(),
                gstNumber: gstNumber.trim().toUpperCase(),
                brands: selectedBrands,
                password,
              });
              if (!res.success) {
                throw new Error(res.error || 'Dealership registration failed after OTP verification.');
              }
              if (res.requiresEmailConfirmation) {
                navigate(`/register/verify-otp?email=${encodeURIComponent(email.trim())}&type=signup`, { replace: true });
                return;
              }
              await refreshProfile();
              navigate('/dealer/pending-approval', { replace: true });
            }}
            onChangeEmail={() => setShowOtp(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5 text-brand-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Auto<span className="text-brand-600">Group</span> <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">DEALER</span>
            </span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Dealership Onboarding</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect directly with verified local buying groups in your district
          </p>
        </div>

        <Card className="shadow-elevated border-slate-200/80">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/60 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Manual Verification Required Before Quoting</span>
            </div>
            <CardTitle className="text-base text-slate-900">Showroom Details</CardTitle>
            <CardDescription>
              New dealerships start as <strong>PENDING</strong> and must be verified before seeing group quotes.
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
                label="Dealership Legal Name"
                placeholder="Apex Motors Private Limited"
                required
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                leftIcon={<Building2 className="w-4 h-4" />}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Authorized Signatory Name"
                  placeholder="Vikram Rao"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                />
                <Input
                  label="GSTIN Number"
                  placeholder="29AAAAA0000A1Z5"
                  required
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  leftIcon={<FileText className="w-4 h-4" />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Official Email"
                  type="email"
                  placeholder="contact@apexmotors.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <Input
                  label="Official Phone"
                  type="tel"
                  placeholder="+91 98450 11223"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>

              <Select
                label="Operating District"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                options={[
                  { value: '', label: 'Select operating district...' },
                  ...districts.map((d) => ({
                    value: d.id,
                    label: `${d.name} (${d.state})`,
                  })),
                ]}
                required
              />

              <Input
                label="Showroom Full Address"
                placeholder="Plot 45, Outer Ring Road, Marathahalli"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              {/* Brands selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Authorized OEM Brands (Select all that apply)
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {availableBrands.map((brand) => {
                    const isSelected = selectedBrands.includes(brand);
                    return (
                      <button
                        type="button"
                        key={brand}
                        onClick={() => handleBrandToggle(brand)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                          isSelected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {brand}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Input
                  label="Create Account Password"
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

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                <CheckSquare className="w-4 h-4 text-brand-600 inline mr-1.5 shrink-0" />
                By submitting this application, you agree to honor submitted quotation price snapshots for all booked buyers until vehicle delivery.
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-semibold mt-4 bg-slate-900 hover:bg-slate-800"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Submit Dealership Application
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Already registered as dealer?{' '}
                <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                  Sign In
                </Link>
                {' · '}
                <Link to="/register/buyer" className="font-semibold text-slate-700 hover:text-brand-600">
                  Buyer Sign Up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
