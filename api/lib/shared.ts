import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export function applyMiddleware(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false;
  }

  (req as any).id = crypto.randomUUID();
  return true;
}

export function sendError(res: VercelResponse, status: number, message: string) {
  res.status(status).json({ error: message });
}

export function sendSuccess(res: VercelResponse, data: any) {
  res.status(200).json(data);
}
