# API Documentation

## GET /api/competitions
Retorna lista de competições disponíveis.

### Response
```json
[
  { "id": 71, "name": "Brasileirão Série A", "type": "national", "country": "Brazil" },
  ...
]
```

## GET /api/matches?leagues=71,72
Retorna partidas futuras para as ligas especificadas.

### Query Parameters
- `leagues` - lista de IDs de competição separadas por vírgula.

### Response
```json
[
  {
    "id": 12345,
    "homeTeam": "Team A",
    "awayTeam": "Team B",
    "date": "2026-08-12",
    "time": "19:30",
    "league": "Brasileirão Série A",
    "leagueId": 71,
    "status": "scheduled",
    "round": "Rodada 20"
  }
]
```

## POST /api/settings/api-key
Atualiza a chave da API-Football.

### Body
```json
{ "apiKey": "sua_chave_api_football" }
```

### Response
```json
{ "success": true }
```

## GET /api/settings/api-key/status
Retorna se a chave da API-Football está configurada.

### Response
```json
{ "hasKey": true }
```

## GET /api/settings/ai
Retorna o status das configurações de IA.

### Response
```json
{
  "groq": { "hasKey": true, "model": "llama-3.3-70b-versatile" },
  "gemini": { "hasKey": false, "model": "gemini-1.5-flash" }
}
```

## POST /api/settings/ai
Atualiza as chaves e modelos de IA.

### Body
```json
{
  "groqKey": "sua_chave_groq",
  "groqModel": "llama-3.3-70b-versatile",
  "geminiKey": "sua_chave_gemini",
  "geminiModel": "gemini-1.5-flash"
}
```

### Response
```json
{ "success": true }
```

## POST /api/analysis
Gera análise de IA para partidas.

### Body
```json
{ "matches": [ { "id": 12345, "homeTeam": "Time A", "awayTeam": "Time B", "date": "2026-08-12", "time": "19:30", "league": "Brasileirão Série A", "leagueId": 71, "status": "scheduled" } ] }
```

### Response
```json
[
  {
    "matchId": 12345,
    "teams": { "home": "Time A", "away": "Time B", "date": "2026-08-12" },
    "prediction": { "home": 45, "draw": 28, "away": 27 },
    "markets": {
      "winner": { "home": 45, "draw": 28, "away": 27 },
      "double_chance": { "home_or_draw": 73, "home_or_away": 72, "draw_or_away": 55 },
      "both_to_score": { "yes": 60, "no": 40 },
      "over_under": { "over_0_5": 90, "over_1_5": 70, "over_2_5": 50, "over_3_5": 30, "under_0_5": 10, "under_1_5": 30, "under_2_5": 50, "under_3_5": 70 },
      "asian_handicap": { "home_0": 45, "away_0": 27, "home_neg_0_5": 45, "away_neg_0_5": 27, "home_neg_1": 30, "away_neg_1": 18 },
      "european_handicap": { "home": 45, "draw": 28, "away": 27 },
      "correct_score": { "0_0": 10, "1_0": 15, "0_1": 12, "1_1": 18, "2_0": 10, "0_2": 8, "2_1": 10, "1_2": 8, "2_2": 5, "3_0": 5, "0_3": 3, "other": 6 },
      "goalscorer": { "home": [{ "name": "Jogador X", "probability": 55 }], "away": [] },
      "corners": { "total_over_9_5": 50, "total_over_10_5": 40, "total_under_9_5": 50, "total_under_10_5": 60, "home_over_4_5": 50, "home_under_4_5": 50, "away_over_4_5": 50, "away_under_4_5": 50 },
      "cards": { "total_over_4_5": 50, "total_over_5_5": 40, "total_under_4_5": 50, "total_under_5_5": 60 },
      "fouls": { "total_over_20_5": 50, "total_under_20_5": 50, "total_over_24_5": 40, "total_under_24_5": 60 }
    },
    "analysis": {
      "summary": "Resumo da análise em 2-3 frases...",
      "key_factors": ["Fator 1", "Fator 2"],
      "recommendation": "Recomendação principal"
    }
  }
]
```

> Todos os valores de probabilidade são inteiros entre 0 e 100. Mercados ausentes na resposta do
> modelo são preenchidos com valores padrão no servidor.
