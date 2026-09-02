import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware, sendError, sendSuccess } from '../lib/shared';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyMiddleware(req, res)) return;

  if (req.method === 'GET') {
    return sendSuccess(res, { hasKey: !!process.env.API_FOOTBALL_KEY?.trim() });
  }

  if (req.method === 'POST') {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
      return sendError(res, 400, 'Chave inválida.');
    }
    process.env.API_FOOTBALL_KEY = apiKey.trim();
    return sendSuccess(res, { success: true });
  }

  return sendError(res, 405, 'Method not allowed');
}
