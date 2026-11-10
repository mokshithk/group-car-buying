import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleSmtpStatus } from '../_lib/otpService.js';

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  await handleSmtpStatus(req, res);
}
