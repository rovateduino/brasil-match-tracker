import { useState } from 'react';
import { MatchAnalysis } from '@/types';

interface MarketItem {
  label: string;
  value: number;
}

interface MarketCardProps {
  title: string;
  items: MarketItem[];
}

function MarketCard({ title, items }: MarketCardProps) {
  return (
    <div className="bg-soft-gray rounded-card p-3">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span className="text-text-secondary">{item.label}</span>
            <span className="font-medium">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function entryRows(entries: { name: string; probability: number }[]): MarketItem[] {
  return entries.map((entry) => ({ label: entry.name, value: entry.probability }));
}

function scoreLabel(key: string): string {
  const map: Record<string, string> = {
    '0_0': '0x0', '1_0': '1x0', '0_1': '0x1', '1_1': '1x1',
    '2_0': '2x0', '0_2': '0x2', '2_1': '2x1', '1_2': '1x2',
    '2_2': '2x2', '3_0': '3x0', '0_3': '0x3', other: 'Outros',
  };
  return map[key] || key.replace('_', 'x');
}

interface AnalysisPanelProps {
  analysis: MatchAnalysis;
}

export default function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (analysis.error) {
    return (
      <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-card text-sm">
        Não foi possível gerar a análise: {analysis.error}
      </div>
    );
  }

  const { prediction, markets } = analysis;
  const favorite = prediction.home >= prediction.draw && prediction.home >= prediction.away
    ? `Mandante (${prediction.home}%)`
    : prediction.away >= prediction.home && prediction.away >= prediction.draw
      ? `Visitante (${prediction.away}%)`
      : `Empate (${prediction.draw}%)`;

  const correctScoreRows = Object.entries(markets.correct_score).map(([key, value]) => ({
    label: scoreLabel(key),
    value,
  }));

  const goalscorerHome = entryRows(markets.goalscorer.home);
  const goalscorerAway = entryRows(markets.goalscorer.away);

  return (
    <div className="mt-3 border-t border-card-border pt-3 space-y-3">
      {analysis.analysis.summary && (
        <p className="text-sm text-text-secondary leading-relaxed">{analysis.analysis.summary}</p>
      )}

      <div className="flex items-center justify-between bg-soft-gray px-4 py-2.5 rounded-card">
        <span className="text-sm font-medium">Resultado previsto</span>
        <span className="text-sm font-semibold">{favorite}</span>
      </div>

      {analysis.analysis.key_factors.length > 0 && (
        <ul className="space-y-1">
          {analysis.analysis.key_factors.map((factor, idx) => (
            <li key={idx} className="text-xs text-text-secondary flex gap-2">
              <span className="text-accent">•</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      )}

      {analysis.analysis.recommendation && (
        <div className="bg-soft-gray rounded-card px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Recomendação
          </span>
          <p className="text-sm font-medium mt-0.5">{analysis.analysis.recommendation}</p>
        </div>
      )}

      <button
        onClick={() => setShowDetails((v) => !v)}
        className="text-xs font-medium text-accent hover:underline"
      >
        {showDetails ? '▼ Ocultar mercados' : '▶ Ver todos os mercados'}
      </button>

      {showDetails && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MarketCard
            title="Resultado"
            items={[
              { label: 'Mandante', value: prediction.home },
              { label: 'Empate', value: prediction.draw },
              { label: 'Visitante', value: prediction.away },
            ]}
          />
          <MarketCard
            title="Chance Dupla"
            items={[
              { label: '1X', value: markets.double_chance.home_or_draw },
              { label: '12', value: markets.double_chance.home_or_away },
              { label: 'X2', value: markets.double_chance.draw_or_away },
            ]}
          />
          <MarketCard
            title="Ambas Marcam"
            items={[
              { label: 'Sim', value: markets.both_to_score.yes },
              { label: 'Não', value: markets.both_to_score.no },
            ]}
          />
          <MarketCard
            title="Gols (Mais/Menos)"
            items={[
              { label: 'Mais de 0.5', value: markets.over_under.over_0_5 },
              { label: 'Mais de 1.5', value: markets.over_under.over_1_5 },
              { label: 'Mais de 2.5', value: markets.over_under.over_2_5 },
              { label: 'Mais de 3.5', value: markets.over_under.over_3_5 },
              { label: 'Menos de 2.5', value: markets.over_under.under_2_5 },
              { label: 'Menos de 3.5', value: markets.over_under.under_3_5 },
            ]}
          />
          <MarketCard
            title="Handicap Asiático"
            items={[
              { label: 'Casa 0 (empate devolve)', value: markets.asian_handicap.home_0 },
              { label: 'Fora 0 (empate devolve)', value: markets.asian_handicap.away_0 },
              { label: 'Casa -0.5', value: markets.asian_handicap.home_neg_0_5 },
              { label: 'Fora -0.5', value: markets.asian_handicap.away_neg_0_5 },
              { label: 'Casa -1', value: markets.asian_handicap.home_neg_1 },
              { label: 'Fora -1', value: markets.asian_handicap.away_neg_1 },
            ]}
          />
          <MarketCard
            title="Handicap Europeu"
            items={[
              { label: 'Mandante', value: markets.european_handicap.home },
              { label: 'Empate', value: markets.european_handicap.draw },
              { label: 'Visitante', value: markets.european_handicap.away },
            ]}
          />
          <MarketCard title="Placar Exato" items={correctScoreRows} />
          {goalscorerHome.length > 0 && (
            <MarketCard title="Artilheiro (casa)" items={goalscorerHome} />
          )}
          {goalscorerAway.length > 0 && (
            <MarketCard title="Artilheiro (fora)" items={goalscorerAway} />
          )}
          <MarketCard
            title="Escanteios"
            items={[
              { label: 'Total mais de 9.5', value: markets.corners.total_over_9_5 },
              { label: 'Total menos de 9.5', value: markets.corners.total_under_9_5 },
              { label: 'Total mais de 10.5', value: markets.corners.total_over_10_5 },
              { label: 'Total menos de 10.5', value: markets.corners.total_under_10_5 },
              { label: 'Casa mais de 4.5', value: markets.corners.home_over_4_5 },
              { label: 'Fora mais de 4.5', value: markets.corners.away_over_4_5 },
            ]}
          />
          <MarketCard
            title="Cartões"
            items={[
              { label: 'Mais de 4.5', value: markets.cards.total_over_4_5 },
              { label: 'Menos de 4.5', value: markets.cards.total_under_4_5 },
              { label: 'Mais de 5.5', value: markets.cards.total_over_5_5 },
              { label: 'Menos de 5.5', value: markets.cards.total_under_5_5 },
            ]}
          />
          <MarketCard
            title="Faltas"
            items={[
              { label: 'Mais de 20.5', value: markets.fouls.total_over_20_5 },
              { label: 'Menos de 20.5', value: markets.fouls.total_under_20_5 },
              { label: 'Mais de 24.5', value: markets.fouls.total_over_24_5 },
              { label: 'Menos de 24.5', value: markets.fouls.total_under_24_5 },
            ]}
          />
        </div>
      )}

      <p className="text-[11px] text-text-secondary/70">
        Análise gerada por IA — estimativa estatística, sem garantia de resultado. Aposte com responsabilidade.
      </p>
    </div>
  );
}
