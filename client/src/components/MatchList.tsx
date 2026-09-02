import { Match } from '@/types';
import MatchCard from './MatchCard';
import { groupMatchesByDate, parseDate } from '@/utils/helpers';

interface MatchListProps {
  matches: Match[];
  loading?: boolean;
}

export default function MatchList({ matches, loading }: MatchListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p className="text-lg">Nenhuma partida encontrada</p>
        <p className="text-sm">Selecione ao menos uma competição para acompanhar.</p>
      </div>
    );
  }

  const grouped = groupMatchesByDate(matches);
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <section key={date}>
          <h2 className="text-sm font-medium text-text-secondary mb-3">
            {parseDate(date).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="space-y-3">
            {grouped[date].map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}