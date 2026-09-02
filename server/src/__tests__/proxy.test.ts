import axios from 'axios';
import { mapStatus, filterFutureMatches, fetchMatches } from '../proxy';
import { getDatasetMatches } from '../dataset';

jest.mock('axios');
jest.mock('../dataset', () => ({
  getDatasetMatches: jest.fn(),
}));

describe('Proxy Functions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.API_FOOTBALL_KEY = 'test-api-key';
    process.env.API_FOOTBALL_DAYS_PAST = '0';
    process.env.API_FOOTBALL_DAYS_FUTURE = '0';
    process.env.USE_DATASET = 'true';
  });

  test('deve mapear status corretamente', () => {
    expect(mapStatus('FT')).toBe('finished');
    expect(mapStatus('LIVE')).toBe('live');
    expect(mapStatus('NS')).toBe('scheduled');
  });

  test('deve filtrar apenas partidas futuras', () => {
    const matches = [
      { date: '2026-08-03', status: 'finished' },
      { date: '2026-08-05', status: 'scheduled' },
      { date: '2026-08-06', status: 'scheduled' },
    ];
    const result = filterFutureMatches(matches, '2026-08-04');
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { date: '2026-08-05', status: 'scheduled' },
      { date: '2026-08-06', status: 'scheduled' },
    ]);
  });

  test('deve retornar dataset local quando a API externa falhar', async () => {
    const mockGet = jest.fn().mockRejectedValue(new Error('Request failed with status code 403'));
    (axios.create as jest.Mock).mockReturnValue({ get: mockGet });
    (getDatasetMatches as jest.Mock).mockReturnValue([
      {
        id: 1,
        homeTeam: 'Flamengo',
        awayTeam: 'Palmeiras',
        homeScore: undefined,
        awayScore: undefined,
        date: '2026-12-20',
        time: '19:00',
        league: 'Brasileirão Série A',
        leagueId: 71,
        status: 'scheduled',
        round: 'Rodada 20',
      },
    ]);

    const matches = await fetchMatches([71]);

    expect(matches).toHaveLength(1);
    expect(matches[0].homeTeam).toBe('Flamengo');
    expect(getDatasetMatches).toHaveBeenCalledWith([71], expect.any(String), expect.any(String));
  });
});
