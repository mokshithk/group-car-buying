import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleSmtpStatus } from '../../src/server/otpService';

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  await handleSmtpStatus(req, res);
}
