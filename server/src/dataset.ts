import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

interface DatasetSource {
  file: string;
  leagueId: number;
  leagueName: string;
}

// Dados locais (openfootball/south-america, licença MIT) servem como fonte
// complementar à API-Football, cobrindo temporadas completas com resultados
// e calendário, inclusive rodadas futuras que o plano grátis não libera.
const SOURCES: DatasetSource[] = [
  { file: 'br1_2026.txt', leagueId: 71, leagueName: 'Brasileirão Série A' },
  { file: 'br2_2025.txt', leagueId: 72, leagueName: 'Brasileirão Série B' },
  { file: 'brcup_2025.txt', leagueId: 73, leagueName: 'Copa do Brasil' },
];

const DATA_DIR = path.resolve(process.cwd(), 'data');

export interface DatasetMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  date: string;
  time: string;
  league: string;
  leagueId: number;
  status: 'scheduled' | 'finished';
  round: string;
}

const registry = new Map<number, DatasetMatch[]>();

function hashId(...parts: string[]): number {
  const s = parts.join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function parseFootballTxt(text: string, source: DatasetSource): DatasetMatch[] {
  const matches: DatasetMatch[] = [];
  let currentYear = 0;
  let prevMonth = 0;
  let currentDate = '';
  let round = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('=') || line.startsWith('\f')) continue;

    const roundMatch = line.match(/^▪\s*(Matchday|Round|Group)\s+(\d+)/);
    if (roundMatch) {
      round = `Rodada ${roundMatch[2]}`;
      continue;
    }

    const dateMatch = line.match(/^([A-Za-z]{3}) ([A-Za-z]{3}) (\d{1,2})(?: (\d{4}))?$/);
    if (dateMatch) {
      const month = MONTHS[dateMatch[2]];
      if (!month) continue;
      const day = parseInt(dateMatch[3], 10);
      if (dateMatch[4]) {
        currentYear = parseInt(dateMatch[4], 10);
      } else if (prevMonth > month) {
        currentYear += 1;
      }
      prevMonth = month;
      if (currentYear) {
        currentDate = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      continue;
    }

    let time = '';
    let rest = line;
    const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
    if (timeMatch) {
      time = timeMatch[1];
      rest = timeMatch[2];
    }

    const vIndex = rest.indexOf(' v ');
    if (vIndex === -1 || !currentDate) continue;

    const homeTeam = rest.slice(0, vIndex).trim();
    const awayPart = rest.slice(vIndex + 3).trim();
    const scoreMatch = awayPart.match(/(\d+)-(\d+)/);

    let awayTeam = scoreMatch && scoreMatch.index !== undefined
      ? awayPart.slice(0, scoreMatch.index).trim()
      : awayPart;
    awayTeam = awayTeam.replace(/\[[^\]]*\]/g, '').trim();

    let homeScore: number | undefined;
    let awayScore: number | undefined;
    let status: 'scheduled' | 'finished' = 'scheduled';
    if (scoreMatch) {
      homeScore = parseInt(scoreMatch[1], 10);
      awayScore = parseInt(scoreMatch[2], 10);
      status = 'finished';
    }

    matches.push({
      id: hashId(source.leagueName, currentDate, time, homeTeam, awayTeam),
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      date: currentDate,
      time,
      league: source.leagueName,
      leagueId: source.leagueId,
      status,
      round,
    });
  }

  return matches;
}

export function loadDataset(): void {
  for (const source of SOURCES) {
    const filePath = path.join(DATA_DIR, source.file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      registry.set(source.leagueId, parseFootballTxt(text, source));
      logger.info(`Dataset carregado: ${source.file}`);
    } catch (error: any) {
      logger.error(`Erro ao carregar dataset ${source.file}`, { error: error.message });
    }
  }
}

export function getDatasetMatches(leagueIds: number[], fromDate: string, toDate: string): DatasetMatch[] {
  const ids = new Set(leagueIds);
  const result: DatasetMatch[] = [];
  for (const [leagueId, matches] of registry) {
    if (!ids.has(leagueId)) continue;
    for (const m of matches) {
      if (m.date >= fromDate && m.date <= toDate) {
        result.push(m);
      }
    }
  }
  return result;
}

export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseMatch(line: string) {
  const trimmed = line.trim();
  const parts = trimmed.split(' ');
  if (parts.length < 5) {
    throw new Error('Formato de partida inválido');
  }

  const date = parts[0];
  const time = parts[1];
  const body = trimmed.slice(date.length + time.length + 2).trim();
  const scoreMatch = body.match(/(\d+)-(\d+)$/);
  const teamsPart = scoreMatch ? body.slice(0, scoreMatch.index).trim() : body;
  const teams = teamsPart.split(' v ');

  if (teams.length !== 2) {
    throw new Error('Formato de times inválido');
  }

  return {
    date,
    time,
    home: teams[0].trim(),
    away: teams[1].trim(),
    homeGoals: scoreMatch ? parseInt(scoreMatch[1], 10) : undefined,
    awayGoals: scoreMatch ? parseInt(scoreMatch[2], 10) : undefined,
  };
}

function findTeam(teamName: string, leagueId: number): string | null {
  const matches = registry.get(leagueId);
  if (!matches) return null;
  const names = new Set<string>();
  for (const m of matches) {
    names.add(m.homeTeam);
    names.add(m.awayTeam);
  }

  const query = normalizeTeamName(teamName);
  const queryWords = query.split(' ').filter((w) => w.length >= 3);

  let best: { name: string; score: number } | null = null;
  for (const n of names) {
    const normalized = normalizeTeamName(n);
    if (normalized === query) return n;
    const words = normalized.split(' ').filter((w) => w.length >= 3);
    const common = queryWords.filter((w) => words.includes(w)).length;
    if (common > 0 && (!best || common > best.score)) {
      best = { name: n, score: common };
    }
  }
  return best?.name ?? null;
}

export interface TeamMatch {
  date: string;
  opponent: string;
  home: boolean;
  goalsScored: number;
  goalsConceded: number;
  result: 'W' | 'D' | 'L';
}

export interface TeamDetailedStats {
  team: string;
  matches: TeamMatch[];
  avgGoalsScored: number;
  avgGoalsConceded: number;
  cleanSheets: number;
  bothScored: number;
  winRate: number;
}

export function getTeamDetailedStats(teamName: string, leagueId: number, last = 5): TeamDetailedStats | null {
  const name = findTeam(teamName, leagueId);
  if (!name) return null;

  const played = (registry.get(leagueId) || [])
    .filter((m) => m.status === 'finished' && (m.homeTeam === name || m.awayTeam === name))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, last);

  if (played.length === 0) return null;

  const matches: TeamMatch[] = played.map((m) => {
    const isHome = m.homeTeam === name;
    const goalsScored = isHome ? m.homeScore ?? 0 : m.awayScore ?? 0;
    const goalsConceded = isHome ? m.awayScore ?? 0 : m.homeScore ?? 0;
    const result: TeamMatch['result'] =
      goalsScored > goalsConceded ? 'W' : goalsScored < goalsConceded ? 'L' : 'D';
    return {
      date: m.date,
      opponent: isHome ? m.awayTeam : m.homeTeam,
      home: isHome,
      goalsScored,
      goalsConceded,
      result,
    };
  });

  const totalScored = matches.reduce((sum, m) => sum + m.goalsScored, 0);
  const totalConceded = matches.reduce((sum, m) => sum + m.goalsConceded, 0);
  const wins = matches.filter((m) => m.result === 'W').length;

  return {
    team: name,
    matches,
    avgGoalsScored: totalScored / matches.length,
    avgGoalsConceded: totalConceded / matches.length,
    cleanSheets: matches.filter((m) => m.goalsConceded === 0).length,
    bothScored: matches.filter((m) => m.goalsScored > 0 && m.goalsConceded > 0).length,
    winRate: (wins / matches.length) * 100,
  };
}

export interface H2hMatch {
  date: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

export function getHeadToHeadMatches(homeName: string, awayName: string, leagueId: number): H2hMatch[] {
  const home = findTeam(homeName, leagueId);
  const away = findTeam(awayName, leagueId);
  if (!home || !away || home === away) return [];
  return (registry.get(leagueId) || [])
    .filter(
      (m) =>
        m.status === 'finished' &&
        ((m.homeTeam === home && m.awayTeam === away) || (m.homeTeam === away && m.awayTeam === home))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((m) => ({
      date: m.date,
      home: m.homeTeam,
      away: m.awayTeam,
      homeGoals: m.homeScore ?? 0,
      awayGoals: m.awayScore ?? 0,
    }));
}

export interface StandingRow {
  team: string;
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

export function getStandingsTable(leagueId: number, top = 20): StandingRow[] {
  const matches = (registry.get(leagueId) || []).filter((m) => m.status === 'finished');
  const table = new Map<string, { p: number; w: number; d: number; l: number; gf: number; ga: number }>();
  const ensure = (t: string) => {
    if (!table.has(t)) table.set(t, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
    return table.get(t)!;
  };
  for (const m of matches) {
    const home = ensure(m.homeTeam);
    const away = ensure(m.awayTeam);
    home.gf += m.homeScore ?? 0;
    home.ga += m.awayScore ?? 0;
    away.gf += m.awayScore ?? 0;
    away.ga += m.homeScore ?? 0;
    if ((m.homeScore ?? 0) > (m.awayScore ?? 0)) {
      home.w += 1;
      home.p += 3;
      away.l += 1;
    } else if ((m.homeScore ?? 0) < (m.awayScore ?? 0)) {
      away.w += 1;
      away.p += 3;
      home.l += 1;
    } else {
      home.d += 1;
      away.d += 1;
      home.p += 1;
      away.p += 1;
    }
  }
  return [...table.entries()]
    .sort(
      (x, y) =>
        y[1].p - x[1].p ||
        (y[1].gf - y[1].ga) - (x[1].gf - x[1].ga) ||
        y[1].gf - x[1].gf
    )
    .slice(0, top)
    .map(([team, s], i) => ({
      team,
      position: i + 1,
      points: s.p,
      played: s.w + s.d + s.l,
      wins: s.w,
      draws: s.d,
      losses: s.l,
      gf: s.gf,
      ga: s.ga,
    }));
}

export function getTeamForm(teamName: string, leagueId: number, last = 5): string[] {
  const name = findTeam(teamName, leagueId);
  if (!name) return [];
  const played = (registry.get(leagueId) || [])
    .filter((m) => m.status === 'finished' && (m.homeTeam === name || m.awayTeam === name))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, last);
  return played.map((m) => {
    const isHome = m.homeTeam === name;
    const gf = isHome ? m.homeScore ?? 0 : m.awayScore ?? 0;
    const ga = isHome ? m.awayScore ?? 0 : m.homeScore ?? 0;
    const result = gf > ga ? 'V' : gf < ga ? 'D' : 'E';
    return `${result} ${gf}-${ga} vs ${isHome ? m.awayTeam : m.homeTeam} (${m.date})`;
  });
}

export function getHeadToHead(homeName: string, awayName: string, leagueId: number): string[] {
  const home = findTeam(homeName, leagueId);
  const away = findTeam(awayName, leagueId);
  if (!home || !away || home === away) return [];
  return (registry.get(leagueId) || [])
    .filter(
      (m) =>
        m.status === 'finished' &&
        ((m.homeTeam === home && m.awayTeam === away) || (m.homeTeam === away && m.awayTeam === home))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((m) => `${m.date}: ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`);
}

export function getStandings(leagueId: number, top = 10): string[] {
  const matches = (registry.get(leagueId) || []).filter((m) => m.status === 'finished');
  const table = new Map<string, { p: number; w: number; d: number; l: number; gf: number; ga: number }>();
  const ensure = (t: string) => {
    if (!table.has(t)) table.set(t, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
    return table.get(t)!;
  };
  for (const m of matches) {
    const home = ensure(m.homeTeam);
    const away = ensure(m.awayTeam);
    home.gf += m.homeScore ?? 0;
    home.ga += m.awayScore ?? 0;
    away.gf += m.awayScore ?? 0;
    away.ga += m.homeScore ?? 0;
    if ((m.homeScore ?? 0) > (m.awayScore ?? 0)) {
      home.w += 1;
      home.p += 3;
      away.l += 1;
    } else if ((m.homeScore ?? 0) < (m.awayScore ?? 0)) {
      away.w += 1;
      away.p += 3;
      home.l += 1;
    } else {
      home.d += 1;
      away.d += 1;
      home.p += 1;
      away.p += 1;
    }
  }
  return [...table.entries()]
    .sort(
      (x, y) =>
        y[1].p - x[1].p ||
        (y[1].gf - y[1].ga) - (x[1].gf - x[1].ga) ||
        y[1].gf - x[1].gf
    )
    .slice(0, top)
    .map(([t, s], i) => `${i + 1}. ${t} ${s.p}pts (${s.w}V ${s.d}E ${s.l}D GP${s.gf} GC${s.ga})`);
}
