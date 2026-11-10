import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

function getCacheFilePath(projectRoot: string): string {
  const cacheDir = path.resolve(projectRoot, 'node_modules', '.cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return path.join(cacheDir, 'autogroup-otp-store.json');
}

function loadOtpStore(projectRoot: string): Map<string, OtpEntry> {
  try {
    const filePath = getCacheFilePath(projectRoot);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, OtpEntry>;
      const now = Date.now();
      const map = new Map<string, OtpEntry>();
      for (const [k, v] of Object.entries(parsed)) {
        if (v && v.expiresAt > now) {
          map.set(k, v);
        }
      }
      return map;
    }
  } catch {
    // Ignore malformed cache
  }
  return new Map<string, OtpEntry>();
}

function saveOtpStore(projectRoot: string, store: Map<string, OtpEntry>): void {
  try {
    const filePath = getCacheFilePath(projectRoot);
    const obj: Record<string, OtpEntry> = {};
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (v.expiresAt > now) {
        obj[k] = v;
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(obj), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}

function getEnvConfig(projectRoot: string) {
  const envFiles = ['.env.local', '.env'];
  const env: Record<string, string> = {};

  for (const file of envFiles) {
    const fullPath = path.resolve(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          // Only fill if not already set to a non-empty value
          if (!env[key] && val) {
            env[key] = val;
          }
        }
      });
    }
  }

  const smtpServer = env.SMTP_SERVER || process.env.SMTP_SERVER || 'smtp.gmail.com';
  const rawPassword = env.SMTP_PASSWORD || process.env.SMTP_PASSWORD || '';
  // Gmail App Passwords are often pasted with spaces like "abcd efgh ijkl mnop"
  const smtpPassword = smtpServer.toLowerCase().includes('gmail')
    ? rawPassword.replace(/\s+/g, '')
    : rawPassword;

  return {
    smtpEmail: (env.SMTP_EMAIL || process.env.SMTP_EMAIL || '').trim(),
    smtpPassword,
    smtpServer: smtpServer.trim(),
    smtpPort: (env.SMTP_PORT || process.env.SMTP_PORT || '465').trim(),
  };
}

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function renderEmailHtml(code: string, type: string, fullName?: string): string {
  const isRecovery = type === 'recovery';
  const heading = isRecovery ? 'Password Reset Code' : 'Verify Your Email';
  const subtext = isRecovery
    ? 'We received a request to reset your AutoGroup account password.'
    : 'Welcome to AutoGroup! Please use the 6-digit code below to verify your email address.';

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
            Hello ${fullName ? `<strong>${fullName}</strong>,` : 'there,'}<br/>
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

export function smtpEmailPlugin(): Plugin {
  return {
    name: 'smtp-email-portal',
    configureServer(server: ViteDevServer) {
      setupMiddleware(server);
    },
    configurePreviewServer(server: PreviewServer) {
      setupMiddleware(server);
    },
  };
}

function setupMiddleware(server: ViteDevServer | PreviewServer) {
  const projectRoot = process.cwd();

  server.middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0];

    // Endpoint 1: Check SMTP configuration status
    if (url === '/api/auth/smtp-status' && req.method === 'GET') {
      const config = getEnvConfig(projectRoot);
      const isConfigured = Boolean(config.smtpEmail && config.smtpPassword);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          configured: isConfigured,
          email: config.smtpEmail ? config.smtpEmail.replace(/(?<=.{3}).(?=.*@)/g, '*') : '',
          server: config.smtpServer,
          port: config.smtpPort,
        })
      );
      return;
    }

    // Endpoint 2: Send OTP via configured SMTP or local Dev Mode
    if (url === '/api/auth/send-otp' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const email = (body.email || '').trim().toLowerCase();
        const type = body.type || 'signup';
        const fullName = body.fullName || '';

        if (!email || !email.includes('@')) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'A valid email address is required.' }));
          return;
        }

        // Generate 6-digit numeric OTP code and persist to disk cache
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        const otpStore = loadOtpStore(projectRoot);

        otpStore.set(email, {
          code,
          expiresAt,
          attempts: 0,
        });
        saveOtpStore(projectRoot, otpStore);

        const config = getEnvConfig(projectRoot);
        const hasSmtpCredentials = Boolean(config.smtpEmail && config.smtpPassword);

        if (hasSmtpCredentials) {
          const port = parseInt(config.smtpPort, 10) || 465;
          const secure = port === 465;

          const transporter = nodemailer.createTransport({
            host: config.smtpServer,
            port,
            secure,
            auth: {
              user: config.smtpEmail,
              pass: config.smtpPassword,
            },
          });

          const mailSubject = type === 'recovery'
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

            console.log(`[SMTP] Successfully sent OTP code to ${email} via ${config.smtpServer}:${port}`);

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                message: `Verification code sent to ${email}`,
                channel: 'smtp',
                senderEmail: config.smtpEmail.replace(/(?<=.{3}).(?=.*@)/g, '*'),
              })
            );
            return;
          } catch (smtpErr: any) {
            console.error(`[SMTP Error] Delivery to ${email} failed:`, smtpErr?.message);
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                message: `SMTP delivery failed (${smtpErr?.message}). Dev OTP fallback active.`,
                devOtp: code,
                isDevMode: true,
                reason: 'smtp_error',
                smtpError: smtpErr?.message,
              })
            );
            return;
          }
        } else {
          console.log(`[SMTP Dev Mode] SMTP_EMAIL or SMTP_PASSWORD not set in .env/.env.local.`);
          console.log(`[SMTP Dev Mode] OTP for ${email} is: ${code}`);

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: true,
              message: 'SMTP credentials not configured in .env.local. Dev OTP code active.',
              devOtp: code,
              isDevMode: true,
              reason: 'smtp_not_configured',
            })
          );
          return;
        }
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err?.message || 'Internal error' }));
        return;
      }
    }

    // Endpoint 3: Verify OTP code
    if (url === '/api/auth/verify-otp' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const email = (body.email || '').trim().toLowerCase();
        const code = (body.code || '').trim();

        if (!email || !code) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Email and 6-digit code are required.' }));
          return;
        }

        const otpStore = loadOtpStore(projectRoot);
        const entry = otpStore.get(email);
        if (!entry) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'No verification code was requested or it has expired. Please click "Resend Code".' }));
          return;
        }

        if (Date.now() > entry.expiresAt) {
          otpStore.delete(email);
          saveOtpStore(projectRoot, otpStore);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Verification code has expired. Please click "Resend Code".' }));
          return;
        }

        entry.attempts += 1;
        if (entry.attempts > 5) {
          otpStore.delete(email);
          saveOtpStore(projectRoot, otpStore);
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Too many incorrect attempts. Please request a new verification code.' }));
          return;
        }

        if (entry.code !== code) {
          otpStore.set(email, entry);
          saveOtpStore(projectRoot, otpStore);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Incorrect verification code. Please check your email and try again.' }));
          return;
        }

        // Successfully verified
        otpStore.delete(email);
        saveOtpStore(projectRoot, otpStore);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'Code verified successfully.' }));
        return;
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err?.message || 'Internal error' }));
        return;
      }
    }

    next();
  });
}
