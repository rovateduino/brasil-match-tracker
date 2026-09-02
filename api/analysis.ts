import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { applyMiddleware, sendError, sendSuccess } from './lib/shared';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `Você é um analista de apostas esportivas especializado em futebol brasileiro.
Sua tarefa é analisar partidas e gerar palpites para diversos mercados de apostas.

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "prediction": { "home": number, "draw": number, "away": number },
  "markets": {
    "winner": { "home": number, "draw": number, "away": number },
    "double_chance": { "home_or_draw": number, "home_or_away": number, "draw_or_away": number },
    "both_to_score": { "yes": number, "no": number },
    "over_under": {
      "over_0_5": number, "over_1_5": number, "over_2_5": number, "over_3_5": number,
      "under_0_5": number, "under_1_5": number, "under_2_5": number, "under_3_5": number
    },
    "asian_handicap": {
      "home_0": number, "away_0": number,
      "home_neg_0_5": number, "away_neg_0_5": number,
      "home_neg_1": number, "away_neg_1": number
    },
    "european_handicap": { "home": number, "draw": number, "away": number },
    "correct_score": {
      "0_0": number, "1_0": number, "0_1": number, "1_1": number,
      "2_0": number, "0_2": number, "2_1": number, "1_2": number,
      "2_2": number, "3_0": number, "0_3": number, "other": number
    },
    "goalscorer": {
      "home": [{ "name": string, "probability": number }],
      "away": [{ "name": string, "probability": number }]
    },
    "corners": {
      "total_over_9_5": number, "total_over_10_5": number,
      "total_under_9_5": number, "total_under_10_5": number,
      "home_over_4_5": number, "home_under_4_5": number,
      "away_over_4_5": number, "away_under_4_5": number
    },
    "cards": {
      "total_over_4_5": number, "total_over_5_5": number,
      "total_under_4_5": number, "total_under_5_5": number
    },
    "fouls": {
      "total_over_20_5": number, "total_under_20_5": number,
      "total_over_24_5": number, "total_under_24_5": number
    }
  },
  "analysis": {
    "summary": string,
    "key_factors": [string],
    "recommendation": string
  }
}

Valores de probabilidade devem ser números inteiros entre 0 e 100.`;

function clampPercent(value: any, fallback = 50): number {
  const n = Math.round(Number(value));
  if (isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function extractJson(content: string): any {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Resposta da IA não contém JSON válido.');
  return JSON.parse(text.slice(start, end + 1));
}

const DEFAULT_MARKETS = {
  winner: { home: 33, draw: 33, away: 34 },
  double_chance: { home_or_draw: 66, home_or_away: 67, draw_or_away: 67 },
  both_to_score: { yes: 50, no: 50 },
  over_under: { over_0_5: 90, over_1_5: 70, over_2_5: 50, over_3_5: 30, under_0_5: 10, under_1_5: 30, under_2_5: 50, under_3_5: 70 },
  asian_handicap: { home_0: 33, away_0: 34, home_neg_0_5: 33, away_neg_0_5: 34, home_neg_1: 25, away_neg_1: 25 },
  european_handicap: { home: 33, draw: 33, away: 34 },
  correct_score: { '0_0': 10, '1_0': 15, '0_1': 12, '1_1': 18, '2_0': 10, '0_2': 8, '2_1': 10, '1_2': 8, '2_2': 5, '3_0': 5, '0_3': 3, other: 6 },
  goalscorer: { home: [], away: [] },
  corners: { total_over_9_5: 50, total_over_10_5: 40, total_under_9_5: 50, total_under_10_5: 60, home_over_4_5: 50, home_under_4_5: 50, away_over_4_5: 50, away_under_4_5: 50 },
  cards: { total_over_4_5: 50, total_over_5_5: 40, total_under_4_5: 50, total_under_5_5: 60 },
  fouls: { total_over_20_5: 50, total_under_20_5: 50, total_over_24_5: 40, total_under_24_5: 60 },
};

function mergeMarkets(defaults: any, provided: any): any {
  if (!provided || typeof provided !== 'object') return defaults;
  const result: any = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (Array.isArray(value)) {
      result[key] = (Array.isArray(provided[key]) ? provided[key] : value).slice(0, 3).map((e: any) => ({
        name: String(e?.name || '').trim().slice(0, 40),
        probability: clampPercent(e?.probability, 0),
      }));
    } else if (typeof value === 'object' && value !== null) {
      result[key] = mergeMarkets(value, provided[key]);
    } else if (typeof value === 'number') {
      result[key] = clampPercent(provided[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeAnalysis(raw: any, match: any) {
  return {
    matchId: match.id,
    teams: { home: match.homeTeam, away: match.awayTeam, date: match.date },
    prediction: {
      home: clampPercent(raw?.prediction?.home, 33),
      draw: clampPercent(raw?.prediction?.draw, 33),
      away: clampPercent(raw?.prediction?.away, 34),
    },
    markets: mergeMarkets(DEFAULT_MARKETS, raw?.markets),
    analysis: {
      summary: String(raw?.analysis?.summary || '').trim().slice(0, 200) || 'Análise baseada em dados estatísticos.',
      key_factors: (Array.isArray(raw?.analysis?.key_factors) ? raw.analysis.key_factors : []).filter((f: any) => typeof f === 'string').slice(0, 5),
      recommendation: String(raw?.analysis?.recommendation || '').trim().slice(0, 100) || 'Considere o favorito para o confronto.',
    },
  };
}

function createFallback(match: any, error?: string) {
  return {
    matchId: match.id,
    teams: { home: match.homeTeam, away: match.awayTeam, date: match.date },
    prediction: { home: 33, draw: 33, away: 34 },
    markets: mergeMarkets(DEFAULT_MARKETS, undefined),
    analysis: { summary: 'Análise baseada em dados estatísticos.', key_factors: [], recommendation: 'Considere o favorito para o confronto.' },
    error,
  };
}

async function callGroq(match: any): Promise<any> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error('GROQ_API_KEY não configurada');

  const userPrompt = `Partida: ${match.homeTeam} vs ${match.awayTeam}\nData: ${match.date}\nCompetição: ${match.league}\n\nGere os palpites em JSON.`;

  const response = await axios.post(GROQ_URL, {
    model: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 2500,
  }, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('GROQ retornou resposta vazia.');
  return extractJson(content);
}

async function callGemini(match: any): Promise<any> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY não configurada');

  const userPrompt = `Partida: ${match.homeTeam} vs ${match.awayTeam}\nData: ${match.date}\nCompetição: ${match.league}\n\nGere os palpites em JSON.`;

  const response = await axios.post(`${GEMINI_BASE}/${process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite'}:generateContent`, {
    contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  }, {
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    timeout: 60000,
  });

  const candidate = response.data?.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text || candidate?.content?.[0]?.text || candidate?.content?.[0]?.parts?.[0]?.text;
  if (!content) throw new Error('Gemini retornou resposta vazia.');
  return extractJson(content);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyMiddleware(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const { matches } = req.body;
  if (!Array.isArray(matches) || matches.length === 0) {
    return sendError(res, 400, 'Envie ao menos uma partida para análise.');
  }
  if (matches.length > 10) {
    return sendError(res, 400, 'Máximo de 10 partidas por requisição.');
  }

  const results = [];
  for (const match of matches) {
    let result;
    try {
      result = sanitizeAnalysis(await callGroq(match), match);
    } catch (groqError: any) {
      try {
        result = sanitizeAnalysis(await callGemini(match), match);
      } catch (geminiError: any) {
        result = createFallback(match, `GROQ: ${groqError.message} | Gemini: ${geminiError.message}`);
      }
    }
    results.push(result);
  }

  sendSuccess(res, results);
}
