import { useState, useEffect, useCallback, type FC } from 'react';
import { Database, Search, Loader2, X } from 'lucide-react';
import { api } from '../../services/api.js';
import PolicyCard from './PolicyCard.js';
import type { Policy } from '../../types/index.js';

interface PolicySidebarProps {
  onSelect: (query: string) => void;
}

const PolicySidebar: FC<PolicySidebarProps> = ({ onSelect }) => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.policies({ search: search || undefined });
      setPolicies(r.data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 280);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-700/60 bg-slate-900/90">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
            <Database size={12} className="text-sky-400" />
          </div>
          <span className="text-sm font-semibold text-white">Policies</span>
          <span className="ml-auto text-xs text-slate-400 font-mono">
            {!loading && `${policies.length} total`}
          </span>
          {loading && <Loader2 size={12} className="text-slate-400 animate-spin" />}
        </div>

        {/* Search box */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, number…"
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              title="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Policy list */}
      <div className="flex-1 overflow-y-auto">
        {err && (
          <p className="px-4 py-4 text-sm text-red-400">{err}</p>
        )}

        {!err && !loading && policies.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-400">No policies found</p>
            {search && (
              <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
            )}
          </div>
        )}

        {policies.map(p => (
          <PolicyCard key={p._id} policy={p} onSelect={onSelect} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700/60 bg-slate-900/80">
        <p className="text-xs text-slate-500 text-center">
          Click any policy to investigate
        </p>
      </div>
    </div>
  );
};

export default PolicySidebar;
