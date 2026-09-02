import { normalizeTeamName, parseMatch } from '../dataset';

describe('Dataset Parser', () => {
  test('deve normalizar nome do time', () => {
    expect(normalizeTeamName('São Paulo FC')).toBe('sao paulo fc');
    expect(normalizeTeamName('Atlético-MG')).toBe('atletico mg');
  });

  test('deve parsear linha de partida corretamente', () => {
    const line = '2026-08-04 19:30 São Paulo v Santos 2-1';
    const result = parseMatch(line);
    expect(result).toEqual({
      date: '2026-08-04',
      time: '19:30',
      home: 'São Paulo',
      away: 'Santos',
      homeGoals: 2,
      awayGoals: 1,
    });
  });
});
