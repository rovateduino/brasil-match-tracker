# 🇧🇷 Brasil Match Tracker

Aplicação web de alto desempenho para acompanhar partidas de futebol de clubes brasileiros.

## 🚀 Tecnologias

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **API:** API-Football (proxy com cache)

## 📦 Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/brasil-match-tracker.git
cd brasil-match-tracker
```

2. **Instale as dependências**
```bash
cd server
npm install
cd ../client
npm install
```

3. **Copie o arquivo de ambiente**
```bash
cp .env.example .env
```

4. **Configure as chaves e variáveis** no arquivo `.env`.

## 🌐 Variáveis de Ambiente

O backend utiliza as seguintes variáveis:

- `PORT` - Porta do servidor (padrão `5000`).
- `API_FOOTBALL_BASE_URL` - URL da API-Football.
- `API_FOOTBALL_DAYS_PAST` - Dias anteriores a buscar na API.
- `API_FOOTBALL_DAYS_FUTURE` - Dias futuros a buscar na API.
- `CACHE_TTL` - TTL do cache em segundos.
- `USE_DATASET` - `true` para usar o dataset local.
- `API_FOOTBALL_KEY` - Chave da API-Football.
- `GROQ_API_KEY` - Chave da API de IA GROQ.
- `GROQ_MODEL` - Modelo GROQ.
- `GEMINI_API_KEY` - Chave da API Gemini.
- `GEMINI_MODEL` - Modelo Gemini.

## 🧠 Fluxo de Chaves

- A chave `API_FOOTBALL_KEY` é salva diretamente em `.env` via endpoint de configuração.
- As chaves de IA (`GROQ_API_KEY` e `GEMINI_API_KEY`) também são gravadas em `.env`.
- O projeto ignora arquivos sensíveis como `.env` e `.api-key`.

## 🗂 Estrutura do Dataset

Os datasets locais estão em `server/data/` e seguem formato de calendário de futebol. O parser lê datas, horários, times e placares, usando heurísticas para manter histórico, forma e confrontos diretos.

## 📡 Endpoints da API

- `GET /api/competitions` - retorna competições disponíveis.
- `GET /api/matches?leagues=71,72` - retorna partidas futuras para as ligas informadas.
- `POST /api/settings/api-key` - salva a chave da API-Football.
- `GET /api/settings/api-key/status` - verifica se a chave de API está configurada.
- `GET /api/settings/ai` - retorna o status das chaves de IA.
- `POST /api/settings/ai` - salva as configurações de IA.
- `POST /api/analysis` - gera análise de partidas via IA.

## 📄 Documentação da API
Veja `API.md` para detalhes de cada endpoint.
