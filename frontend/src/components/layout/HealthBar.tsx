import { useState, useEffect, type FC, type ReactNode } from 'react';
import { Activity, Database, Cpu, Cloud } from 'lucide-react';
import { api } from '../../services/api.js';
import Badge from '../ui/Badge.js';
import type { HealthResponse } from '../../types/index.js';

const SVC_ICONS: Record<string, ReactNode> = {
  mongodb:    <Database size={12} />,
  ollama:     <Cpu size={12} />,
  cloudwatch: <Cloud size={12} />,
};

const HealthBar: FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [open, setOpen]     = useState(false);

  useEffect(() => {
    const load = () => api.health().then(setHealth).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!health) return null;

  const dotColor =
    health.status === 'ok'       ? 'bg-emerald-400' :
    health.status === 'degraded' ? 'bg-amber-400'   :
    'bg-red-400';

  return (
    <div className="relative">
      {/* <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} ${health.status !== 'error' ? 'animate-pulse' : ''}`} />
        <Activity size={12} className="text-slate-400" />
        <span className="text-xs font-medium text-slate-300">System</span>
      </button> */}

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">System Health</p>
              <Badge label={health.status} />
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {Object.entries(health.services).map(([svc, status]) => (
                <div key={svc} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-500">{SVC_ICONS[svc]}</span>
                    <span className="capitalize">{svc}</span>
                  </span>
                  <Badge label={status} />
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-700/60">
              <p className="text-xs text-slate-500 font-mono">v{health.version}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HealthBar;
