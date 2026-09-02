import { useState, useEffect } from 'react';
import { saveApiKey, getApiKeyStatus, getAiSettings, saveAiSettings } from '@/api/client';
import { AiSettingsStatus } from '@/types';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  const [aiStatus, setAiStatus] = useState<AiSettingsStatus | null>(null);
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [aiMessage, setAiMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    getApiKeyStatus()
      .then(({ hasKey }) => setHasKey(hasKey))
      .catch(() => setHasKey(false));
    getAiSettings()
      .then((status) => {
        setAiStatus(status);
        setGroqModel(status.groq.model);
        setGeminiModel(status.gemini.model);
      })
      .catch(() => setAiStatus(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setMessage({ text: 'Insira uma chave de API válida.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await saveApiKey(apiKey.trim());
      setHasKey(true);
      setApiKey('');
      setMessage({ text: 'Chave de API salva com sucesso!', type: 'success' });
    } catch (err) {
      setMessage({ text: 'Erro ao salvar a chave. Tente novamente.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groqKey.trim() && !geminiKey.trim()) {
      setAiMessage({ text: 'Insira ao menos uma chave de IA.', type: 'error' });
      return;
    }
    setAiLoading(true);
    setAiMessage(null);
    try {
      await saveAiSettings({
        groqKey: groqKey.trim(),
        groqModel: groqModel.trim(),
        geminiKey: geminiKey.trim(),
        geminiModel: geminiModel.trim(),
      });
      setGroqKey('');
      setGeminiKey('');
      setAiMessage({ text: 'Configurações de IA salvas no arquivo .env!', type: 'success' });
      const status = await getAiSettings();
      setAiStatus(status);
    } catch (err) {
      setAiMessage({ text: 'Erro ao salvar as configurações de IA.', type: 'error' });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>

      <div className="bg-card-bg rounded-card border border-card-border p-6">
        <h3 className="text-lg font-medium mb-2">Chave da API-Football</h3>
        <p className="text-sm text-text-secondary mb-4">
          Insira sua chave de acesso para consumir os dados das partidas.
          A chave fica armazenada apenas no servidor e nunca é enviada ao cliente.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? 'Chave atual (oculta)' : 'Digite sua chave...'}
              className="w-full px-4 py-2 border border-card-border rounded-card bg-soft-gray text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="px-6 py-2 bg-accent text-white rounded-card font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Salvar Chave'}
          </button>
        </form>

        {message && (
          <div
            className={`mt-4 px-4 py-3 rounded-card text-sm ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-4 text-sm text-text-secondary">
          Status: {hasKey ? (
            <span className="text-green-600 font-medium">✓ Chave configurada</span>
          ) : (
            <span className="text-red-500 font-medium">✗ Nenhuma chave definida</span>
          )}
        </div>
      </div>

      <div className="bg-card-bg rounded-card border border-card-border p-6">
        <h3 className="text-lg font-medium mb-2">IA de Análise de Partidas</h3>
        <p className="text-sm text-text-secondary mb-4">
          Configure a IA que gera os palpites. A GROQ é a principal; a Gemini é usada
          como fallback. As chaves são gravadas automaticamente no arquivo <code className="text-text-secondary bg-soft-gray px-1 py-0.5 rounded">.env</code> do servidor.
        </p>

        <form onSubmit={handleSaveAi} className="space-y-5">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="groqKey" className="block text-sm font-medium">GROQ API Key</label>
                <span className={`text-xs ${aiStatus?.groq.hasKey ? 'text-green-600' : 'text-red-500'}`}>
                  {aiStatus?.groq.hasKey ? '✓ Configurada' : '✗ Não definida'}
                </span>
              </div>
              <input
                id="groqKey"
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder={aiStatus?.groq.hasKey ? 'Chave atual (oculta)' : 'gsk_...'}
                className="w-full px-4 py-2 border border-card-border rounded-card bg-soft-gray text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label htmlFor="groqModel" className="block text-sm font-medium mb-1">Modelo GROQ</label>
              <input
                id="groqModel"
                type="text"
                value={groqModel}
                onChange={(e) => setGroqModel(e.target.value)}
                placeholder="llama-3.3-70b-versatile"
                className="w-full px-4 py-2 border border-card-border rounded-card bg-soft-gray text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="geminiKey" className="block text-sm font-medium">Gemini API Key (fallback)</label>
                <span className={`text-xs ${aiStatus?.gemini.hasKey ? 'text-green-600' : 'text-red-500'}`}>
                  {aiStatus?.gemini.hasKey ? '✓ Configurada' : '✗ Não definida'}
                </span>
              </div>
              <input
                id="geminiKey"
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={aiStatus?.gemini.hasKey ? 'Chave atual (oculta)' : 'AIza...'}
                className="w-full px-4 py-2 border border-card-border rounded-card bg-soft-gray text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label htmlFor="geminiModel" className="block text-sm font-medium mb-1">Modelo Gemini</label>
              <input
                id="geminiModel"
                type="text"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                placeholder="gemini-1.5-flash"
                className="w-full px-4 py-2 border border-card-border rounded-card bg-soft-gray text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={aiLoading || (!groqKey.trim() && !geminiKey.trim())}
            className="px-6 py-2 bg-accent text-white rounded-card font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiLoading ? 'Salvando...' : 'Salvar Configurações de IA'}
          </button>
        </form>

        {aiMessage && (
          <div
            className={`mt-4 px-4 py-3 rounded-card text-sm ${
              aiMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {aiMessage.text}
          </div>
        )}
      </div>

      <div className="bg-card-bg rounded-card border border-card-border p-6">
        <h3 className="text-lg font-medium mb-2">Sobre</h3>
        <p className="text-sm text-text-secondary">
          Brasil Match Tracker usa a API-Football para fornecer dados em tempo real.
          As requisições são cacheadas no servidor para reduzir o consumo de taxa.
        </p>
      </div>
    </div>
  );
}