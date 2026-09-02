import { useState } from 'react';
import { Match, MatchAnalysis } from '@/types';
import { formatDate, isToday } from '@/utils/helpers';
import { analyzeMatch } from '@/api/client';
import AnalysisPanel from './AnalysisPanel';

interface MatchCardProps {
  match: Match;
}

export default function MatchCard({ match }: MatchCardProps) {
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'scheduled';
  const displayDate = isToday(match.date) ? 'Hoje' : formatDate(match.date);

  const handleAnalyze = async () => {
    if (analysis) return;
    setLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      setAnalysis(await analyzeMatch(match));
    } catch (err: any) {
      setAnalysisError(err.message || 'Erro ao gerar análise.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <div className="bg-card-bg rounded-card border border-card-border p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-text-secondary whitespace-nowrap">
            {displayDate}
            {match.time ? ` • ${match.time}` : ''}
          </span>
          <span className="text-xs px-2 py-0.5 bg-soft-gray rounded-full text-text-secondary">
            {match.league}
          </span>
        </div>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-live-dot">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live-dot opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-live-dot"></span>
            </span>
            Ao Vivo
          </span>
        )}
        {isUpcoming && (
          <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
            Em breve
          </span>
        )}
        {isFinished && (
          <span className="text-xs font-medium text-text-secondary">Finalizado</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold truncate">{match.homeTeam}</p>
        </div>
        <div className="flex items-center gap-3 text-lg font-bold">
          {isFinished || isLive ? (
            <>
              <span>{match.homeScore ?? '-'}</span>
              <span className="text-text-secondary">×</span>
              <span>{match.awayScore ?? '-'}</span>
            </>
          ) : (
            <span className="text-sm font-normal text-text-secondary">vs</span>
          )}
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-base font-semibold truncate">{match.awayTeam}</p>
        </div>
      </div>

      {match.round && (
        <div className="mt-1 text-xs text-text-secondary">{match.round}</div>
      )}

      {isUpcoming && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loadingAnalysis}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-soft-gray text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAnalysis ? (
              <>
                <span className="animate-spin h-3 w-3 border-2 border-text-secondary border-t-transparent rounded-full"></span>
                Analisando...
              </>
            ) : (
              'Palpites IA'
            )}
          </button>
          {analysisError && (
            <span className="text-xs text-red-600">{analysisError}</span>
          )}
        </div>
      )}

      {analysis && <AnalysisPanel analysis={analysis} />}
    </div>
  );
}