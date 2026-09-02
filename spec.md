# Auditoria Técnica - Brasil Match Tracker

> Documento vivo. Atualizado em 05/08/2026 para refletir a expansão dos mercados de apostas,
> correções de integração com GROQ/Gemini e o estado atual de testes.

## 1. Visão Geral do Projeto

`brasil-match-tracker` é uma aplicação web full-stack para acompanhar partidas de futebol brasileiras
com suporte a análise de IA para palpites de apostas. O projeto combina:

- Frontend React 18 + TypeScript + Vite + Tailwind CSS
- Backend Express + TypeScript
- Integração com API-Football e dataset local de partidas
- Mecanismo de análise com GROQ (primário) e Gemini (fallback)
- Cache em memória para requisições de partidas e análises
- **11 mercados de apostas** gerados por IA (ver §4)

## 2. Arquitetura e Fluxo

### 2.1 Frontend

- `client/src/App.tsx`: Roteamento com `react-router-dom` (Dashboard e Settings).
- `client/src/routes/Dashboard.tsx`: Carrega competições e partidas, mantém filtros, loading e erro.
- `client/src/routes/Settings.tsx`: Gerencia API key e configurações de IA (GROQ/Gemini).
- `client/src/components/MatchCard.tsx`: Exibe partida, estado, botão "Palpites IA" e renderiza `AnalysisPanel`.
- `client/src/components/AnalysisPanel.tsx`: Renderiza resumo, resultado previsto, fatores-chave,
  recomendação e todos os mercados em grid responsivo com toggle "Ver todos os mercados".
- `client/src/components/MarketCard`: (dentro de `AnalysisPanel`) card reutilizável de mercado.
- `client/src/components/MatchList.tsx`, `CompetitionFilter.tsx`, `Layout.tsx`: agrupamento por data,
  filtro de competições e layout.
- `client/src/api/client.ts`: cliente Axios com interceptor de erros amigáveis.
- `client/src/types/index.ts`: contratos de tipos (inclui `MatchMarkets` e novo `MatchAnalysis`).
- `client/src/utils/helpers.ts`: parse/format de datas e agrupamento.

### 2.2 Backend

- `server/src/index.ts`: servidor Express, CORS restrito, `express-rate-limit`, rotas, inicialização.
- `server/src/proxy.ts`: chamadas à API-Football, combinação com dataset local, dedupe e cache.
- `server/src/ai.ts`: prompts, chamadas a GROQ/Gemini, extração e sanitização de JSON, cache.
- `server/src/dataset.ts`: parse de arquivos `.txt` e geração de forma, H2H, classificação e estatísticas estruturadas.
- `server/src/cache.ts`: cache em memória com TTL.
- `server/src/envFile.ts`: grava/atualiza variáveis no `.env` (API-Football e chaves de IA).
- `server/src/validateEnv.ts`: valida variáveis obrigatórias no boot.
- `server/src/metrics.ts`: métrica simples de latência via log.
- `server/src/logger.ts`: logger JSON estruturado.
- `server/src/types.ts`: tipos das respostas da API-Football.

## 3. Mudanças Recentes (05/08/2026)

### 3.1 Correções de integração de IA

- **URL da GROQ corrigida**: `https://api.groq.com/v1/llm/chat/completions` → `https://api.groq.com/openai/v1/chat/completions`.
  A URL anterior retornava **404**.
- **URL da Gemini corrigida**: `https://generativelanguage.googleapis.com/v1beta2/models` → `.../v1beta/models`.
  O namespace `v1beta2` não existe e retornava **404**.
- **Import faltante**: `updateEnvFile` era usado em `index.ts` sem import — `npm run build` quebrava.
  Adicionado `import { updateEnvFile } from './envFile'`.

> Nota operacional: antes da correção, `server/src/ai.ts` e `server/dist/ai.js` estavam divergentes
> (o `dist` já continha as URLs corretas). Isso ocorre porque `dist/` é gerado pelo build e não deve
> ser editado manualmente nem usado como fonte de verdade — sempre alterar `src/` e rebuildar.

### 3.2 Expansão dos mercados de apostas

A análise de IA deixou de cobrir apenas escanteios/gols/faltas/cartões e passou a cobrir **11 mercados**:

| Categoria | Mercado |
|---|---|
| Resultado | Vencedor 1x2 (`winner`) |
| Gols | Total Over/Under (`over_under`) |
| Ambas Marcam | Sim/Não (`both_to_score`) |
| Chance Dupla | 1X / 12 / X2 (`double_chance`) |
| Handicap | Asiático (`asian_handicap`) e Europeu 1x2 (`european_handicap`) |
| Placar Exato | 11 placares + "Outros" (`correct_score`) |
| Artilheiro | Até 3 jogadores por time (`goalscorer`) |
| Escanteios | Total e por time (`corners`) |
| Cartões | Total (`cards`) |
| Faltas | Total (`fouls`) |

### 3.3 Frontend

- Novos tipos em `client/src/types/index.ts` (`MatchMarkets`, `GoalscorerEntry`, `MatchAnalysis`).
- `AnalysisPanel` reescrito: `MarketCard`, toggle de detalhes, grid responsivo `2/3 colunas`.
- **Todos os rótulos em português**: "Mais de / Menos de" (substituindo Over/Under), "Casa/Fora"
  (substituindo Home/Away), "empate devolve" (substituindo DNB). Mantidos apenas códigos técnicos
  padrão de casa de apostas (1X/12/X2, -0.5, -1).

### 3.4 Backend (IA)

- Novo `SYSTEM_PROMPT` com a estrutura JSON completa dos 11 mercados.
- Novo modelo de dados: `prediction { home, draw, away }`, `markets` aninhado e
  `analysis { summary, key_factors, recommendation }`.
- `sanitizeAnalysis` + `mergeMarkets`: clampa valores em 0–100 e preenche defaults para mercados ausentes.
- `createFallback` para o caso de GROQ e Gemini falharem.
- `max_tokens`/`maxOutputTokens` aumentados para 2500 (resposta maior).

### 3.5 Backend (Dataset)

- Novas funções estruturadas: `getTeamDetailedStats`, `getHeadToHeadMatches`, `getStandingsTable`.
- Contexto da IA agora inclui classificação, últimos jogos com médias de gols, H2H com média de gols.

### 3.6 Testes

- `server/src/__tests__/ai.test.ts` atualizado para a nova estrutura (extração de JSON, sanitização, defaults).

## 4. Modelo de Dados da Análise

`POST /api/analysis` retorna um array com a seguinte estrutura (após sanitização):

```json
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
    "summary": "Resumo em 2-3 frases...",
    "key_factors": ["Fator 1", "Fator 2"],
    "recommendation": "Recomendação principal..."
  }
}
```

Regras de sanitização:
- Todos os valores numéricos são inteiros entre **0 e 100** (função `clampPercent`).
- Mercados não preenchidos pela IA recebem **defaults** (`DEFAULT_MARKETS` + `mergeMarkets`).
- `goalscorer` aceita até 3 entradas por time; nomes são limitados a 40 caracteres.
- `summary` ≤ 200 caracteres, `recommendation` ≤ 100, `key_factors` ≤ 5 itens.

## 5. Pontos de Força

### 5.1 Integração híbrida de dados

- API-Football para dados atuais + dataset local (`br1_2026.txt`, `br2_2025.txt`, `brcup_2025.txt`)
  para rodadas futuras e histórico. Estratégia robusta para o plano grátis da API.

### 5.2 Análise de IA com fallback

- GROQ primário, Gemini como fallback.
- Timeout de 30s por chamada, cache de 600s por partida.
- JSON extraído e sanitizado; fallback estruturado se ambos falharem.

### 5.3 Robustez do modelo de mercados

- `mergeMarkets` garante que a resposta sempre tenha a estrutura completa, mesmo com dados parciais.
- Valores sempre no intervalo 0–100 (defesa contra alucinação de números fora do intervalo).

### 5.4 Segurança básica

- CORS restrito a `localhost:5173` (dev) e a uma origem configurável (prod).
- `.env` e `.api-key` no `.gitignore`; chaves nunca enviadas ao cliente.
- `express-rate-limit` global (100 req/15min por IP).

### 5.5 Separação de responsabilidades e testes

- Frontend focado em UI; backend em dados, IA e persistência.
- 3 suítes de teste no backend (8 testes): parser/normalização do dataset, proxy/dedupe e IA.

## 6. Auditoria Detalhada por Componente

### 6.1 `server/src/index.ts`

- `dotenv.config()` no topo; `validateEnv` validando `PORT`, `API_FOOTBALL_BASE_URL`,
  `API_FOOTBALL_DAYS_PAST`, `API_FOOTBALL_DAYS_FUTURE`, `CACHE_TTL`.
- Middlewares: CORS, JSON, request id (UUID), log de request, latência.
- Rate limit global: 100 req / 15 min / IP.
- Validação Zod em `/api/settings/api-key` e `/api/settings/ai`.
- Rotas: `GET /api/settings/api-key/status`, `POST /api/settings/api-key`,
  `GET /api/competitions`, `GET /api/matches`, `GET/POST /api/settings/ai`,
  `POST /api/analysis` (máx. 10 partidas).
- `loadDataset()` apenas se `USE_DATASET !== 'false'`.

### 6.2 `server/src/proxy.ts`

- `createApiClient()` com headers `x-rapidapi-key`, `x-rapidapi-host` e `x-apisports-key`.
- Consulta por data (sem `season`), variando de `API_FOOTBALL_DAYS_PAST` até `API_FOOTBALL_DAYS_FUTURE`.
- Dedupe por `date|homeTeam|awayTeam` entre API e dataset.
- `filterFutureMatches` descarta finalizadas e datas passadas.
- `mapStatus` mapeia status da API para `scheduled | live | finished`.
- **Observação**: as chamadas diárias são **sequenciais**; o plano grátis retorna 403 fora da janela
  permitida — erros são acumulados e propagados apenas se nenhuma partida for obtida.

### 6.3 `server/src/ai.ts`

- `SYSTEM_PROMPT` com a estrutura JSON dos 11 mercados.
- `buildContext` usa `getTeamDetailedStats`, `getHeadToHeadMatches`, `getStandingsTable` e instrui o
  modelo a estimar escanteios/cartões/faltas quando não houver dados.
- `callGroq` / `callGemini`: URLs corretas, timeout 30s, `max_tokens`/`maxOutputTokens` 2500.
- `extractJson`: aceita resposta crua ou bloco ```json```; lança erro se não houver `{...}`.
- `clampPercent`, `mergeMarkets`, `sanitizeAnalysis`, `createFallback`, `analyzeMatch`, `analyzeMatches`.
- Cache de análise: TTL 600s.

### 6.4 `server/src/dataset.ts`

- Parse de arquivos openfootball/customizados (datas, horários, `v`, placares).
- `loadDataset()` carrega apenas arquivos presentes em `data/`.
- `getTeamForm` / `getHeadToHead` / `getStandings` (strings, uso legado).
- **Novas funções estruturadas**: `getTeamDetailedStats` (média de gols, clean sheets, ambas marcaram,
  aproveitamento), `getHeadToHeadMatches`, `getStandingsTable`.
- `normalizeTeamName` remove acentos e caracteres não alfanuméricos; `findTeam` faz match por palavras ≥ 3 letras.
- `hashId` gera id determinístico por `liga|data|hora|casa|fora`.

### 6.5 `server/src/envFile.ts` / `cache.ts` / `logger.ts` / `metrics.ts` / `validateEnv.ts`

- `envFile`: reescreve `.env` preservando outras chaves e atualiza `process.env` em memória.
- `cache`: Map com TTL global `CACHE_TTL` (default 300s) e TTL por chamada.
- `logger`: JSON estruturado em `console.log`.
- `metrics`: registra latência via log DEBUG.
- `validateEnv`: `process.exit(1)` se faltarem variáveis obrigatórias.

### 6.6 `client/src/components/AnalysisPanel.tsx`

- Exibe erro, resumo, resultado previsto, fatores-chave e recomendação.
- Toggle "Ver todos os mercados" → grid `2 cols (mobile) / 3 cols (md+)` de `MarketCard`s.
- Cards: Resultado, Chance Dupla, Ambas Marcam, Gols (Mais/Menos), Handicap Asiático, Handicap Europeu,
  Placar Exato, Artilheiro (casa/fora, condicional), Escanteios, Cartões, Faltas.
- Fim do card: aviso de risco ("Aposte com responsabilidade").

## 7. Riscos e Vulnerabilidades

### 7.1 Segurança de chaves (crítico)

- **Chaves reais de GROQ e Gemini estão em texto plano em `server/.env`.** O `.gitignore` evita commit,
  mas qualquer pessoa com acesso ao servidor lê o arquivo; e os endpoints `/api/settings/*` gravam
  chaves em runtime sem autenticação.
- Os endpoints de configuração e `/api/analysis` **não possuem autenticação**. Qualquer host com acesso
  ao backend pode trocar chaves e consumir créditos de IA (custo) usando a conta configurada.

### 7.2 CORS e produção

- Em produção, `allowedOrigins = ['https://seu-dominio.com']` — **placeholder**, precisa ser trocado.
- CORS não protege contra chamadas server-side (curl); apenas navegadores.

### 7.3 Dados de mercados por estimativa

- **Escanteios, cartões, faltas e artilheiros não existem no dataset** — são estimativas do modelo de IA.
- O mercado **Artilheiro (goalscorer)** depende inteiramente do conhecimento geral do modelo e pode
  **alucinar jogadores** (nome/posição/status de lesão). Risco alto de informações incorretas.
- `max_tokens: 2500`: se a resposta do modelo exceder o limite, o JSON é truncado e `extractJson` falha,
  caindo para Gemini/fallback.

### 7.4 Cache de análise

- Cache de 600s **não invalida** quando a partida muda de status (scheduled → live → finished) ou
  quando o placar parcial muda. Análise pode ficar "congelada" temporariamente.

### 7.5 Robustez do dataset

- Parser por heurísticas de regex (formato específico) — mudanças no formato dos arquivos quebram o parse.
- `hashId` pode colidir teoricamente; impacto baixo.
- Time sem correspondência exata em `findTeam` pode ficar sem contexto estatístico.

### 7.6 Qualidade e tooling

- **Não há linter nem formatador** configurado (server e client) e não há typecheck no script `dev`.
- Sem testes no frontend.
- `dist/` no `.gitignore` é bom, mas exige que o build rode no deploy; há histórico de divergência src/dist.

### 7.7 Documentação

- `API.md`: o exemplo de resposta de `POST /api/analysis` estava **desatualizado** (estrutura antiga).
  **Corrigido nesta revisão.**
- `README.md`: não lista `DATASET_DAYS_PAST` / `DATASET_DAYS_FUTURE` (usados no runtime).

## 8. Possíveis Melhorias

### 8.1 Prioridade alta

1. **Autenticação nos endpoints sensíveis**: adicionar um token/API key próprio do app em
   `/api/settings/*` e `/api/analysis` para impedir uso não autorizado das chaves e consumo de créditos.
2. **Forçar JSON válido nas respostas da IA**: GROQ suporta `response_format: { type: 'json_object' }`
   e Gemini suporta `response_mime_type: 'application/json'`. Isso elimina a maior parte das falhas de
   parse e reduz o risco de truncamento.
3. **Teste de conectividade das chaves**: antes de gravar uma chave de IA, chamar um endpoint de teste
   (ex.: `GET /v1/models` na GROQ) e informar imediatamente se a chave é inválida (hoje o 401 só aparece
   ao gerar análise).
4. **Validar resposta da IA com Zod**: criar schema Zod do `MatchAnalysis` no backend e usá-lo no
   `sanitizeAnalysis` (hoje a sanitização é manual).
5. **CORS de produção**: substituir o placeholder por variável de ambiente `CLIENT_ORIGIN`.

### 8.2 Prioridade média

6. **Concorrência no `fetchMatches`**: executar as consultas por dia em paralelo (`Promise.all`) para
   reduzir a latência de até 15 chamadas sequenciais.
7. **Invalidação de cache de análise**: ao detectar mudança de status (partida ao vivo), expirar o cache
   da análise daquela partida.
8. **Dados reais de estatísticas**: incluir arquivos no dataset com escanteios/cartões/faltas/artilheiros
   (ou ampliar a assinatura paga da API) para alimentar os mercados com dados, reduzindo alucinação.
9. **Regenerar análise no frontend**: botão para re-analisar (hoje o card trava após a primeira análise).
10. **`LOG_LEVEL` configurável** e rota `GET /health`.

### 8.3 Prioridade baixa / qualidade

11. **Lint e format**: adicionar ESLint + Prettier nos dois pacotes e `typecheck` no `dev`.
12. **Testes no frontend**: Vitest + Testing Library para `AnalysisPanel` (mercados ausentes, toggle, erro).
13. **CI (GitHub Actions)**: build + testes nos dois pacotes a cada push/PR.
14. **Rate limit específico** para `/api/analysis` (ex.: quota por IP por hora) além do global.
15. **`README`**: documentar `DATASET_DAYS_*`, `GROQ_URL` (opcional) e o fluxo de rotacionamento de chaves.
16. **Skeleton de loading** para os cards de mercado durante a geração da análise.

## 9. Testes

| Suíte | Cobertura | Status |
|---|---|---|
| `server/src/__tests__/dataset.test.ts` | `normalizeTeamName`, `parseMatch` | ✅ |
| `server/src/__tests__/proxy.test.ts` | dedupe, uso de dataset, status | ✅ |
| `server/src/__tests__/ai.test.ts` | `extractJson`, `sanitizeAnalysis` (clamp + defaults) | ✅ |

Comandos:
- `cd server && npm run build && npm test`
- `cd client && npm run build` (typecheck `tsc` + bundle `vite`)

**Gaps de cobertura**: `mergeMarkets` com dados parciais, `createFallback`, `buildContext` sem dataset,
`getTeamDetailedStats`/`getStandingsTable`, validação Zod dos endpoints, `mapStatus` com todos os status.

## 10. Conclusão

O projeto tem arquitetura clara, boa divisão frontend/backend, estratégia inteligente de dados híbridos
e agora um modelo de análise de apostas **completo (11 mercados)**, com sanitização defensiva e testes
no backend. As integrações de IA foram corrigidas (URLs e import) e o frontend está 100% em português.

Para um lançamento confiável, priorizar:

1. **Autenticação** nos endpoints de configuração e análise.
2. **Forçar JSON válido** na resposta dos modelos (elimina fallbacks desnecessários).
3. **Dados reais** para escanteios/cartões/faltas/artilheiros.
4. **CORS de produção** e **rotação de chaves**.
5. **CI + lint + testes de frontend**.

---

Esta auditoria foi gerada a partir da análise do código atual em `client/` e `server/` e das correções
aplicadas em 05/08/2026.
