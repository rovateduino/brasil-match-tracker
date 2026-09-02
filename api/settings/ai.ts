import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware, sendError, sendSuccess } from '../lib/shared';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyMiddleware(req, res)) return;

  if (req.method === 'GET') {
    return sendSuccess(res, {
      groq: {
        hasKey: !!process.env.GROQ_API_KEY?.trim(),
        model: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b',
      },
      gemini: {
        hasKey: !!process.env.GEMINI_API_KEY?.trim(),
        model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
      },
    });
  }

  if (req.method === 'POST') {
    const { groqKey, groqModel, geminiKey, geminiModel } = req.body || {};
    const updates: Record<string, string> = {};

    if (groqKey && typeof groqKey === 'string') updates.GROQ_API_KEY = groqKey.trim();
    if (groqModel && typeof groqModel === 'string') updates.GROQ_MODEL = groqModel.trim();
    if (geminiKey && typeof geminiKey === 'string') updates.GEMINI_API_KEY = geminiKey.trim();
    if (geminiModel && typeof geminiModel === 'string') updates.GEMINI_MODEL = geminiModel.trim();

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, 'Nenhuma configuração para salvar.');
    }

    for (const [key, value] of Object.entries(updates)) {
      process.env[key] = value;
    }

    return sendSuccess(res, { success: true });
  }

  return sendError(res, 405, 'Method not allowed');
}
