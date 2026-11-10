import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleSendOtp } from '../../src/server/otpService';

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  await handleSendOtp(req, res);
}
