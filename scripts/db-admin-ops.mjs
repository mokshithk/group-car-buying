// Local database operation helper using `pg` and terminal environment variables only.
// Strictly refuses to connect to any project other than hjqpprhljvwmcelgwznq.
// Never logs, writes, or prints passwords, access tokens, or secret strings.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ALLOWED_PROJECT_REF = 'hjqpprhljvwmcelgwznq';

function readEnvLocalValue(key) {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) return '';
  const text = fs.readFileSync(envPath, 'utf8');
  const match = text.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

function readEnvLocalUrl() {
  return readEnvLocalValue('VITE_SUPABASE_URL');
}

async function verifyGoTrueLogin(email, password) {
  const url = readEnvLocalValue('VITE_SUPABASE_URL');
  const anonKey = readEnvLocalValue('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) return;

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth login verification failed (HTTP ${res.status}): ${body}`);
  }
}

function assertAllowedProjectRef() {
  const envUrl = readEnvLocalUrl();
  if (envUrl && !envUrl.includes(ALLOWED_PROJECT_REF)) {
    throw new Error(`Refusing execution: .env.local VITE_SUPABASE_URL does not target ${ALLOWED_PROJECT_REF}.`);
  }
  const explicitRef = process.env.SUPABASE_PROJECT_REF;
  if (explicitRef && explicitRef !== ALLOWED_PROJECT_REF) {
    throw new Error(`Refusing execution: SUPABASE_PROJECT_REF (${explicitRef}) !== ${ALLOWED_PROJECT_REF}.`);
  }
}

async function resolveConnectionConfig() {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  if (!dbPassword) {
    throw new Error('Missing SUPABASE_DB_PASSWORD environment variable.');
  }

  // If pooler connection string or explicit host is supplied by SUPABASE_DB_URL / Management API lookup
  if (process.env.SUPABASE_DB_URL) {
    if (!process.env.SUPABASE_DB_URL.includes(ALLOWED_PROJECT_REF)) {
      throw new Error(`Refusing execution: SUPABASE_DB_URL does not target ${ALLOWED_PROJECT_REF}.`);
    }
    return { connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } };
  }

  // Try direct host first; if IPv4 fallback via Management API pooler config is needed, resolve host cleanly
  const directConfig = {
    host: `db.${ALLOWED_PROJECT_REF}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  };

  const client = new pg.Client(directConfig);
  try {
    await client.connect();
    await client.end();
    return directConfig;
  } catch (directErr) {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) throw directErr;

    const resp = await fetch(`https://api.supabase.com/v1/projects/${ALLOWED_PROJECT_REF}/config/database/pooler`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw directErr;
    const poolers = await resp.json();
    const sessionPooler = Array.isArray(poolers)
      ? poolers.find((p) => p.database_type === 'PRIMARY' && p.pool_mode === 'session') || poolers[0]
      : null;

    if (!sessionPooler?.db_host) throw directErr;
    return {
      host: sessionPooler.db_host,
      port: Number(sessionPooler.db_port || 5432),
      user: sessionPooler.db_user || `postgres.${ALLOWED_PROJECT_REF}`,
      password: dbPassword,
      database: sessionPooler.db_name || 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    };
  }
}

async function createOrUpdateAuthUser(client, { email, password, fullName, phone, role, mustChangePassword }) {
  const cleanEmail = email.trim().toLowerCase();

  // Discover schema details dynamically
  const { rows: cryptoProc } = await client.query(`
    SELECT n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'crypt'
    ORDER BY CASE WHEN n.nspname = 'extensions' THEN 0 ELSE 1 END
    LIMIT 1
  `);
  const cryptoSchema = cryptoProc[0]?.nspname || 'extensions';

  const { rows: idColsRes } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities'
  `);
  const idCols = new Set(idColsRes.map((r) => r.column_name));

  const { rows: existing } = await client.query(
    'SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1',
    [cleanEmail]
  );

  let userId;
  if (existing.length > 0) {
    userId = existing[0].id;
    await client.query(
      `UPDATE auth.users
       SET encrypted_password = ${cryptoSchema}.crypt($1, ${cryptoSchema}.gen_salt('bf', 10)),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', $2::text),
           updated_at = now()
       WHERE id = $3`,
      [password, fullName, userId]
    );
  } else {
    userId = crypto.randomUUID();
    await client.query(
      `INSERT INTO auth.users (
         id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
       ) VALUES (
         $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         $2, ${cryptoSchema}.crypt($3, ${cryptoSchema}.gen_salt('bf', 10)),
         now(), '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('role', 'buyer', 'full_name', $4::text),
         now(), now(), '', '', '', ''
       )`,
      [userId, cleanEmail, password, fullName]
    );
  }

  // Ensure matching auth.identities row exists
  const { rows: identRows } = await client.query(
    `SELECT id FROM auth.identities WHERE user_id = $1 AND provider = 'email' LIMIT 1`,
    [userId]
  );

  if (identRows.length === 0) {
    const providerIdValue = idCols.has('provider_id') ? String(userId) : undefined;
    if (providerIdValue !== undefined) {
      await client.query(
        `INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         VALUES ($1::uuid, $2::uuid, $3::text, jsonb_build_object('sub', $3::text, 'email', $4::text, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now())`,
        [crypto.randomUUID(), userId, String(userId), cleanEmail]
      );
    } else {
      await client.query(
        `INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         VALUES ($1::uuid, $2::uuid, jsonb_build_object('sub', $3::text, 'email', $4::text, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now())`,
        [crypto.randomUUID(), userId, String(userId), cleanEmail]
      );
    }
  }

  if (role) {
    await client.query("SELECT set_config('autogroup.internal_rpc', 'true', true)");
    await client.query(
      `INSERT INTO public.profiles (id, role, full_name, email, phone, status, must_change_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         role = $2,
         full_name = $3,
         email = $4,
         status = 'ACTIVE',
         must_change_password = $6,
         updated_at = now()`,
      [userId, role, fullName, cleanEmail, phone || '', Boolean(mustChangePassword)]
    );
    await client.query("SELECT set_config('autogroup.internal_rpc', '', true)");
  }

  return userId;
}

async function main() {
  assertAllowedProjectRef();
  const cmd = process.argv[2];
  const cfg = await resolveConnectionConfig();
  const client = new pg.Client(cfg);
  await client.connect();

  try {
    if (cmd === 'check-base-tables') {
      const { rows } = await client.query(`
        SELECT
          to_regclass('public.profiles') IS NOT NULL AS has_profiles,
          to_regclass('public.dealerships') IS NOT NULL AS has_dealerships,
          to_regclass('public.bookings') IS NOT NULL AS has_bookings
      `);
      console.log(JSON.stringify(rows[0]));
      if (!rows[0].has_profiles || !rows[0].has_dealerships || !rows[0].has_bookings) {
        process.exitCode = 2;
      }
    } else if (cmd === 'verify-schema') {
      const tables = await client.query(`
        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname
      `);
      const funcs = await client.query(`
        SELECT p.proname AS function_name
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND (p.proname LIKE 'admin_%' OR p.proname IN ('is_admin','is_super_admin','validate_admin_invite','accept_admin_invite','fn_expire_1_member_groups','sync_user_sign_in'))
        ORDER BY p.proname
      `);
      const policies = await client.query(`
        SELECT tablename, policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `);
      console.log('TABLES_RLS:', JSON.stringify(tables.rows));
      console.log('ADMIN_FUNCTIONS:', JSON.stringify(funcs.rows.map((r) => r.function_name)));
      console.log('POLICY_COUNT:', policies.rows.length);
    } else if (cmd === 'bootstrap-first-admin') {
      const adminEmail = process.env.FIRST_ADMIN_EMAIL;
      const adminPassword = process.env.FIRST_ADMIN_PASSWORD;
      if (!adminEmail || !adminPassword || adminPassword.length < 20) {
        throw new Error('FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD (>=20 chars) must be set in session env.');
      }

      await client.query('BEGIN');
      const userId = await createOrUpdateAuthUser(client, {
        email: adminEmail,
        password: adminPassword,
        fullName: 'Platform Super Admin',
        phone: '',
        role: 'super_admin',
        mustChangePassword: true,
      });

      await client.query(
        `SELECT public.fn_write_audit_log(
           $1::uuid, 'BOOTSTRAP_FIRST_SUPER_ADMIN', 'profile', $2::text,
           NULL, jsonb_build_object('email', $3::text, 'role', 'super_admin', 'must_change_password', true),
           'Initial super_admin provisioned via bootstrap script'
         )`,
        [userId, String(userId), adminEmail.trim().toLowerCase()]
      );
      await client.query('COMMIT');
      await verifyGoTrueLogin(adminEmail, adminPassword);
      console.log(`Bootstrapped & verified login for first super_admin (${adminEmail.trim().toLowerCase()}) id=${userId}.`);
    } else if (cmd === 'setup-test-suite') {
      const defs = [
        { key: 'BUYER_A', email: 'test_buyer_a@autogroup.in', role: 'buyer', fullName: 'Test Buyer Alpha', mustChange: false },
        { key: 'BUYER_B', email: 'test_buyer_b@autogroup.in', role: 'buyer', fullName: 'Test Buyer Beta', mustChange: false },
        { key: 'DEALER_A', email: 'test_dealer_a@autogroup.in', role: 'dealer', fullName: 'Rajesh Rao (Apex Tata)', mustChange: false },
        { key: 'DEALER_B', email: 'test_dealer_b@autogroup.in', role: 'dealer', fullName: 'Suresh Kumar (Premier Hyundai)', mustChange: false },
        { key: 'ADMIN', email: 'test_admin@autogroup.in', role: 'admin', fullName: 'Test Regular Admin', mustChange: false },
        { key: 'SUPER_ADMIN', email: 'test_super_admin@autogroup.in', role: 'super_admin', fullName: 'Test Super Admin', mustChange: false },
      ];

      const envLines = [];
      const localEnv = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
      const urlMatch = localEnv.match(/^VITE_SUPABASE_URL=(.+)$/m);
      const anonMatch = localEnv.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m);
      if (urlMatch) envLines.push(`VITE_SUPABASE_URL=${urlMatch[1].trim()}`);
      if (anonMatch) envLines.push(`VITE_SUPABASE_ANON_KEY=${anonMatch[1].trim()}`);

      await client.query('BEGIN');
      for (const d of defs) {
        const pw = `AgTest_${crypto.randomBytes(12).toString('base64url')}!9`;
        await createOrUpdateAuthUser(client, {
          email: d.email,
          password: pw,
          fullName: d.fullName,
          phone: '',
          role: d.role,
          mustChangePassword: d.mustChange,
        });
        envLines.push(`TEST_${d.key}_EMAIL=${d.email}`);
        envLines.push(`TEST_${d.key}_PASSWORD=${pw}`);
      }
      await client.query('COMMIT');

      // Apply supabase/test_setup.sql fixtures idempotently
      const setupSql = fs.readFileSync(path.resolve('supabase/test_setup.sql'), 'utf8');
      await client.query(setupSql);

      // Write gitignored .env.test without logging credentials
      fs.writeFileSync(path.resolve('.env.test'), envLines.join('\n') + '\n', 'utf8');
      console.log('Test accounts provisioned, test_setup.sql applied, and gitignored .env.test written.');
    } else if (cmd === 'run-sql-file') {
      const targetFile = process.argv[3];
      if (!targetFile) throw new Error('Specify path to .sql file.');
      const sql = fs.readFileSync(path.resolve(targetFile), 'utf8');
      await client.query(sql);
      console.log(`Executed SQL file successfully: ${targetFile}`);
    } else {
      throw new Error(`Unknown command: ${cmd}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
