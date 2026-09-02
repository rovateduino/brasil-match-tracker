import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { z } from 'zod';
import { setApiKey, hasApiKey, fetchMatches, getCompetitions } from './proxy';
import { analyzeMatches } from './ai';
import { loadDataset } from './dataset';
import { logger } from './logger';
import { trackLatency } from './metrics';
import { updateEnvFile } from './envFile';
import './validateEnv';

dotenv.config();

interface RequestWithId extends Request {
  id?: string;
}

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://seu-dominio.com']
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

app.use((req: RequestWithId, _res: Response, next: NextFunction) => {
  req.id = crypto.randomUUID();
  next();
});

app.use((req: RequestWithId, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip, requestId: req.id });
  next();
});

app.use((req: RequestWithId, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    trackLatency(req.path, duration);
  });
  next();
});

// Rate limit para evitar abusos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite por IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const apiKeySchema = z.object({
  apiKey: z.string().min(10, 'Chave muito curta').max(100),
});

const aiSettingsSchema = z.object({
  groqKey: z.string().min(1).optional(),
  groqModel: z.string().min(1).optional(),
  geminiKey: z.string().min(1).optional(),
  geminiModel: z.string().min(1).optional(),
});

// Rota de status da API key
app.get('/api/settings/api-key/status', (req, res) => {
  res.json({ hasKey: hasApiKey() });
});

// Rota para salvar API key
app.post('/api/settings/api-key', (req, res) => {
  const result = apiKeySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: result.error.issues,
    });
  }
  setApiKey(result.data.apiKey);
  logger.info('API key updated via settings', { requestId: (req as RequestWithId).id });
  res.json({ success: true });
});

// Rota de competições disponíveis
app.get('/api/competitions', (req, res) => {
  const comps = getCompetitions();
  res.json(comps);
});

// Rota de partidas
app.get('/api/matches', async (req, res) => {
  const leaguesParam = req.query.leagues;
  if (!leaguesParam) {
    return res.status(400).json({ error: 'Informe ao menos uma competição (leagues).' });
  }
  const raw = Array.isArray(leaguesParam) ? leaguesParam : [leaguesParam];
  const ids = raw
    .flatMap((value) => String(value).split(','))
    .map((value) => Number(value.trim()))
    .filter((n) => !isNaN(n));

  if (ids.length === 0) {
    return res.status(400).json({ error: 'IDs de liga inválidos.' });
  }

  try {
    const matches = await fetchMatches(ids);
    res.json(matches);
  } catch (error: any) {
    logger.error('Error fetching matches', { error: error.message });
    res.status(500).json({ error: error.message || 'Erro ao buscar partidas.' });
  }
});

// Rota de status das chaves de IA (sem expor os valores)
app.get('/api/settings/ai', (req, res) => {
  res.json({
    groq: {
      hasKey: !!process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    },
    gemini: {
      hasKey: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash',
    },
  });
});

// Rota para salvar as chaves de IA (grava no arquivo .env)
app.post('/api/settings/ai', (req, res) => {
  const result = aiSettingsSchema.safeParse(req.body || {});
  if (!result.success) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: result.error.issues,
    });
  }

  const { groqKey, groqModel, geminiKey, geminiModel } = result.data;
  const updates: Record<string, string> = {};

  if (groqKey) updates.GROQ_API_KEY = groqKey.trim();
  if (groqModel) updates.GROQ_MODEL = groqModel.trim();
  if (geminiKey) updates.GEMINI_API_KEY = geminiKey.trim();
  if (geminiModel) updates.GEMINI_MODEL = geminiModel.trim();

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nenhuma configuração para salvar.' });
  }

  try {
    updateEnvFile(updates);
    logger.info('AI settings updated in .env', { keys: Object.keys(updates), requestId: (req as RequestWithId).id });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Erro ao salvar configurações de IA', { error: error.message, requestId: (req as RequestWithId).id });
    res.status(500).json({ error: error.message || 'Erro ao salvar configurações.' });
  }
});

// Rota de análise de IA para partidas
app.post('/api/analysis', async (req, res) => {
  const { matches } = req.body;
  if (!Array.isArray(matches) || matches.length === 0) {
    return res.status(400).json({ error: 'Envie ao menos uma partida para análise.' });
  }
  if (matches.length > 10) {
    return res.status(400).json({ error: 'Máximo de 10 partidas por requisição.' });
  }
  try {
    const results = await analyzeMatches(matches);
    res.json(results);
  } catch (error: any) {
    logger.error('Error analyzing matches', { error: error.message });
    res.status(500).json({ error: error.message || 'Erro ao gerar análise.' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  if (process.env.USE_DATASET !== 'false') {
    loadDataset();
  }
  if (hasApiKey()) {
    logger.info('API key already configured via environment');
  } else {
    logger.warn('No API key set. Please configure it via Settings page.');
  }
});