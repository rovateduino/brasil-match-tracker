import axios, { AxiosInstance } from 'axios';
import { cache } from './cache';
import { logger } from './logger';
import { getDatasetMatches } from './dataset';
import { updateEnvFile } from './envFile';
import { Fixture, Competition, ApiFootballResponse } from './types';

function getApiKey(): string {
  return process.env.API_FOOTBALL_KEY?.trim() || '';
}

export function setApiKey(key: string) {
  const trimmed = key.trim();
  updateEnvFile({ API_FOOTBALL_KEY: trimmed });
  process.env.API_FOOTBALL_KEY = trimmed;
  logger.info('API key updated in .env');
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

function createApiClient(): AxiosInstance {
  const key = getApiKey();
  if (!key) {
    throw new Error('API key não configurada.');
  }
  return axios.create({
    baseURL: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
    headers: {
      'x-rapidapi-key': key,
      'x-rapidapi-host': 'v3.football.api-sports.io',
      'x-apisports-key': key,
    },
  });
}

// Lista de competições nacionais e internacionais relevantes (IDs da API-Football v3)
// Atualizado: apenas principais ligas brasileiras + Champions League + 2 ligas europeias
const COMPETITIONS: Competition[] = [
  // === FUTEBOL BRASILEIRO ===
  { id: 71, name: 'Brasileirão Série A', type: 'national', country: 'Brazil' },
  { id: 72, name: 'Brasileirão Série B', type: 'national', country: 'Brazil' },
  { id: 73, name: 'Copa do Brasil', type: 'national', country: 'Brazil' },
  // === COMPETIÇÕES DE CLUBES (AMÉRICA DO SUL) ===
  { id: 13, name: 'Libertadores da América', type: 'international', country: 'South America' },
  { id: 11, name: 'Copa Sul-Americana', type: 'international', country: 'South America' },
  // === FUTEBOL EUROPEU ===
  { id: 2, name: 'UEFA Champions League', type: 'international', country: 'Europe' },
  { id: 39, name: 'Premier League', type: 'national', country: 'England' },
  { id: 140, name: 'La Liga', type: 'national', country: 'Spain' },
];

// Timezone por competição - usado para buscar fixture.date já convertido
// Brasileiro/Sul-Americana = America/Sao_Paulo; Europeu = timezone local do país sede
// Isso evita mostrar 16:00 BRT para um jogo das 20:00 em Madrid (confusão do print)
const TIMEZONE_BY_LEAGUE: Record<number, string> = {
  71: 'America/Sao_Paulo',
  72: 'America/Sao_Paulo',
  73: 'America/Sao_Paulo',
  13: 'America/Sao_Paulo',
  11: 'America/Sao_Paulo',
  2: 'Europe/Paris',
  39: 'Europe/London',
  140: 'Europe/Madrid',
};

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapFixture(f: Fixture) {
  // fixture.date já vem convertido para o timezone solicitado (ex: 2026-09-03T21:00:00+02:00 para La Liga)
  // Extrair date/time preserva o horário local da sede - exatamente o que o usuário compara no site oficial
  return {
    id: f.fixture.id,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeScore: f.goals.home ?? undefined,
    awayScore: f.goals.away ?? undefined,
    date: f.fixture.date.split('T')[0],
    time: f.fixture.date.split('T')[1]?.slice(0, 5) || '00:00',
    league: f.league.name,
    leagueId: f.league.id,
    status: mapStatus(f.fixture.status.short),
    round: f.league.round,
  };
}

function getTimezoneForLeagues(ids: number[]): string {
  // Se todas as ligas pedidas compartilham o mesmo timezone, usa ele; senão agrupa
  const tzs = new Set(ids.map((id) => TIMEZONE_BY_LEAGUE[id] || 'America/Sao_Paulo'));
  return tzs.size === 1 ? [...tzs][0] : 'UTC';
}

// Cache por data para evitar 15 requisições repetidas ao trocar de aba (free plan = 100 req/dia)
// TTL 10 minutos compartilha fixtures de qualquer /api/matches que cubra a mesma data
interface DateCacheEntry {
  data: Fixture[];
  errors?: Record<string, string>;
  expiresAt: number;
}
const fixturesByDateCache = new Map<string, DateCacheEntry>();
const DATE_CACHE_TTL = 10 * 60 * 1000;

function isRateLimitError(error: any): boolean {
  const status = error?.response?.status;
  const msg = String(error?.message || '');
  return status === 429 || msg.includes('429');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMatches(leagueIds: number[]): Promise<any[]> {
  if (!getApiKey()) {
    throw new Error('Chave de API não configurada. Acesse Configurações.');
  }

  // Construir chave de cache baseada nos ids ordenados
  const sortedIds = [...leagueIds].sort((a, b) => a - b);
  const cacheKey = `matches:${sortedIds.join(',')}`;
  const cached = cache.get<any[]>(cacheKey);
  if (cached) return cached;

  const client = createApiClient();
  const today = new Date();

  // Janela de dias consultados: APENAS partidas futuras (a partir de hoje).
  // O plano grátis da API-Football só libera a janela de datas recentes, por
  // isso a consulta é por data (sem "season"). API_FOOTBALL_DAYS_PAST deve
  // permanecer 0 para não buscar partidas passadas.
  const daysPast = Math.max(0, parseInt(process.env.API_FOOTBALL_DAYS_PAST || '0', 10));
  const daysFuture = Math.max(1, parseInt(process.env.API_FOOTBALL_DAYS_FUTURE || '14', 10));
  // Free plan só libera 3 dias (hoje ±1 -> 01 a 03 para hoje 02); além disso a API retorna "Free plans do not have access to this date"
  // Limitar a janela da API para evitar 12 erros por requisição; o dataset cobre o restante (14 dias)
  const apiDaysFuture = Math.min(daysFuture, 1);
  const apiDaysPast = Math.min(daysPast, 1);

  const allFixtures: any[] = [];
  const errors: string[] = [];
  let rateLimitHits = 0;

  // Agrupar ligas por timezone para que o horário exibido coincida com o site oficial local
  // ex: La Liga sempre em Europe/Madrid (20:00/21:00 local), Brasileirão em America/Sao_Paulo
  const groupsByTz = new Map<string, number[]>();
  for (const id of leagueIds) {
    const tz = TIMEZONE_BY_LEAGUE[id] || 'America/Sao_Paulo';
    if (!groupsByTz.has(tz)) groupsByTz.set(tz, []);
    groupsByTz.get(tz)!.push(id);
  }

  // Consulta por data (sem "season") porque o plano grátis não libera a
  // temporada atual via parâmetro season, apenas a janela de datas recentes.
  // Usar janela reduzida para a API (free) e janela completa via dataset abaixo
  for (let offset = -apiDaysPast; offset <= apiDaysFuture; offset++) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    const date = toLocalDateString(day);

    for (const [timezone, tzLeagueIds] of groupsByTz) {
      if (rateLimitHits >= 2) break;
      const dateCacheKey = `fixtures:${date}:${timezone}`;

      try {
        let rawFixtures: Fixture[] | null = null;
        let apiFieldErrors: Record<string, string> | null = null;

        const cachedDate = fixturesByDateCache.get(dateCacheKey);
        if (cachedDate && Date.now() < cachedDate.expiresAt) {
          logger.debug(`Date cache hit for ${date} tz=${timezone}`);
          rawFixtures = cachedDate.data;
          apiFieldErrors = cachedDate.errors || null;
        } else {
          if (offset > -daysPast) await sleep(180);
          const params = { date, timezone };
          logger.debug(`Fetching fixtures for ${date} tz=${timezone}`, params);
          const response = await client.get<ApiFootballResponse<Fixture[]>>('/fixtures', { params });

          const apiErrors: any = response.data.errors;
          if (apiErrors && Object.keys(apiErrors).length > 0) {
            apiFieldErrors = apiErrors as unknown as Record<string, string>;
            const messages = Object.values(apiErrors).join('; ');
            logger.error(`API-Football retornou erro para ${date} tz=${timezone}`, apiErrors);
            if (String(messages).includes('429') || JSON.stringify(apiErrors).includes('429')) {
              rateLimitHits += 1;
            }
            fixturesByDateCache.set(dateCacheKey, {
              data: [],
              errors: apiFieldErrors!,
              expiresAt: Date.now() + DATE_CACHE_TTL,
            });
            if (apiFieldErrors) {
              const isRateLimitField = JSON.stringify(apiFieldErrors).includes('429');
              if (isRateLimitField) errors.push(`${date} [${timezone}]: limite da API atingido (429)`);
              else errors.push(`${date} [${timezone}]: ${Object.values(apiFieldErrors).join('; ')}`);
            }
            if (rateLimitHits >= 2) {
              logger.warn('Rate limit detectado via errors field, interrompendo buscas restantes e usando dataset/cache');
              break;
            }
            continue;
          }

          rawFixtures = response.data.response || [];
          fixturesByDateCache.set(dateCacheKey, {
            data: rawFixtures,
            expiresAt: Date.now() + DATE_CACHE_TTL,
          });
        }

        if (apiFieldErrors && Object.keys(apiFieldErrors).length > 0) {
          continue;
        }

        const fixtures = (rawFixtures || []).filter((f) => tzLeagueIds.includes(f.league.id));
        allFixtures.push(...fixtures.map(mapFixture));
      } catch (error: any) {
        if (isRateLimitError(error)) {
          rateLimitHits += 1;
          const retryAfter = error?.response?.headers?.['retry-after'];
          logger.warn(`Rate limit 429 para ${date} tz=${timezone} (hit ${rateLimitHits}/2)${retryAfter ? ` retry-after=${retryAfter}` : ''} - usando dataset como fallback`);
          errors.push(`${date} [${timezone}]: limite da API atingido (429)`);
          fixturesByDateCache.set(dateCacheKey, {
            data: [],
            errors: { rateLimit: '429 Too Many Requests' },
            expiresAt: Date.now() + 2 * 60 * 1000,
          });
          if (rateLimitHits >= 2) {
            logger.warn('Múltiplos 429 consecutivos, interrompendo loop e servindo dataset/cache');
            break;
          }
          await sleep(400);
          continue;
        }
        const message = error.message || 'Erro desconhecido';
        logger.error(`Error fetching fixtures for ${date} tz=${timezone}`, { error: message });
        errors.push(`${date} [${timezone}]: ${message}`);
      }
    }
  }

  // Dados locais (openfootball) complementam a API: cobrem temporada completa,
  // inclusive rodadas futuras que o plano grátis da API-Football não libera.
  let fixtures = allFixtures;
  if (process.env.USE_DATASET !== 'false') {
    const datasetPast = Math.max(0, parseInt(process.env.DATASET_DAYS_PAST || '0', 10));
    const datasetFuture = Math.max(1, parseInt(process.env.DATASET_DAYS_FUTURE || '14', 10));
    const from = new Date(today);
    from.setDate(today.getDate() - datasetPast);
    const to = new Date(today);
    to.setDate(today.getDate() + datasetFuture);

    const datasetMatches = getDatasetMatches(leagueIds, toLocalDateString(from), toLocalDateString(to));
    if (datasetMatches.length > 0) {
      const byKey = new Map<string, any>();
      for (const m of datasetMatches) byKey.set(dedupeKey(m), m);
      for (const m of allFixtures) byKey.set(dedupeKey(m), m);
      fixtures = [...byKey.values()];
    }
  }

  // Se nenhuma partida veio da API nem do dataset local, decidir se é erro fatal ou apenas rate limit / free-plan.
  if (fixtures.length === 0 && errors.length > 0) {
    const isBenign = (e: string) =>
      e.includes('429') ||
      e.toLowerCase().includes('limite') ||
      e.toLowerCase().includes('free plans do not have access');
    const allBenign = errors.every(isBenign);
    if (allBenign) {
      // Plano Free estourou (100 req/dia): não quebrar a UI com um wall de 429s.
      // Se for competição com dataset (BR) já teria sido preenchida; se for sem dataset (Champions/PL/La Liga)
      // o correto é retornar vazio com aviso amigável e deixar o cache por data evitar nova enxurrada.
      logger.warn('Nenhuma partida após 429s - retornando vazio com dataset/cache disponível', {
        leagues: sortedIds,
        errors: errors.slice(0, 3),
      });
      // Retorna vazio -> frontend mostra "Nenhuma partida encontrada" em vez de stack de 429s
      // O erro detalhado fica no log do servidor para diagnóstico.
      cache.set(cacheKey, []);
      return [];
    }
    throw new Error(errors.join(' | '));
  }

  // Garantir que apenas partidas futuras/em andamento apareçam: descartar
  // qualquer partida já finalizada ou com data anterior a hoje.
  const todayStr = toLocalDateString(today);
  const upcoming = filterFutureMatches(fixtures, todayStr);
  logger.info(
    `fetchMatches: ${fixtures.length} encontradas, ${upcoming.length} futuras/em andamento (leagues ${sortedIds.join(',')})`
  );

  // Ordenar por data e hora
  upcoming.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  cache.set(cacheKey, upcoming);
  return upcoming;
}

function dedupeKey(m: { date: string; homeTeam: string; awayTeam: string }): string {
  return `${m.date}|${m.homeTeam.toLowerCase()}|${m.awayTeam.toLowerCase()}`;
}

export function mapStatus(status: string): 'scheduled' | 'live' | 'finished' {
  if (status === 'LIVE' || status === '1H' || status === '2H' || status === 'HT' || status === 'ET' || status === 'P') {
    return 'live';
  }
  if (status === 'FT' || status === 'AET' || status === 'PEN' || status === 'ABD' || status === 'CANC' || status === 'WO') {
    return 'finished';
  }
  return 'scheduled';
}

export function filterFutureMatches(matches: any[], today: string) {
  return matches.filter((f) => f.date >= today && f.status !== 'finished');
}

export function getCompetitions(): Competition[] {
  return COMPETITIONS;
}