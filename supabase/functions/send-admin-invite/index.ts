// Optional Supabase Edge Function to email admin invitation links automatically.
// Reads provider API key from Supabase Edge Function secrets (RESEND_API_KEY / FROM_EMAIL).
// Do NOT commit any API keys or secrets. Deploy only via `supabase functions deploy send-admin-invite`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const fromEmail = Deno.env.get('INVITE_FROM_EMAIL') || 'AutoGroup Admin <no-reply@autogroup.local>';

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ sent: false, reason: 'Supabase env missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller identity and super_admin role using caller JWT + RLS
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await client
      .from('profiles')
      .select('role, status')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== 'super_admin' || callerProfile.status !== 'ACTIVE') {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, role, inviteUrl } = (await req.json()) as {
      email?: string;
      role?: string;
      inviteUrl?: string;
    };

    if (!email || !inviteUrl) {
      return new Response(JSON.stringify({ error: 'Missing email or inviteUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ sent: false, reason: 'RESEND_API_KEY secret is not configured.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'AutoGroup Administrator Invitation',
        text: `You have been invited as an AutoGroup ${role || 'admin'}.\n\nComplete verification and password setup (expires in 7 days):\n${inviteUrl}\n`,
      }),
    });

    if (!mailRes.ok) {
      const detail = await mailRes.text();
      return new Response(JSON.stringify({ sent: false, reason: detail }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ sent: false, error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
