import { AlertTriangle, Database, Terminal } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';

interface SupabaseErrorScreenProps {
  message?: string;
}

export function SupabaseErrorScreen({ message }: SupabaseErrorScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 px-4 py-12">
      <div className="w-full max-w-xl">
        <Card className="bg-slate-800/90 border-amber-500/40 text-slate-100 shadow-2xl backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-white tracking-tight">
              Backend Connection Required
            </CardTitle>
            <CardDescription className="text-slate-300 text-sm mt-1">
              {message || 'The application could not connect to the Supabase backend service.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4 text-xs leading-relaxed">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700/60 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                <Database className="w-4 h-4" /> Environment Configuration
              </div>
              <p className="text-slate-300">
                To run the Group Car Buying Platform with real data and authentication, verify your <code>.env.local</code> has valid credentials:
              </p>
              <pre className="p-3 rounded-lg bg-black/60 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700/60 space-y-2">
              <div className="flex items-center gap-2 text-sky-300 font-semibold text-sm">
                <Terminal className="w-4 h-4" /> Database Schema Setup
              </div>
              <p className="text-slate-300">
                Ensure you have executed the database migrations and catalog seed in your Supabase SQL Editor:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                <li><code>supabase/migrations/001_initial_schema.sql</code></li>
                <li><code>supabase/migrations/002_rls_policies.sql</code></li>
                <li><code>supabase/migrations/003_auth_user_trigger.sql</code></li>
                <li><code>supabase/seed.sql</code></li>
              </ol>
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow"
              >
                Retry Connection
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
