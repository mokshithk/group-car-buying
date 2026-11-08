import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Car, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, setMockSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const res = await login(email, password);
    setIsLoading(false);

    if (res.success) {
      if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
      } else if (res.role === 'dealer') {
        navigate('/dealer/dashboard', { replace: true });
      } else {
        navigate('/buyer/dashboard', { replace: true });
      }
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  const handleQuickDemo = (role: 'buyer' | 'dealer') => {
    if (role === 'dealer') {
      setMockSession('dealer');
      navigate(redirectUrl || '/dealer/dashboard', { replace: true });
    } else {
      setMockSession('buyer');
      navigate(redirectUrl || '/buyer/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-md">
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
          <h2 className="mt-4 text-xl font-bold text-slate-900">Welcome Back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your buyer or dealer account</p>
        </div>

        <Card className="shadow-elevated border-slate-200/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-900">Account Login</CardTitle>
            <CardDescription>Enter your email address and password to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Password</span>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-semibold mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-3">
              <p className="text-xs text-slate-500">
                New to AutoGroup?{' '}
                <Link to="/register/buyer" className="font-semibold text-brand-600 hover:text-brand-700">
                  Register as Buyer
                </Link>
                {' · '}
                <Link to="/register/dealer" className="font-semibold text-slate-700 hover:text-brand-600">
                  Dealership Sign Up
                </Link>
              </p>

              {/* Instant Test Mode Switcher */}
              <div className="pt-3 border-t border-dashed border-slate-200">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Instant Test Session
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleQuickDemo('buyer')}
                    className="text-xs bg-slate-50 hover:bg-slate-100"
                  >
                    Buyer Test Session
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleQuickDemo('dealer')}
                    className="text-xs bg-slate-50 hover:bg-slate-100"
                  >
                    Dealer Test Session
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
