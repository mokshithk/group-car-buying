import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleResetPassword } from '../../src/server/otpService';

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  await handleResetPassword(req, res);
}
