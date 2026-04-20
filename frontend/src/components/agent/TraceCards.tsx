import { useState, type FC } from 'react';
import {
  Cpu, ChevronRight, ChevronDown, CheckCircle, XCircle, Eye, Clock,
} from 'lucide-react';
import { TOOL_META } from '../../constants/index.js';
import CopyBtn from '../ui/CopyBtn.js';
import { fmtMs } from '../../utils/format.js';
import type { ThinkingData, ToolCallData, ToolResultData } from '../../types/index.js';

// ─── Thinking Card ────────────────────────────────────────────────────────────

export const ThinkingCard: FC<{ data: ThinkingData }> = ({ data }) => (
  <div className="flex gap-3 py-3 px-4 rounded-xl bg-violet-950/20 border border-violet-700/30">
    <Cpu size={14} className="text-violet-400 mt-0.5 flex-shrink-0 animate-pulse" />
    <div>
      <p className="text-xs font-semibold text-violet-400 mb-1 uppercase tracking-wider">
        Step {data.step} · Reasoning
      </p>
      <p className="text-sm text-slate-300 leading-relaxed italic">{data.thought}</p>
    </div>
  </div>
);

// ─── Tool Call Card ───────────────────────────────────────────────────────────

export const ToolCallCard: FC<{ data: ToolCallData }> = ({ data }) => {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[data.toolName];

  return (
    <div className={`rounded-xl border ${meta?.color ?? 'text-slate-300 bg-slate-800/60 border-slate-600/50'}`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex-shrink-0">{meta?.icon}</span>
          <span className="text-xs font-semibold tracking-wide">{meta?.label ?? data.toolName}</span>
          <span className="text-xs opacity-60 font-mono">· step {data.step}</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded"
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 relative">
          <pre className="text-xs font-mono text-current opacity-80 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-44 leading-relaxed">
            {JSON.stringify(data.parameters, null, 2)}
          </pre>
          <div className="absolute top-1 right-5">
            <CopyBtn text={JSON.stringify(data.parameters, null, 2)} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tool Result Card ─────────────────────────────────────────────────────────

export const ToolResultCard: FC<{ data: ToolResultData }> = ({ data }) => {
  const [open, setOpen] = useState(false);
  const ok = data.success;

  return (
    <div className={`rounded-xl border ${ok ? 'bg-slate-800/30 border-slate-600/40' : 'bg-red-950/30 border-red-700/40'}`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {ok
            ? <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
            : <XCircle    size={13} className="text-red-400 flex-shrink-0" />}
          <span className="text-xs font-medium text-slate-300">
            {TOOL_META[data.toolName]?.label ?? data.toolName}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
            <Clock size={10} />
            {fmtMs(data.executionMs)}
          </span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
        >
          {open ? <ChevronDown size={13} /> : <Eye size={13} />}
        </button>
      </div>

      {!ok && (
        <p className="px-4 pb-3 text-xs text-red-300 font-mono">{data.error}</p>
      )}

      {open && ok && (
        <div className="px-4 pb-3 relative">
          <pre className="text-xs font-mono text-slate-300 bg-black/40 rounded-lg p-3 overflow-x-auto max-h-72 leading-relaxed">
            {JSON.stringify(data.data, null, 2)}
          </pre>
          <div className="absolute top-1 right-5">
            <CopyBtn text={JSON.stringify(data.data, null, 2)} />
          </div>
        </div>
      )}
    </div>
  );
};
