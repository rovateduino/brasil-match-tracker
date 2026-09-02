import axios from 'axios';
import { getTeamDetailedStats, getHeadToHeadMatches, getStandingsTable } from './dataset';
import { cache } from './cache';
import { logger } from './logger';

const GROQ_URL = process.env.GROQ_URL?.trim() || 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface PredictionMarkets {
  home: number;
  draw: number;
  away: number;
}

export interface AnalysisMarkets {
  winner: PredictionMarkets;
  double_chance: { home_or_draw: number; home_or_away: number; draw_or_away: number };
  both_to_score: { yes: number; no: number };
  over_under: {
    over_0_5: number; over_1_5: number; over_2_5: number; over_3_5: number;
    under_0_5: number; under_1_5: number; under_2_5: number; under_3_5: number;
  };
  asian_handicap: {
    home_0: number; away_0: number;
    home_neg_0_5: number; away_neg_0_5: number;
    home_neg_1: number; away_neg_1: number;
  };
  european_handicap: PredictionMarkets;
  correct_score: {
    '0_0': number; '1_0': number; '0_1': number; '1_1': number;
    '2_0': number; '0_2': number; '2_1': number; '1_2': number;
    '2_2': number; '3_0': number; '0_3': number; other: number;
  };
  goalscorer: {
    home: Array<{ name: string; probability: number }>;
    away: Array<{ name: string; probability: number }>;
  };
  corners: {
    total_over_9_5: number; total_over_10_5: number;
    total_under_9_5: number; total_under_10_5: number;
    home_over_4_5: number; home_under_4_5: number;
    away_over_4_5: number; away_under_4_5: number;
  };
  cards: {
    total_over_4_5: number; total_over_5_5: number;
    total_under_4_5: number; total_under_5_5: number;
  };
  fouls: {
    total_over_20_5: number; total_under_20_5: number;
    total_over_24_5: number; total_under_24_5: number;
  };
}

export interface AnalysisSummary {
  summary: string;
  key_factors: string[];
  recommendation: string;
}

export interface MatchAnalysis {
  matchId: number;
  teams: { home: string; away: string; date: string };
  prediction: PredictionMarkets;
  markets: AnalysisMarkets;
  analysis: AnalysisSummary;
  error?: string;
}

const SYSTEM_PROMPT = `Você é um analista de apostas esportivas especializado em futebol brasileiro.
Sua tarefa é analisar partidas e gerar palpites para diversos mercados de apostas.

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "prediction": {
    "home": number,        // Probabilidade vitória mandante (0-100)
    "draw": number,        // Probabilidade empate (0-100)
    "away": number         // Probabilidade vitória visitante (0-100)
  },
  "markets": {
    "winner": {
      "home": number,      // Probabilidade vitória mandante (%)
      "draw": number,      // Probabilidade empate (%)
      "away": number       // Probabilidade vitória visitante (%)
    },
    "double_chance": {
      "home_or_draw": number,   // 1X (%)
      "home_or_away": number,   // 12 (%)
      "draw_or_away": number    // X2 (%)
    },
    "both_to_score": {
      "yes": number,       // Probabilidade ambas marcarem (%)
      "no": number         // Probabilidade apenas uma ou nenhuma marcar (%)
    },
    "over_under": {
      "over_0_5": number,  // Probabilidade Over 0.5 (%)
      "over_1_5": number,  // Probabilidade Over 1.5 (%)
      "over_2_5": number,  // Probabilidade Over 2.5 (%)
      "over_3_5": number,  // Probabilidade Over 3.5 (%)
      "under_0_5": number, // Probabilidade Under 0.5 (%)
      "under_1_5": number, // Probabilidade Under 1.5 (%)
      "under_2_5": number, // Probabilidade Under 2.5 (%)
      "under_3_5": number  // Probabilidade Under 3.5 (%)
    },
    "asian_handicap": {
      "home_0": number,    // Handicap 0 (Draw No Bet) - vitória mandante (%)
      "away_0": number,    // Handicap 0 (Draw No Bet) - vitória visitante (%)
      "home_neg_0_5": number, // Home -0.5 (vitória simples) (%)
      "away_neg_0_5": number, // Away -0.5 (vitória simples) (%)
      "home_neg_1": number,   // Home -1 (vitória por 2+) (%)
      "away_neg_1": number    // Away -1 (vitória por 2+) (%)
    },
    "european_handicap": {
      "home": number,      // Vitória mandante (%)
      "draw": number,      // Empate (%)
      "away": number       // Vitória visitante (%)
    },
    "correct_score": {
      "0_0": number, "1_0": number, "0_1": number, "1_1": number,
      "2_0": number, "0_2": number, "2_1": number, "1_2": number,
      "2_2": number, "3_0": number, "0_3": number, "other": number
    },
    "goalscorer": {
      "home": [ { "name": string, "probability": number } ],  // Até 3 jogadores do mandante
      "away": [ { "name": string, "probability": number } ]   // Até 3 jogadores do visitante
    },
    "corners": {
      "total_over_9_5": number,  "total_over_10_5": number,
      "total_under_9_5": number, "total_under_10_5": number,
      "home_over_4_5": number,   "home_under_4_5": number,
      "away_over_4_5": number,   "away_under_4_5": number
    },
    "cards": {
      "total_over_4_5": number,  "total_over_5_5": number,
      "total_under_4_5": number, "total_under_5_5": number
    },
    "fouls": {
      "total_over_20_5": number, "total_under_20_5": number,
      "total_over_24_5": number, "total_under_24_5": number
    }
  },
  "analysis": {
    "summary": string,       // Resumo da análise (máx 200 caracteres)
    "key_factors": [string], // Até 5 fatores-chave
    "recommendation": string // Recomendação principal (máx 100 caracteres)
  }
}

Use os dados fornecidos para basear suas previsões:
- Classificação atual dos times
- Últimos 5 jogos de cada time
- Histórico de confrontos diretos (H2H)
- Média de gols, escanteios, cartões e faltas

Seja realista e específico. Valores de probabilidade devem ser números inteiros entre 0 e 100.
Para mercados com poucos dados, use estimativas baseadas em médias históricas.`;

function buildContext(match: any): string {
  const lines: string[] = [];
  const home = getTeamDetailedStats(match.homeTeam, match.leagueId);
  const away = getTeamDetailedStats(match.awayTeam, match.leagueId);
  const h2h = getHeadToHeadMatches(match.homeTeam, match.awayTeam, match.leagueId);
  const standings = getStandingsTable(match.leagueId);

  const homeStanding = standings.find((s) => s.team === home?.team);
  const awayStanding = standings.find((s) => s.team === away?.team);

  lines.push(`Partida: ${match.homeTeam} (casa) vs ${match.awayTeam} (fora)`);
  lines.push(`Data: ${match.date}${match.time ? ` às ${match.time}` : ''}`);
  lines.push(`Competição: ${match.league} (id ${match.leagueId})`);
  lines.push(`Rodada/Fase: ${match.round || '-'}`);

  lines.push('');
  lines.push('## Classificação atual');
  if (homeStanding) {
    lines.push(`- ${match.homeTeam}: ${homeStanding.position}º lugar - ${homeStanding.points} pts (${homeStanding.played} jogos, ${homeStanding.wins}V ${homeStanding.draws}E ${homeStanding.losses}D, GP ${homeStanding.gf} GC ${homeStanding.ga})`);
  }
  if (awayStanding) {
    lines.push(`- ${match.awayTeam}: ${awayStanding.position}º lugar - ${awayStanding.points} pts (${awayStanding.played} jogos, ${awayStanding.wins}V ${awayStanding.draws}E ${awayStanding.losses}D, GP ${awayStanding.gf} GC ${awayStanding.ga})`);
  }
  if (!homeStanding && !awayStanding) {
    lines.push('- Dados de classificação não disponíveis.');
  }

  if (home) {
    lines.push('');
    lines.push(`## Últimos ${home.matches.length} jogos - ${match.homeTeam}`);
    for (const m of home.matches) {
      lines.push(`- ${m.date}: ${m.home ? 'casa' : 'fora'} vs ${m.opponent} ${m.goalsScored}-${m.goalsConceded} (${m.result === 'W' ? 'V' : m.result === 'D' ? 'E' : 'D'})`);
    }
    lines.push(`- Média de gols marcados: ${home.avgGoalsScored.toFixed(1)}`);
    lines.push(`- Média de gols sofridos: ${home.avgGoalsConceded.toFixed(1)}`);
    lines.push(`- Clean sheets: ${home.cleanSheets} | Ambas marcaram: ${home.bothScored} | Aproveitamento de vitórias: ${home.winRate.toFixed(0)}%`);
  } else {
    lines.push('');
    lines.push(`## Últimos jogos - ${match.homeTeam}: dados não disponíveis`);
  }

  if (away) {
    lines.push('');
    lines.push(`## Últimos ${away.matches.length} jogos - ${match.awayTeam}`);
    for (const m of away.matches) {
      lines.push(`- ${m.date}: ${m.home ? 'casa' : 'fora'} vs ${m.opponent} ${m.goalsScored}-${m.goalsConceded} (${m.result === 'W' ? 'V' : m.result === 'D' ? 'E' : 'D'})`);
    }
    lines.push(`- Média de gols marcados: ${away.avgGoalsScored.toFixed(1)}`);
    lines.push(`- Média de gols sofridos: ${away.avgGoalsConceded.toFixed(1)}`);
    lines.push(`- Clean sheets: ${away.cleanSheets} | Ambas marcaram: ${away.bothScored} | Aproveitamento de vitórias: ${away.winRate.toFixed(0)}%`);
  } else {
    lines.push('');
    lines.push(`## Últimos jogos - ${match.awayTeam}: dados não disponíveis`);
  }

  if (h2h.length) {
    lines.push('');
    lines.push('## Confrontos diretos');
    for (const m of h2h) {
      lines.push(`- ${m.date}: ${m.home} ${m.homeGoals}-${m.awayGoals} ${m.away}`);
    }
    const totalGoals = h2h.reduce((sum, m) => sum + m.homeGoals + m.awayGoals, 0);
    lines.push(`- Média de gols em confrontos: ${(totalGoals / h2h.length).toFixed(1)}`);
  } else {
    lines.push('');
    lines.push('## Confrontos diretos: dados não disponíveis');
  }

  lines.push('');
  lines.push('## Observação');
  lines.push('Estatísticas de escanteios, cartões e faltas não estão disponíveis no dataset. Estime esses mercados com base nas médias históricas da liga e no perfil dos times (estilo de jogo, rivalidade).');

  return lines.join('\n');
}

function buildUserPrompt(match: any): string {
  const context = buildContext(match);
  return `${context}\n\nGere os palpites em JSON seguindo exatamente o formato solicitado.`;
}

export function extractJson(content: string): any {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Resposta da IA não contém JSON válido.');
  }
  return JSON.parse(text.slice(start, end + 1));
}

const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];

async function callGroq(system: string, user: string): Promise<any> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error('GROQ_API_KEY não configurada');

  // Modelos disponíveis no GROQ (2026): openai/gpt-oss-20b, openai/gpt-oss-120b,
  // qwen/qwen3.6-27b, qwen/qwen3.8-27b. Os modelos llama-*/mixtral-* foram removidos.
  const primaryModel = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b';
  const candidates = [primaryModel, ...GROQ_FALLBACK_MODELS.filter((m) => m !== primaryModel)];

  let lastError: any = null;
  for (const model of candidates) {
    try {
      const response = await axios.post(
        GROQ_URL,
        {
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          max_tokens: 2500,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );
      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('GROQ retornou resposta vazia.');
      return extractJson(content);
    } catch (error: any) {
      lastError = error;
      const status = error.response?.status;
      if (status === 429 || status === 503) {
        logger.warn(`GROQ rate limit/indisponível (${status}), aguardando 2s para retry...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      if (status !== 404 && status !== 400) {
        throw error;
      }
      logger.warn(`Modelo GROQ ${model} falhou (${status}), tentando próximo.`);
    }
  }
  throw lastError;
}

async function callGemini(system: string, user: string): Promise<any> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY não configurada');

  // Modelos Gemini disponíveis para usuários novos (2026):
  // - gemini-3.5-flash-lite (recomendado, barato)
  // - gemini-3.5-flash (melhor qualidade)
  // - gemini-3.1-flash-lite (alternativa)
  // Os modelos gemini-1.5-* e gemini-2.5-* NÃO estão mais disponíveis para novos usuários.
  const primaryModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const fallbackModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  const candidates = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];

  let lastError: any = null;
  for (const model of candidates) {
    const url = `${GEMINI_BASE}/${model}:generateContent`;
    try {
      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [
                {
                  text: `${system}\n\n${user}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          timeout: 60000,
        }
      );

      const candidate = response.data?.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text
        || candidate?.content?.[0]?.text
        || candidate?.content?.[0]?.parts?.[0]?.text;

      if (!content) throw new Error('Gemini retornou resposta vazia.');
      return extractJson(content);
    } catch (error: any) {
      lastError = error;
      const status = error.response?.status;
      if (status === 429 || status === 503) {
        logger.warn(`Gemini rate limit/indisponível (${status}), aguardando 2s para retry...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      if (status !== 404 && status !== 400) {
        throw error;
      }
      logger.warn(`Modelo Gemini ${model} falhou (${status}), tentando próximo.`);
    }
  }
  throw lastError;
}

function clampPercent(value: any, fallback = 50): number {
  const n = Math.round(Number(value));
  if (isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

const DEFAULT_MARKETS: AnalysisMarkets = {
  winner: { home: 33, draw: 33, away: 34 },
  double_chance: { home_or_draw: 66, home_or_away: 67, draw_or_away: 67 },
  both_to_score: { yes: 50, no: 50 },
  over_under: {
    over_0_5: 90, over_1_5: 70, over_2_5: 50, over_3_5: 30,
    under_0_5: 10, under_1_5: 30, under_2_5: 50, under_3_5: 70,
  },
  asian_handicap: {
    home_0: 33, away_0: 34,
    home_neg_0_5: 33, away_neg_0_5: 34,
    home_neg_1: 25, away_neg_1: 25,
  },
  european_handicap: { home: 33, draw: 33, away: 34 },
  correct_score: {
    '0_0': 10, '1_0': 15, '0_1': 12, '1_1': 18,
    '2_0': 10, '0_2': 8, '2_1': 10, '1_2': 8,
    '2_2': 5, '3_0': 5, '0_3': 3, other: 6,
  },
  goalscorer: { home: [], away: [] },
  corners: {
    total_over_9_5: 50, total_over_10_5: 40,
    total_under_9_5: 50, total_under_10_5: 60,
    home_over_4_5: 50, home_under_4_5: 50,
    away_over_4_5: 50, away_under_4_5: 50,
  },
  cards: {
    total_over_4_5: 50, total_over_5_5: 40,
    total_under_4_5: 50, total_under_5_5: 60,
  },
  fouls: {
    total_over_20_5: 50, total_under_20_5: 50,
    total_over_24_5: 40, total_under_24_5: 60,
  },
};

function mergeMarkets(defaults: any, provided: any): any {
  if (provided === null || typeof provided !== 'object' || Array.isArray(provided)) {
    return defaults;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (Array.isArray(value)) {
      const entries = Array.isArray(provided[key]) ? provided[key] : value;
      result[key] = entries.slice(0, 3).map((entry: any) => ({
        name: String(entry?.name || '').trim().slice(0, 40),
        probability: clampPercent(entry?.probability, 0),
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

function sanitizeSummary(raw: any): AnalysisSummary {
  return {
    summary: String(raw?.analysis?.summary || '').trim().slice(0, 200) || 'Análise baseada em dados estatísticos.',
    key_factors: (Array.isArray(raw?.analysis?.key_factors) ? raw.analysis.key_factors : [])
      .filter((f: any) => typeof f === 'string' && f.trim())
      .slice(0, 5),
    recommendation: String(raw?.analysis?.recommendation || '').trim().slice(0, 100) || 'Considere o favorito para o confronto.',
  };
}

export function sanitizeAnalysis(raw: any, match: any): MatchAnalysis {
  return {
    matchId: match.id,
    teams: { home: match.homeTeam, away: match.awayTeam, date: match.date },
    prediction: {
      home: clampPercent(raw?.prediction?.home, 33),
      draw: clampPercent(raw?.prediction?.draw, 33),
      away: clampPercent(raw?.prediction?.away, 34),
    },
    markets: mergeMarkets(DEFAULT_MARKETS, raw?.markets),
    analysis: sanitizeSummary(raw),
  };
}

function createFallback(match: any, error?: string): MatchAnalysis {
  return {
    matchId: match.id,
    teams: { home: match.homeTeam, away: match.awayTeam, date: match.date },
    prediction: { home: 33, draw: 33, away: 34 },
    markets: mergeMarkets(DEFAULT_MARKETS, undefined),
    analysis: {
      summary: 'Análise baseada em dados estatísticos.',
      key_factors: [],
      recommendation: 'Considere o favorito para o confronto.',
    },
    error,
  };
}

export async function analyzeMatch(match: any): Promise<MatchAnalysis> {
  const cacheKey = `analysis:${match.id}`;
  const cached = cache.get<MatchAnalysis>(cacheKey);
  if (cached) return cached;

  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(match);
  let result: MatchAnalysis;
  let lastError = '';

  try {
    result = sanitizeAnalysis(await callGroq(system, user), match);
    logger.debug(`Análise gerada via GROQ para match ${match.id}`);
  } catch (error: any) {
    lastError = `GROQ: ${error.message}`;
    logger.warn(`GROQ falhou para match ${match.id}, tentando Gemini`, { error: error.message });
    try {
      result = sanitizeAnalysis(await callGemini(system, user), match);
      logger.debug(`Análise gerada via Gemini para match ${match.id}`);
    } catch (error2: any) {
      lastError += ` | Gemini: ${error2.message}`;
      result = createFallback(match, lastError);
    }
  }

  cache.set(cacheKey, result, 600);
  return result;
}

export async function analyzeMatches(matches: any[]): Promise<MatchAnalysis[]> {
  const results: MatchAnalysis[] = [];
  for (const match of matches) {
    try {
      results.push(await analyzeMatch(match));
    } catch (error: any) {
      logger.error(`Falha ao analisar match ${match.id}`, { error: error.message });
      results.push(createFallback(match, error.message));
    }
  }
  return results;
}
