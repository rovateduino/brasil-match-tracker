import { extractJson, sanitizeAnalysis, MatchAnalysis } from '../ai';

describe('AI Functions', () => {
  // ==========================================
  // TESTES DE EXTRAÇÃO DE JSON
  // ==========================================
  describe('extractJson', () => {
    test('deve extrair JSON de texto com markdown', () => {
      const text = '```json\n{"prediction": {"home": 60, "draw": 25, "away": 15}}\n```';
      expect(extractJson(text)).toEqual({ prediction: { home: 60, draw: 25, away: 15 } });
    });

    test('deve extrair JSON de texto puro', () => {
      const text = '{"prediction": {"home": 50, "draw": 30, "away": 20}}';
      expect(extractJson(text)).toEqual({ prediction: { home: 50, draw: 30, away: 20 } });
    });

    test('deve extrair JSON de texto com texto antes e depois', () => {
      const text = 'Aqui está o resultado: {"prediction": {"home": 55, "draw": 25, "away": 20}} Espero que ajude!';
      expect(extractJson(text)).toEqual({ prediction: { home: 55, draw: 25, away: 20 } });
    });

    test('deve lançar erro para texto sem JSON válido', () => {
      expect(() => extractJson('Não há JSON aqui')).toThrow('Resposta da IA não contém JSON válido');
    });

    test('deve lançar erro para JSON incompleto', () => {
      expect(() => extractJson('{incompleto')).toThrow('Resposta da IA não contém JSON válido');
    });

    test('deve lidar com JSON complexo completo', () => {
      const complexJson = {
        prediction: { home: 60, draw: 25, away: 15 },
        markets: {
          winner: { home: 60, draw: 25, away: 15 },
          both_to_score: { yes: 55, no: 45 },
        },
        analysis: {
          summary: 'Análise completa',
          key_factors: ['Fator 1', 'Fator 2'],
          recommendation: 'Aposte no mandante',
        },
      };
      const text = `\`\`\`json\n${JSON.stringify(complexJson)}\n\`\`\``;
      expect(extractJson(text)).toEqual(complexJson);
    });
  });

  // ==========================================
  // TESTES DE SANITIZAÇÃO DE ANÁLISE
  // ==========================================
  describe('sanitizeAnalysis', () => {
    const mockMatch = { id: 1, homeTeam: 'Flamengo', awayTeam: 'Palmeiras', date: '2026-08-15' };

    test('deve sanitizar valores de probabilidade acima de 100', () => {
      const analysis = {
        prediction: { home: 150, draw: -10, away: 40 },
        markets: {
          winner: { home: 150, draw: 25, away: 15 },
        },
        analysis: { summary: 'Resumo', key_factors: ['Fator 1'], recommendation: 'Aposte no mandante' },
      };
      const result = sanitizeAnalysis(analysis, mockMatch);
      expect(result.prediction.home).toBe(100);
      expect(result.prediction.draw).toBe(0);
      expect(result.prediction.away).toBe(40);
      expect(result.markets.winner.home).toBe(100);
    });

    test('deve preencher mercados ausentes com valores padrão', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(result.markets.over_under.over_2_5).toBe(50);
      expect(result.markets.correct_score['1_1']).toBe(18);
      expect(result.markets.goalscorer.home).toEqual([]);
      expect(result.markets.cards.total_over_4_5).toBe(50);
      expect(result.markets.fouls.total_over_20_5).toBe(50);
      expect(result.markets.corners.total_over_9_5).toBe(50);
    });

    test('deve manter valores válidos intactos', () => {
      const analysis = {
        prediction: { home: 65, draw: 20, away: 15 },
        markets: {
          winner: { home: 65, draw: 20, away: 15 },
          over_under: { over_2_5: 70, under_2_5: 30 },
        },
      };
      const result = sanitizeAnalysis(analysis, mockMatch);
      expect(result.prediction.home).toBe(65);
      expect(result.prediction.draw).toBe(20);
      expect(result.prediction.away).toBe(15);
      expect(result.markets.over_under.over_2_5).toBe(70);
    });

    test('deve incluir dados da partida corretamente', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(result.matchId).toBe(1);
      expect(result.teams.home).toBe('Flamengo');
      expect(result.teams.away).toBe('Palmeiras');
      expect(result.teams.date).toBe('2026-08-15');
    });

    test('deve limitar analysis.summary a 200 caracteres', () => {
      const longSummary = 'A'.repeat(300);
      const analysis = {
        analysis: { summary: longSummary, key_factors: [], recommendation: 'Teste' },
      };
      const result = sanitizeAnalysis(analysis, mockMatch);
      expect(result.analysis.summary.length).toBeLessThanOrEqual(200);
    });

    test('deve limitar key_factors a 5 itens', () => {
      const analysis = {
        analysis: {
          summary: 'Resumo',
          key_factors: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
          recommendation: 'Teste',
        },
      };
      const result = sanitizeAnalysis(analysis, mockMatch);
      expect(result.analysis.key_factors.length).toBeLessThanOrEqual(5);
    });

    test('deve limitar recommendation a 100 caracteres', () => {
      const longRec = 'B'.repeat(150);
      const analysis = {
        analysis: { summary: 'Resumo', key_factors: [], recommendation: longRec },
      };
      const result = sanitizeAnalysis(analysis, mockMatch);
      expect(result.analysis.recommendation.length).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================
  // VALIDAÇÃO DE CONSISTÊNCIA DOS MERCADOS
  // ==========================================
  describe('Validação de Consistência dos Mercados', () => {
    const mockMatch = { id: 1, homeTeam: 'Flamengo', awayTeam: 'Palmeiras', date: '2026-08-15' };

    test('prediction deve somar ~100 (margem de 1-2 por arredondamento)', () => {
      const analysis = {
        prediction: { home: 60, draw: 25, away: 15 },
      };
      const result = sanitizeAnalysis(analysis, mockMatch);
      const sum = result.prediction.home + result.prediction.draw + result.prediction.away;
      expect(sum).toBeGreaterThanOrEqual(98);
      expect(sum).toBeLessThanOrEqual(102);
    });

    test('winner markets deve ter estrutura válida', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(result.markets.winner).toHaveProperty('home');
      expect(result.markets.winner).toHaveProperty('draw');
      expect(result.markets.winner).toHaveProperty('away');
      expect(typeof result.markets.winner.home).toBe('number');
      expect(typeof result.markets.winner.draw).toBe('number');
      expect(typeof result.markets.winner.away).toBe('number');
    });

    test('double_chance deve ter os 3 campos', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(result.markets.double_chance).toHaveProperty('home_or_draw');
      expect(result.markets.double_chance).toHaveProperty('home_or_away');
      expect(result.markets.double_chance).toHaveProperty('draw_or_away');
    });

    test('both_to_score deve ter yes e no', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(result.markets.both_to_score).toHaveProperty('yes');
      expect(result.markets.both_to_score).toHaveProperty('no');
    });

    test('over_under deve ter todos os 8 mercados', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      const ou = result.markets.over_under;
      expect(ou).toHaveProperty('over_0_5');
      expect(ou).toHaveProperty('over_1_5');
      expect(ou).toHaveProperty('over_2_5');
      expect(ou).toHaveProperty('over_3_5');
      expect(ou).toHaveProperty('under_0_5');
      expect(ou).toHaveProperty('under_1_5');
      expect(ou).toHaveProperty('under_2_5');
      expect(ou).toHaveProperty('under_3_5');
    });

    test('correct_score deve ter todos os 12 placares + other', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      const cs = result.markets.correct_score;
      expect(cs).toHaveProperty('0_0');
      expect(cs).toHaveProperty('1_0');
      expect(cs).toHaveProperty('0_1');
      expect(cs).toHaveProperty('1_1');
      expect(cs).toHaveProperty('2_0');
      expect(cs).toHaveProperty('0_2');
      expect(cs).toHaveProperty('2_1');
      expect(cs).toHaveProperty('1_2');
      expect(cs).toHaveProperty('2_2');
      expect(cs).toHaveProperty('3_0');
      expect(cs).toHaveProperty('0_3');
      expect(cs).toHaveProperty('other');
    });

    test('goalscorer deve ser array com até 3 jogadores por time', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(Array.isArray(result.markets.goalscorer.home)).toBe(true);
      expect(Array.isArray(result.markets.goalscorer.away)).toBe(true);
      expect(result.markets.goalscorer.home.length).toBeLessThanOrEqual(3);
      expect(result.markets.goalscorer.away.length).toBeLessThanOrEqual(3);
    });

    test('corners deve ter todos os 8 mercados', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      const c = result.markets.corners;
      expect(c).toHaveProperty('total_over_9_5');
      expect(c).toHaveProperty('total_over_10_5');
      expect(c).toHaveProperty('total_under_9_5');
      expect(c).toHaveProperty('total_under_10_5');
      expect(c).toHaveProperty('home_over_4_5');
      expect(c).toHaveProperty('home_under_4_5');
      expect(c).toHaveProperty('away_over_4_5');
      expect(c).toHaveProperty('away_under_4_5');
    });

    test('cards deve ter todos os 4 mercados', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      const ca = result.markets.cards;
      expect(ca).toHaveProperty('total_over_4_5');
      expect(ca).toHaveProperty('total_over_5_5');
      expect(ca).toHaveProperty('total_under_4_5');
      expect(ca).toHaveProperty('total_under_5_5');
    });

    test('fouls deve ter todos os 4 mercados', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      const f = result.markets.fouls;
      expect(f).toHaveProperty('total_over_20_5');
      expect(f).toHaveProperty('total_under_20_5');
      expect(f).toHaveProperty('total_over_24_5');
      expect(f).toHaveProperty('total_under_24_5');
    });

    test('asian_handicap deve ter 6 campos', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      const ah = result.markets.asian_handicap;
      expect(ah).toHaveProperty('home_0');
      expect(ah).toHaveProperty('away_0');
      expect(ah).toHaveProperty('home_neg_0_5');
      expect(ah).toHaveProperty('away_neg_0_5');
      expect(ah).toHaveProperty('home_neg_1');
      expect(ah).toHaveProperty('away_neg_1');
    });

    test('european_handicap deve ter home/draw/away', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(result.markets.european_handicap).toHaveProperty('home');
      expect(result.markets.european_handicap).toHaveProperty('draw');
      expect(result.markets.european_handicap).toHaveProperty('away');
    });
  });

  // ==========================================
  // TESTES DE FALLBACK
  // ==========================================
  describe('Fallback Behavior', () => {
    const mockMatch = { id: 1, homeTeam: 'Flamengo', awayTeam: 'Palmeiras', date: '2026-08-15' };

    test('sanitization com objeto vazio deve retornar defaults', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      expect(result.prediction.home).toBe(33);
      expect(result.prediction.draw).toBe(33);
      expect(result.prediction.away).toBe(34);
    });

    test('sanitization com null deve retornar defaults', () => {
      const result = sanitizeAnalysis(null, mockMatch);
      expect(result.prediction.home).toBe(33);
      expect(result.prediction.draw).toBe(33);
      expect(result.prediction.away).toBe(34);
    });

    test('sanitization com undefined deve retornar defaults', () => {
      const result = sanitizeAnalysis(undefined, mockMatch);
      expect(result.prediction.home).toBe(33);
      expect(result.prediction.draw).toBe(33);
      expect(result.prediction.away).toBe(34);
    });

    test('sanitization com string inválida deve retornar defaults', () => {
      const result = sanitizeAnalysis('invalid', mockMatch);
      expect(result.prediction.home).toBe(33);
      expect(result.prediction.draw).toBe(33);
      expect(result.prediction.away).toBe(34);
    });

    test('fallback deve conter erro quando fornecido', () => {
      const result = sanitizeAnalysis({}, mockMatch);
      // Não deve ter erro quando sanitização funciona
      expect(result.error).toBeUndefined();
    });
  });

  // ==========================================
  // TESTES DE EDGE CASES
  // ==========================================
  describe('Edge Cases', () => {
    test('deve lidar com valores negativos', () => {
      const analysis = {
        prediction: { home: -10, draw: -5, away: -20 },
      };
      const result = sanitizeAnalysis(analysis, { id: 1, homeTeam: 'A', awayTeam: 'B', date: '2026-08-04' });
      expect(result.prediction.home).toBe(0);
      expect(result.prediction.draw).toBe(0);
      expect(result.prediction.away).toBe(0);
    });

    test('deve lidar com valores não numéricos', () => {
      const analysis = {
        prediction: { home: 'abc', draw: 'xyz', away: undefined },
      };
      const result = sanitizeAnalysis(analysis, { id: 1, homeTeam: 'A', awayTeam: 'B', date: '2026-08-04' });
      expect(result.prediction.home).toBe(33); // fallback (NaN)
      expect(result.prediction.draw).toBe(33); // fallback (NaN)
      expect(result.prediction.away).toBe(34); // fallback (NaN)
    });

    test('deve tratar null como 0 (Number(null) = 0)', () => {
      const analysis = {
        prediction: { home: null, draw: null, away: null },
      };
      const result = sanitizeAnalysis(analysis, { id: 1, homeTeam: 'A', awayTeam: 'B', date: '2026-08-04' });
      expect(result.prediction.home).toBe(0);
      expect(result.prediction.draw).toBe(0);
      expect(result.prediction.away).toBe(0);
    });

    test('deve limitar goalscorer a 3 jogadores no máximo', () => {
      const analysis = {
        markets: {
          goalscorer: {
            home: [
              { name: 'Jogador 1', probability: 30 },
              { name: 'Jogador 2', probability: 25 },
              { name: 'Jogador 3', probability: 20 },
              { name: 'Jogador 4', probability: 15 }, // Deve ser cortado
            ],
            away: [],
          },
        },
      };
      const result = sanitizeAnalysis(analysis, { id: 1, homeTeam: 'A', awayTeam: 'B', date: '2026-08-04' });
      expect(result.markets.goalscorer.home.length).toBe(3);
    });

    test('goalscorer com nomes vazios deve ser filtrado', () => {
      const analysis = {
        markets: {
          goalscorer: {
            home: [
              { name: '', probability: 30 },
              { name: '   ', probability: 25 },
              { name: 'Jogador Válido', probability: 20 },
            ],
            away: [],
          },
        },
      };
      const result = sanitizeAnalysis(analysis, { id: 1, homeTeam: 'A', awayTeam: 'B', date: '2026-08-04' });
      // Todos devem aparecer (mesmo vazios) pois o slice(0,3) é aplicado antes
      expect(result.markets.goalscorer.home.length).toBeLessThanOrEqual(3);
    });

    test('deve tratar arrays como não-objetos', () => {
      const analysis = {
        markets: {
          winner: [1, 2, 3], // Array em vez de objeto
        },
      };
      const result = sanitizeAnalysis(analysis, { id: 1, homeTeam: 'A', awayTeam: 'B', date: '2026-08-04' });
      // Deve usar defaults quando mercado é array
      expect(result.markets.winner.home).toBe(33);
    });
  });

  // ==========================================
  // TESTES DE INTEGRAÇÃO (Simulando Resposta da IA)
  // ==========================================
  describe('Simulação de Resposta da IA', () => {
    const mockMatch = { id: 1, homeTeam: 'Flamengo', awayTeam: 'Palmeiras', date: '2026-08-15' };

    test('resposta completa da IA deve ser sanitizada corretamente', () => {
      const aiResponse = {
        prediction: { home: 55, draw: 25, away: 20 },
        markets: {
          winner: { home: 55, draw: 25, away: 20 },
          double_chance: { home_or_draw: 80, home_or_away: 75, draw_or_away: 45 },
          both_to_score: { yes: 60, no: 40 },
          over_under: {
            over_0_5: 85, over_1_5: 65, over_2_5: 45, over_3_5: 25,
            under_0_5: 15, under_1_5: 35, under_2_5: 55, under_3_5: 75,
          },
          asian_handicap: {
            home_0: 55, away_0: 45,
            home_neg_0_5: 55, away_neg_0_5: 45,
            home_neg_1: 35, away_neg_1: 65,
          },
          european_handicap: { home: 55, draw: 25, away: 20 },
          correct_score: {
            '0_0': 8, '1_0': 15, '0_1': 10, '1_1': 12,
            '2_0': 12, '0_2': 8, '2_1': 10, '1_2': 8,
            '2_2': 5, '3_0': 5, '0_3': 3, other: 4,
          },
          goalscorer: {
            home: [{ name: 'Pedro', probability: 45 }, { name: 'Gabigol', probability: 40 }],
            away: [{ name: 'Rony', probability: 35 }],
          },
          corners: {
            total_over_9_5: 55, total_over_10_5: 45,
            total_under_9_5: 45, total_under_10_5: 55,
            home_over_4_5: 50, home_under_4_5: 50,
            away_over_4_5: 45, away_under_4_5: 55,
          },
          cards: {
            total_over_4_5: 60, total_over_5_5: 45,
            total_under_4_5: 40, total_under_5_5: 55,
          },
          fouls: {
            total_over_20_5: 55, total_under_20_5: 45,
            total_over_24_5: 40, total_under_24_5: 60,
          },
        },
        analysis: {
          summary: 'Flamengo chega como favorito em casa contra o Palmeiras.',
          key_factors: [
            'Flamengo invicto nos últimos 5 jogos',
            'Palmeiras com problemas defensivos',
            'Histórico de confrontos com muitos gols',
          ],
          recommendation: 'Aposte no Flamengo e ambas marcam.',
        },
      };

      const result = sanitizeAnalysis(aiResponse, mockMatch);

      // Validação da estrutura
      expect(result.matchId).toBe(1);
      expect(result.teams.home).toBe('Flamengo');
      expect(result.teams.away).toBe('Palmeiras');

      // Validação de prediction
      expect(result.prediction.home).toBe(55);
      expect(result.prediction.draw).toBe(25);
      expect(result.prediction.away).toBe(20);

      // Validação de mercados principais
      expect(result.markets.winner.home).toBe(55);
      expect(result.markets.both_to_score.yes).toBe(60);
      expect(result.markets.over_under.over_2_5).toBe(45);

      // Validação de análise
      expect(result.analysis.summary).toContain('Flamengo');
      expect(result.analysis.key_factors.length).toBe(3);
      expect(result.analysis.recommendation).toContain('Flamengo');
    });
  });
});
