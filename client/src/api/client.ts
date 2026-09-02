import axios from 'axios';
import { Match, Competition, MatchAnalysis, AiSettingsStatus } from '@/types';

const rawBase = import.meta.env.VITE_API_BASE_URL || '/api';
const baseURL = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

const errorMessages: Record<string, string> = {
  'ECONNREFUSED': 'Servidor offline. Verifique sua conexão.',
  '401': 'Chave de API inválida ou expirada.',
  '403': 'Acesso negado. Verifique suas credenciais.',
  '404': 'Dados não encontrados.',
  '429': 'Muitas requisições. Aguarde um momento.',
  '500': 'Erro interno no servidor. Tente novamente.',
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Erro inesperado. Tente novamente.';
    if (axios.isAxiosError(error)) {
      const status = String(error.response?.status || '');
      const data = error.response?.data as { error?: string } | undefined;
      if (data?.error) {
        message = data.error;
      } else if (status && errorMessages[status]) {
        message = errorMessages[status];
      } else if (error.code === 'ERR_NETWORK') {
        message = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 5000.';
      } else if (error.message) {
        message = error.message;
      }
    }
    return Promise.reject(new Error(message));
  }
);

export const fetchMatches = async (competitionIds: number[]): Promise<Match[]> => {
  const params = new URLSearchParams();
  competitionIds.forEach(id => params.append('leagues', String(id)));
  const { data } = await api.get<Match[]>(`/matches?${params.toString()}`);
  return data;
};

export const fetchCompetitions = async (): Promise<Competition[]> => {
  const { data } = await api.get<Competition[]>('/competitions');
  return data;
};

export const saveApiKey = async (key: string): Promise<void> => {
  await api.post('/settings/api-key', { apiKey: key });
};

export const getApiKeyStatus = async (): Promise<{ hasKey: boolean }> => {
  const { data } = await api.get('/settings/api-key/status');
  return data;
};

export const analyzeMatch = async (match: Match): Promise<MatchAnalysis> => {
  const { data } = await api.post<MatchAnalysis[]>('/analysis', { matches: [match] });
  return data[0];
};

export const getAiSettings = async (): Promise<AiSettingsStatus> => {
  const { data } = await api.get('/settings/ai');
  return data;
};

export const saveAiSettings = async (payload: {
  groqKey?: string;
  groqModel?: string;
  geminiKey?: string;
  geminiModel?: string;
}): Promise<void> => {
  await api.post('/settings/ai', payload);
};