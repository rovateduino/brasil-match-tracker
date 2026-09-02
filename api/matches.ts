import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { applyMiddleware, sendError, sendSuccess } from './lib/shared';

const TIMEZONE_BY_LEAGUE: Record<number, string> = {
  71: 'America/Sao_Paulo', 72: 'America/Sao_Paulo', 73: 'America/Sao_Paulo',
  13: 'America/Sao_Paulo', 11: 'America/Sao_Paulo',
  2: 'Europe/Paris', 39: 'Europe/London', 140: 'Europe/Madrid',
};

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapStatus(status: string): 'scheduled' | 'live' | 'finished' {
  if (['LIVE', '1H', '2H', 'HT', 'ET', 'P'].includes(status)) return 'live';
  if (['FT', 'AET', 'PEN', 'ABD', 'CANC', 'WO'].includes(status)) return 'finished';
  return 'scheduled';
}

function mapFixture(f: any) {
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

// Dataset parsing (inline for serverless)
const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function hashId(...parts: string[]): number {
  const s = parts.join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function parseFootballTxt(text: string, leagueId: number, leagueName: string) {
  const matches: any[] = [];
  let currentYear = 0, prevMonth = 0, currentDate = '', round = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('=') || line.startsWith('\f')) continue;

    const roundMatch = line.match(/^▪\s*(Matchday|Round|Group)\s+(\d+)/);
    if (roundMatch) { round = `Rodada ${roundMatch[2]}`; continue; }

    const dateMatch = line.match(/^([A-Za-z]{3}) ([A-Za-z]{3}) (\d{1,2})(?: (\d{4}))?$/);
    if (dateMatch) {
      const month = MONTHS[dateMatch[2]];
      if (!month) continue;
      const day = parseInt(dateMatch[3], 10);
      if (dateMatch[4]) currentYear = parseInt(dateMatch[4], 10);
      else if (prevMonth > month) currentYear += 1;
      prevMonth = month;
      if (currentYear) currentDate = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      continue;
    }

    let time = '', rest = line;
    const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
    if (timeMatch) { time = timeMatch[1]; rest = timeMatch[2]; }

    const vIndex = rest.indexOf(' v ');
    if (vIndex === -1 || !currentDate) continue;

    const homeTeam = rest.slice(0, vIndex).trim();
    const awayPart = rest.slice(vIndex + 3).trim();
    const scoreMatch = awayPart.match(/(\d+)-(\d+)/);
    let awayTeam = scoreMatch ? awayPart.slice(0, scoreMatch.index!).trim() : awayPart;
    awayTeam = awayTeam.replace(/\[[^\]]*\]/g, '').trim();

    let homeScore: number | undefined, awayScore: number | undefined;
    let status: 'scheduled' | 'finished' = 'scheduled';
    if (scoreMatch) {
      homeScore = parseInt(scoreMatch[1], 10);
      awayScore = parseInt(scoreMatch[2], 10);
      status = 'finished';
    }

    matches.push({
      id: hashId(leagueName, currentDate, time, homeTeam, awayTeam),
      homeTeam, awayTeam, homeScore, awayScore,
      date: currentDate, time, league: leagueName, leagueId, status, round,
    });
  }
  return matches;
}

// In-memory cache per invocation (cold start)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyMiddleware(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const leaguesParam = req.query.leagues;
  if (!leaguesParam) {
    return sendError(res, 400, 'Informe ao menos uma competição (leagues).');
  }

  const raw = Array.isArray(leaguesParam) ? leaguesParam : [leaguesParam];
  const ids = raw.flatMap((v) => String(v).split(',')).map((v) => Number(v.trim())).filter((n) => !isNaN(n));
  if (ids.length === 0) {
    return sendError(res, 400, 'IDs de liga inválidos.');
  }

  const cacheKey = `matches:${ids.sort((a, b) => a - b).join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return sendSuccess(res, cached.data);
  }

  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) {
    return sendError(res, 400, 'Chave de API não configurada. Acesse Configurações.');
  }

  const today = new Date();
  const daysFuture = Math.min(parseInt(process.env.API_FOOTBALL_DAYS_FUTURE || '14', 10), 1);
  const allFixtures: any[] = [];
  const errors: string[] = [];

  // Group by timezone
  const groupsByTz = new Map<string, number[]>();
  for (const id of ids) {
    const tz = TIMEZONE_BY_LEAGUE[id] || 'America/Sao_Paulo';
    if (!groupsByTz.has(tz)) groupsByTz.set(tz, []);
    groupsByTz.get(tz)!.push(id);
  }

  for (let offset = 0; offset <= daysFuture; offset++) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    const date = toLocalDateString(day);

    for (const [timezone, tzLeagueIds] of groupsByTz) {
      try {
        const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
          params: { date, timezone },
          headers: {
            'x-rapidapi-key': apiKey,
            'x-apisports-key': apiKey,
          },
          timeout: 15000,
        });

        const apiErrors = response.data?.errors;
        if (apiErrors && Object.keys(apiErrors).length > 0) {
          const msg = Object.values(apiErrors).join('; ');
          errors.push(`${date} [${timezone}]: ${msg}`);
          continue;
        }

        const fixtures = (response.data?.response || []).filter((f: any) => tzLeagueIds.includes(f.league.id));
        allFixtures.push(...fixtures.map(mapFixture));
      } catch (error: any) {
        errors.push(`${date} [${timezone}]: ${error.message}`);
      }
    }
  }

  // Dataset fallback
  let fixtures = allFixtures;
  if (process.env.USE_DATASET !== 'false') {
    const DATASETS: Record<number, { name: string; url: string }> = {
      71: { name: 'Brasileirão Série A', url: 'https://raw.githubusercontent.com/rovateduino/brasil-match-tracker/main/server/data/br1_2026.txt' },
      72: { name: 'Brasileirão Série B', url: 'https://raw.githubusercontent.com/rovateduino/brasil-match-tracker/main/server/data/br2_2025.txt' },
      73: { name: 'Copa do Brasil', url: 'https://raw.githubusercontent.com/rovateduino/brasil-match-tracker/main/server/data/brcup_2025.txt' },
    };

    const from = new Date(today);
    from.setDate(today.getDate() - 0);
    const to = new Date(today);
    to.setDate(today.getDate() + parseInt(process.env.DATASET_DAYS_FUTURE || '14', 10));
    const fromDate = toLocalDateString(from);
    const toDate = toLocalDateString(to);

    for (const leagueId of ids) {
      const ds = DATASETS[leagueId];
      if (!ds) continue;
      try {
        const resp = await axios.get(ds.url, { timeout: 10000 });
        const matches = parseFootballTxt(resp.data, leagueId, ds.name);
        const filtered = matches.filter((m: any) => m.date >= fromDate && m.date <= toDate && m.status !== 'finished');
        allFixtures.push(...filtered);
      } catch (e: any) {
        errors.push(`Dataset ${ds.name}: ${e.message}`);
      }
    }
  }

  // Deduplicate
  const byKey = new Map<string, any>();
  for (const m of allFixtures) {
    const key = `${m.date}|${m.homeTeam.toLowerCase()}|${m.awayTeam.toLowerCase()}`;
    byKey.set(key, m);
  }
  fixtures = [...byKey.values()];

  // Filter future only
  const todayStr = toLocalDateString(today);
  const upcoming = fixtures.filter((f: any) => f.date >= todayStr && f.status !== 'finished');

  upcoming.sort((a: any, b: any) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  cache.set(cacheKey, { data: upcoming, expiresAt: Date.now() + CACHE_TTL });
  sendSuccess(res, upcoming);
}
