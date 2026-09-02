import { useEffect, useState } from 'react';
import { fetchMatches, fetchCompetitions } from '@/api/client';
import { Match, Competition } from '@/types';
import MatchList from '@/components/MatchList';
import CompetitionFilter from '@/components/CompetitionFilter';
import { parseDate } from '@/utils/helpers';

export default function Dashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar lista de competições disponíveis
  useEffect(() => {
    fetchCompetitions()
      .then((data) => {
        setCompetitions(data);
        // Selecionar todas por padrão
        setSelectedIds(data.map((c) => c.id));
      })
      .catch(() => setError('Erro ao carregar competições.'));
  }, []);

  // Carregar partidas quando seleção mudar
  useEffect(() => {
    if (selectedIds.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchMatches(selectedIds)
      .then((data) => {
        // Filtro defensivo: apenas partidas a partir de hoje e não finalizadas
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = data.filter((match) => {
          if (match.status === 'finished') return false;
          return parseDate(match.date).getTime() >= today.getTime();
        });
        setMatches(upcoming);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Erro ao buscar partidas.');
        setLoading(false);
      });
  }, [selectedIds]);

  const liveCount = matches.filter((m) => m.status === 'live').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Partidas</h2>
          <span className="text-xs px-3 py-1 bg-accent/10 text-accent rounded-full font-medium">
            Futuras
          </span>
        </div>
        <span className="text-sm text-text-secondary">
          {matches.length} jogo{matches.length !== 1 ? 's' : ''} futuros
          {liveCount > 0 && ` · ${liveCount} ao vivo`}
        </span>
      </div>

      <CompetitionFilter
        available={competitions}
        selected={selectedIds}
        onChange={setSelectedIds}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-card text-sm">
          <p className="font-medium">Erro ao carregar partidas</p>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!error && <MatchList matches={matches} loading={loading} />}
    </div>
  );
}