import type { FC } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ExampleQuery } from '../../types/index.js';

interface ExampleQueriesProps {
  examples: ExampleQuery[];
  onSelect: (query: string) => void;
}

const ExampleQueries: FC<ExampleQueriesProps> = ({ examples, onSelect }) => {
  const grouped = examples.reduce((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {} as Record<string, ExampleQuery[]>);

  if (Object.entries(grouped).length === 0) return null;

  return (
    <div className="w-full space-y-6">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest text-center">
        Try an example
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {examples.map((ex, i) => (
          <button
            key={i}
            onClick={() => onSelect(ex.query)}
            className="group flex items-start gap-3 text-left px-4 py-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/70 transition-all"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">
                {ex.category}
              </p>
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                {ex.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate group-hover:text-slate-400 transition-colors">
                {ex.query}
              </p>
            </div>
            <ChevronRight
              size={14}
              className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExampleQueries;
