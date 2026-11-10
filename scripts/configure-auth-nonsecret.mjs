// Applies non-secret Auth settings via Supabase Management API for project hjqpprhljvwmcelgwznq.
// Keeps Confirm email OFF (mailer_autoconfirm: true) so local .env.local SMTP handles all OTP verification.
// Reads SUPABASE_ACCESS_TOKEN strictly from environment variables (never writes or logs it).

const ALLOWED_PROJECT_REF = 'hjqpprhljvwmcelgwznq';

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN environment variable.');
  }

  const explicitRef = process.env.SUPABASE_PROJECT_REF;
  if (explicitRef && explicitRef !== ALLOWED_PROJECT_REF) {
    throw new Error(`Refusing execution: SUPABASE_PROJECT_REF (${explicitRef}) !== ${ALLOWED_PROJECT_REF}.`);
  }

  const endpoint = `https://api.supabase.com/v1/projects/${ALLOWED_PROJECT_REF}/config/auth`;

  const payload = {
    site_url: 'http://localhost:5173',
    mailer_autoconfirm: true, // Confirm email OFF so local .env.local SMTP portal handles all 6-digit OTP emails
  };

  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management API returned HTTP ${res.status}: ${text}`);
  }

  const updated = JSON.parse(text);
  console.log('Non-secret Auth config updated successfully:', {
    site_url: updated.site_url,
    mailer_autoconfirm: updated.mailer_autoconfirm,
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
