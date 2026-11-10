import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleSendOtp } from '../_lib/otpService.js';

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  await handleSendOtp(req, res);
}
