import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import {
  handleSmtpStatus,
  handleSendOtp,
  handleVerifyOtp,
  handleResetPassword,
} from '../../api/_lib/otpService.js';

/**
 * Vite dev/preview middleware mounting the shared /api/auth/* OTP & password-reset handlers.
 * In Vercel production builds, the matching handlers in /api/auth/*.ts execute the same logic.
 */
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

    if (url === '/api/auth/smtp-status') {
      await handleSmtpStatus(req, res, projectRoot);
      return;
    }

    if (url === '/api/auth/send-otp') {
      await handleSendOtp(req, res, projectRoot);
      return;
    }

    if (url === '/api/auth/verify-otp') {
      await handleVerifyOtp(req, res, projectRoot);
      return;
    }

    if (url === '/api/auth/reset-password') {
      await handleResetPassword(req, res, projectRoot);
      return;
    }

    next();
  });
}
