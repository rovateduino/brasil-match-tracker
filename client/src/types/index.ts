export interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  date: string; // ISO
  time: string; // HH:mm
  league: string;
  leagueId: number;
  status: 'scheduled' | 'live' | 'finished';
  round?: string;
}

export interface Competition {
  id: number;
  name: string;
  type: 'national' | 'international';
  country?: string;
}

export interface ApiSettings {
  apiKey: string;
  baseUrl: string;
}

export interface AiSettingsStatus {
  groq: { hasKey: boolean; model: string };
  gemini: { hasKey: boolean; model: string };
}

export type FilterState = {
  competitions: number[]; // ids selecionados
  search?: string;
};

export interface GoalscorerEntry {
  name: string;
  probability: number;
}

export interface MatchMarkets {
  winner: { home: number; draw: number; away: number };
  double_chance: { home_or_draw: number; home_or_away: number; draw_or_away: number };
  both_to_score: { yes: number; no: number };
  over_under: Record<string, number>;
  asian_handicap: Record<string, number>;
  european_handicap: { home: number; draw: number; away: number };
  correct_score: Record<string, number>;
  goalscorer: { home: GoalscorerEntry[]; away: GoalscorerEntry[] };
  corners: Record<string, number>;
  cards: Record<string, number>;
  fouls: Record<string, number>;
}

export interface MatchAnalysis {
  matchId: number;
  teams: { home: string; away: string; date: string };
  prediction: { home: number; draw: number; away: number };
  markets: MatchMarkets;
  analysis: { summary: string; key_factors: string[]; recommendation: string };
  error?: string;
}