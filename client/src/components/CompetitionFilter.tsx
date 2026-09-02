import { useState } from 'react';
import { Competition } from '@/types';

interface CompetitionFilterProps {
  available: Competition[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

export default function CompetitionFilter({
  available,
  selected,
  onChange,
}: CompetitionFilterProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'national' | 'international'>('all');

  const filtered = available.filter((comp) => {
    const matchName = comp.name.toLowerCase().includes(search.toLowerCase());
    // Nacionais = apenas competições brasileiras (country Brazil); Internacionais = todo o resto
    // Isso evita que Premier League / La Liga (type national mas country England/Spain) apareçam em Nacionais
    const isBrazilian = comp.country === 'Brazil';
    const matchType =
      filterType === 'all' ? true : filterType === 'national' ? isBrazilian : !isBrazilian;
    return matchName && matchType;
  });

  const toggle = (id: number) => {
    const next = selected.includes(id)
      ? selected.filter((i) => i !== id)
      : [...selected, id];
    onChange(next);
  };

  const selectAll = () => {
    onChange(filtered.map((c) => c.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="bg-card-bg rounded-card border border-card-border p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filtrar competições..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-2 border border-card-border rounded-card bg-soft-gray text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-sm rounded-card transition-colors ${
              filterType === 'all' ? 'bg-accent text-white' : 'bg-soft-gray text-text-secondary'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterType('national')}
            className={`px-3 py-1 text-sm rounded-card transition-colors ${
              filterType === 'national' ? 'bg-accent text-white' : 'bg-soft-gray text-text-secondary'
            }`}
          >
            Nacionais
          </button>
          <button
            onClick={() => setFilterType('international')}
            className={`px-3 py-1 text-sm rounded-card transition-colors ${
              filterType === 'international' ? 'bg-accent text-white' : 'bg-soft-gray text-text-secondary'
            }`}
          >
            Internacionais
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1 text-sm text-accent hover:bg-accent/10 rounded-card transition-colors"
          >
            Selecionar todos
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1 text-sm text-text-secondary hover:bg-soft-gray rounded-card transition-colors"
          >
            Limpar
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
        {filtered.map((comp) => (
          <label
            key={comp.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
              selected.includes(comp.id)
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-card-border bg-soft-gray text-text-secondary hover:bg-slate-200/50'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(comp.id)}
              onChange={() => toggle(comp.id)}
              className="accent-accent w-4 h-4"
            />
            {comp.name}
            <span className="text-xs opacity-70">
              {comp.country === 'Brazil' ? '🇧🇷' : '🌎'}
            </span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-text-secondary italic">Nenhuma competição encontrada.</p>
        )}
      </div>
    </div>
  );
}