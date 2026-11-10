import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent } from '@/components/ui';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

export function ForbiddenPage() {
  const { profile, logout } = useAuth();

  const homeTarget =
    profile?.role === 'dealer'
      ? '/dealer/dashboard'
      : profile?.role === 'buyer'
      ? '/buyer/dashboard'
      : '/';

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-elevated">
        <CardContent className="p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <span className="inline-block font-mono text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">
              HTTP 403 • Forbidden
            </span>
            <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Administrator privileges are required to view this area. Your current account ({profile?.role || 'guest'}) does not have permission to open AutoGroup administration routes.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Link to={homeTarget}>
              <Button variant="primary" size="md" className="w-full" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Return to My Portal
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full text-slate-600"
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
