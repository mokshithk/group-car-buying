import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import {
  sealToken,
  unsealToken,
  safeCodeEquals,
  type OtpChallengePayload,
  type OtpVerifiedPayload,
} from './otpToken.js';

interface DiskOtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

export interface ServerConfig {
  smtpEmail: string;
  smtpPassword: string;
  smtpServer: string;
  smtpPort: string;
  otpSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  isHostedServerless: boolean;
}

export type NodeHttpRequest = IncomingMessage & { body?: unknown };

const OTP_CHALLENGE_COOKIE = 'autogroup_otp_challenge';
const OTP_VERIFIED_COOKIE = 'autogroup_otp_verified';
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const usedResetTokens = new Map<string, number>();

declare global {
  var __autogroupDevOtpSecret: string | undefined;
}

function isHostedEnvironment(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function sendJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readLocalEnvFiles(projectRoot: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(projectRoot, file);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (!match) continue;
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!env[key] && val) {
          env[key] = val;
        }
      }
    } catch {
      // Ignore unreadable env files
    }
  }
  return env;
}

export function getServerConfig(projectRoot: string = process.cwd()): ServerConfig {
  const isHosted = isHostedEnvironment();
  const fileEnv = isHosted ? {} : readLocalEnvFiles(projectRoot);
  const pick = (key: string): string => (process.env[key] || fileEnv[key] || '').trim();

  const smtpServer = pick('SMTP_SERVER') || 'smtp.gmail.com';
  const rawPassword = pick('SMTP_PASSWORD');
  const smtpPassword = smtpServer.toLowerCase().includes('gmail')
    ? rawPassword.replace(/\s+/g, '')
    : rawPassword;

  const explicitSecret = pick('OTP_SIGNING_SECRET');
  const serviceRoleKey = pick('SUPABASE_SERVICE_ROLE_KEY');
  const derivedFallback = explicitSecret || serviceRoleKey || smtpPassword;

  let otpSecret = derivedFallback
    ? crypto.createHash('sha256').update(`autogroup-otp-v1:${derivedFallback}`).digest('hex')
    : '';

  if (!otpSecret && !isHosted) {
    if (!globalThis.__autogroupDevOtpSecret) {
      globalThis.__autogroupDevOtpSecret = crypto.randomBytes(32).toString('hex');
    }
    otpSecret = globalThis.__autogroupDevOtpSecret;
  }

  return {
    smtpEmail: pick('SMTP_EMAIL'),
    smtpPassword,
    smtpServer,
    smtpPort: pick('SMTP_PORT') || '465',
    otpSecret,
    supabaseUrl: pick('VITE_SUPABASE_URL') || pick('SUPABASE_URL'),
    supabaseServiceRoleKey: serviceRoleKey,
    isHostedServerless: isHosted,
  };
}

export async function parseJsonBody(req: NodeHttpRequest): Promise<Record<string, unknown>> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      return req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    }
    if (typeof req.body === 'object' && req.body !== null) {
      return req.body as Record<string, unknown>;
    }
    return {};
  }

  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += String(chunk);
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data) as Record<string, unknown>);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

function isSecureRequest(req: IncomingMessage): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.toLowerCase().includes('https')) return true;
  return Boolean((req.socket as { encrypted?: boolean } | undefined)?.encrypted);
}

function buildCookie(name: string, value: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function setResponseCookies(res: ServerResponse, cookies: string[]): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookies);
    return;
  }
  const prev = Array.isArray(existing) ? existing.map(String) : [String(existing)];
  res.setHeader('Set-Cookie', [...prev, ...cookies]);
}

function getCacheFilePath(projectRoot: string): string {
  const cacheDir = path.resolve(projectRoot, 'node_modules', '.cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return path.join(cacheDir, 'autogroup-otp-store.json');
}

function loadDiskOtpStore(projectRoot: string): Map<string, DiskOtpEntry> {
  try {
    const filePath = getCacheFilePath(projectRoot);
    if (!fs.existsSync(filePath)) return new Map();
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, DiskOtpEntry>;
    const now = Date.now();
    const map = new Map<string, DiskOtpEntry>();
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v.expiresAt > now) map.set(k, v);
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveDiskOtpStore(projectRoot: string, store: Map<string, DiskOtpEntry>): void {
  try {
    const filePath = getCacheFilePath(projectRoot);
    const now = Date.now();
    const obj: Record<string, DiskOtpEntry> = {};
    for (const [k, v] of store.entries()) {
      if (v.expiresAt > now) obj[k] = v;
    }
    fs.writeFileSync(filePath, JSON.stringify(obj), 'utf-8');
  } catch {
    // Best-effort cache write in local dev
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEmailHtml(code: string, type: string, fullName?: string): string {
  const isRecovery = type === 'recovery';
  const heading = isRecovery ? 'Password Reset Code' : 'Verify Your Email';
  const subtext = isRecovery
    ? 'We received a request to reset your AutoGroup account password.'
    : 'Welcome to AutoGroup! Please use the 6-digit code below to verify your email address.';
  const greetingName = fullName ? `<strong>${escapeHtml(fullName)}</strong>,` : 'there,';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 16px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
        <div style="background-color: #2563eb; padding: 24px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">AutoGroup</h1>
          <p style="color: #bfdbfe; margin: 4px 0 0 0; font-size: 13px;">India's Group Car Buying Platform</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">${heading}</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.5; margin: 0 0 24px 0;">
            Hello ${greetingName}<br/>
            ${subtext}
          </p>
          <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; color: #1e40af; margin-bottom: 6px; letter-spacing: 0.5px;">Your 6-Digit Verification Code</div>
            <div style="font-size: 34px; font-weight: 700; color: #1d4ed8; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace;">${code}</div>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
            This verification code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
          </p>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            If you did not request this verification, you can safely ignore this email.
          </p>
        </div>
      </div>
    </div>
  `;
}

function maskEmail(email: string): string {
  return email ? email.replace(/(?<=.{3}).(?=.*@)/g, '*') : '';
}

function pruneUsedResetTokens(): void {
  const now = Date.now();
  for (const [jti, exp] of usedResetTokens.entries()) {
    if (exp <= now) usedResetTokens.delete(jti);
  }
}

export async function handleSmtpStatus(
  req: NodeHttpRequest,
  res: ServerResponse,
  projectRoot: string = process.cwd()
): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const config = getServerConfig(projectRoot);
  const configured = Boolean(config.smtpEmail && config.smtpPassword);
  sendJson(res, 200, {
    configured,
    email: maskEmail(config.smtpEmail),
    server: config.smtpServer,
    port: config.smtpPort,
  });
}

export async function handleSendOtp(
  req: NodeHttpRequest,
  res: ServerResponse,
  projectRoot: string = process.cwd()
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const type = String(body.type || 'signup').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();

    if (!email || !email.includes('@')) {
      sendJson(res, 400, { success: false, error: 'A valid email address is required.' });
      return;
    }

    const config = getServerConfig(projectRoot);
    const hasSmtp = Boolean(config.smtpEmail && config.smtpPassword);

    if (config.isHostedServerless && (!hasSmtp || !config.otpSecret)) {
      sendJson(res, 503, {
        success: false,
        error: 'Email OTP service is not configured on the server. Set SMTP_EMAIL and SMTP_PASSWORD in Vercel Environment Variables.',
      });
      return;
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const exp = Date.now() + OTP_TTL_MS;

    const challengePayload: OtpChallengePayload = {
      kind: 'otp_challenge',
      email,
      type,
      code,
      attempts: 0,
      exp,
    };
    const challengeToken = sealToken(challengePayload, config.otpSecret);

    if (!config.isHostedServerless) {
      const otpStore = loadDiskOtpStore(projectRoot);
      otpStore.set(email, { code, expiresAt: exp, attempts: 0 });
      saveDiskOtpStore(projectRoot, otpStore);
    }

    const secure = isSecureRequest(req);
    setResponseCookies(res, [buildCookie(OTP_CHALLENGE_COOKIE, challengeToken, 600, secure)]);

    if (hasSmtp) {
      const port = parseInt(config.smtpPort, 10) || 465;
      const transporter = nodemailer.createTransport({
        host: config.smtpServer,
        port,
        secure: port === 465,
        auth: {
          user: config.smtpEmail,
          pass: config.smtpPassword,
        },
      });

      const mailSubject =
        type === 'recovery'
          ? `${code} is your AutoGroup password reset code`
          : `${code} is your AutoGroup verification code`;

      try {
        await transporter.sendMail({
          from: `"AutoGroup Verification" <${config.smtpEmail}>`,
          to: email,
          subject: mailSubject,
          text: `Your AutoGroup verification code is: ${code}. Valid for 10 minutes.`,
          html: renderEmailHtml(code, type, fullName),
        });

        sendJson(res, 200, {
          success: true,
          message: `Verification code sent to ${email}`,
          channel: 'smtp',
          senderEmail: maskEmail(config.smtpEmail),
          challengeToken,
        });
        return;
      } catch (smtpErr: unknown) {
        const errMsg = smtpErr instanceof Error ? smtpErr.message : 'SMTP delivery failed';
        console.error(`[SMTP Error] Delivery to ${email} failed:`, errMsg);

        if (config.isHostedServerless) {
          sendJson(res, 502, {
            success: false,
            error: `Failed to send verification email (${errMsg}). Verify SMTP credentials in Vercel Environment Variables.`,
          });
          return;
        }

        sendJson(res, 200, {
          success: true,
          message: `SMTP delivery failed (${errMsg}). Dev OTP fallback active.`,
          devOtp: code,
          isDevMode: true,
          reason: 'smtp_error',
          smtpError: errMsg,
          challengeToken,
        });
        return;
      }
    }

    console.log(`[SMTP Dev Mode] OTP for ${email} is: ${code}`);
    sendJson(res, 200, {
      success: true,
      message: 'SMTP credentials not configured in .env.local. Dev OTP code active.',
      devOtp: code,
      isDevMode: true,
      reason: 'smtp_not_configured',
      challengeToken,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    sendJson(res, 500, { success: false, error: msg });
  }
}

export async function handleVerifyOtp(
  req: NodeHttpRequest,
  res: ServerResponse,
  projectRoot: string = process.cwd()
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const submittedCode = String(body.code || '').trim();
    const submittedType = String(body.type || '').trim().toLowerCase();
    const cookies = parseCookies(req);
    const rawChallenge = String(body.challengeToken || cookies[OTP_CHALLENGE_COOKIE] || '').trim();

    if (!email || !submittedCode) {
      sendJson(res, 400, { success: false, error: 'Email and 6-digit code are required.' });
      return;
    }

    const config = getServerConfig(projectRoot);
    const secure = isSecureRequest(req);

    // Primary path: stateless encrypted token (works across Vercel serverless containers & cookies)
    if (rawChallenge && config.otpSecret) {
      const challenge = unsealToken<OtpChallengePayload>(rawChallenge, config.otpSecret);
      if (!challenge || challenge.kind !== 'otp_challenge' || challenge.email !== email) {
        sendJson(res, 400, {
          success: false,
          error: 'No matching verification challenge was found. Please click "Resend Code".',
        });
        return;
      }

      if (submittedType && challenge.type !== submittedType) {
        sendJson(res, 400, {
          success: false,
          error: 'Verification code type mismatch. Please request a new code.',
        });
        return;
      }

      if (Date.now() > challenge.exp) {
        setResponseCookies(res, [buildCookie(OTP_CHALLENGE_COOKIE, '', 0, secure)]);
        sendJson(res, 400, {
          success: false,
          error: 'Verification code has expired. Please click "Resend Code".',
        });
        return;
      }

      if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
        setResponseCookies(res, [buildCookie(OTP_CHALLENGE_COOKIE, '', 0, secure)]);
        sendJson(res, 429, {
          success: false,
          error: 'Too many incorrect attempts. Please request a new verification code.',
        });
        return;
      }

      if (!safeCodeEquals(challenge.code, submittedCode)) {
        const nextAttempts = challenge.attempts + 1;
        if (nextAttempts >= MAX_OTP_ATTEMPTS) {
          setResponseCookies(res, [buildCookie(OTP_CHALLENGE_COOKIE, '', 0, secure)]);
          sendJson(res, 429, {
            success: false,
            error: 'Too many incorrect attempts. Please request a new verification code.',
          });
          return;
        }

        const nextToken = sealToken({ ...challenge, attempts: nextAttempts }, config.otpSecret);
        setResponseCookies(res, [buildCookie(OTP_CHALLENGE_COOKIE, nextToken, 600, secure)]);
        sendJson(res, 400, {
          success: false,
          error: 'Incorrect verification code. Please check your email and try again.',
          nextChallengeToken: nextToken,
        });
        return;
      }

      const verifiedPayload: OtpVerifiedPayload = {
        kind: 'otp_verified',
        email,
        type: challenge.type,
        jti: crypto.randomUUID(),
        exp: Date.now() + OTP_TTL_MS,
      };
      const verificationToken = sealToken(verifiedPayload, config.otpSecret);

      setResponseCookies(res, [
        buildCookie(OTP_CHALLENGE_COOKIE, '', 0, secure),
        buildCookie(OTP_VERIFIED_COOKIE, verificationToken, 600, secure),
      ]);
      sendJson(res, 200, {
        success: true,
        message: 'Code verified successfully.',
        verificationToken,
      });
      return;
    }

    // Local disk fallback only for non-hosted dev callers that didn't supply challengeToken/cookie
    if (!config.isHostedServerless) {
      const otpStore = loadDiskOtpStore(projectRoot);
      const entry = otpStore.get(email);
      if (!entry) {
        sendJson(res, 400, {
          success: false,
          error: 'No verification code was requested or it has expired. Please click "Resend Code".',
        });
        return;
      }
      if (Date.now() > entry.expiresAt) {
        otpStore.delete(email);
        saveDiskOtpStore(projectRoot, otpStore);
        sendJson(res, 400, {
          success: false,
          error: 'Verification code has expired. Please click "Resend Code".',
        });
        return;
      }

      entry.attempts += 1;
      if (entry.attempts > MAX_OTP_ATTEMPTS) {
        otpStore.delete(email);
        saveDiskOtpStore(projectRoot, otpStore);
        sendJson(res, 429, {
          success: false,
          error: 'Too many incorrect attempts. Please request a new verification code.',
        });
        return;
      }

      if (!safeCodeEquals(entry.code, submittedCode)) {
        otpStore.set(email, entry);
        saveDiskOtpStore(projectRoot, otpStore);
        sendJson(res, 400, {
          success: false,
          error: 'Incorrect verification code. Please check your email and try again.',
        });
        return;
      }

      otpStore.delete(email);
      saveDiskOtpStore(projectRoot, otpStore);
      const verificationToken = config.otpSecret
        ? sealToken(
            {
              kind: 'otp_verified',
              email,
              type: submittedType || 'signup',
              jti: crypto.randomUUID(),
              exp: Date.now() + OTP_TTL_MS,
            } satisfies OtpVerifiedPayload,
            config.otpSecret
          )
        : '';

      if (verificationToken) {
        setResponseCookies(res, [buildCookie(OTP_VERIFIED_COOKIE, verificationToken, 600, secure)]);
      }
      sendJson(res, 200, {
        success: true,
        message: 'Code verified successfully.',
        verificationToken,
      });
      return;
    }

    sendJson(res, 400, {
      success: false,
      error: 'Verification session missing or expired. Please click "Resend Code".',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    sendJson(res, 500, { success: false, error: msg });
  }
}

export async function handleResetPassword(
  req: NodeHttpRequest,
  res: ServerResponse,
  projectRoot: string = process.cwd()
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const newPassword = String(body.newPassword || '');
    const cookies = parseCookies(req);
    const rawVerification = String(body.verificationToken || cookies[OTP_VERIFIED_COOKIE] || '').trim();

    if (!email || !email.includes('@')) {
      sendJson(res, 400, { success: false, error: 'A valid email address is required.' });
      return;
    }
    if (newPassword.length < 8) {
      sendJson(res, 400, { success: false, error: 'Password must be at least 8 characters in length.' });
      return;
    }

    const config = getServerConfig(projectRoot);
    if (!config.otpSecret || !rawVerification) {
      sendJson(res, 401, {
        success: false,
        error: 'Recovery OTP verification has expired or is missing. Please verify your code again.',
      });
      return;
    }

    const verified = unsealToken<OtpVerifiedPayload>(rawVerification, config.otpSecret);
    pruneUsedResetTokens();
    if (
      !verified ||
      verified.kind !== 'otp_verified' ||
      verified.type !== 'recovery' ||
      verified.email !== email ||
      Date.now() > verified.exp ||
      usedResetTokens.has(verified.jti)
    ) {
      sendJson(res, 401, {
        success: false,
        error: 'Recovery verification token is invalid or expired. Please request a new recovery code.',
      });
      return;
    }

    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      sendJson(res, 503, {
        success: false,
        error: 'Server password reset is not configured (missing SUPABASE_SERVICE_ROLE_KEY). Add it to Vercel Environment Variables.',
      });
      return;
    }

    const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    let userId = profileRow?.id as string | undefined;
    if (!userId) {
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
      });
      if (!linkErr && linkData?.user?.id) {
        userId = linkData.user.id;
      }
    }

    if (!userId) {
      sendJson(res, 404, { success: false, error: 'No account found for this email address.' });
      return;
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateErr) {
      sendJson(res, 400, { success: false, error: updateErr.message || 'Failed to update password.' });
      return;
    }

    usedResetTokens.set(verified.jti, verified.exp);
    const secure = isSecureRequest(req);
    setResponseCookies(res, [
      buildCookie(OTP_VERIFIED_COOKIE, '', 0, secure),
      buildCookie(OTP_CHALLENGE_COOKIE, '', 0, secure),
    ]);

    sendJson(res, 200, { success: true, message: 'Password updated successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unable to reset password.';
    sendJson(res, 500, { success: false, error: msg });
  }
}
