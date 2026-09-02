export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T;
}

export interface Fixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: 'FT' | 'LIVE' | 'NS' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO';
    };
  };
  league: {
    id: number;
    name: string;
    country?: string;
    round?: string;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface Competition {
  id: number;
  name: string;
  type: 'national' | 'international';
  country?: string;
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
}