import type { FC } from 'react';
import Badge from '../ui/Badge.js';
import { fmt$ } from '../../utils/format.js';
import { TYPE_ICON } from '../../constants/index.js';
import type { Policy } from '../../types/index.js';

interface PolicyCardProps {
  policy: Policy;
  onSelect: (query: string) => void;
}

const PolicyCard: FC<PolicyCardProps> = ({ policy: p, onSelect }) => (
  <button
    onClick={() => onSelect(`Get full details and latest activity for policy ${p.policyNumber}`)}
    className="group w-full px-4 py-3.5 text-left border-b border-slate-700/40 hover:bg-slate-700/20 transition-all"
  >
    {/* Top row: policy number + badge */}
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <span className="text-sm font-semibold text-sky-400 group-hover:text-sky-300 transition-colors font-mono">
        {p.policyNumber}
      </span>
      <Badge label={p.status} />
    </div>

    {/* Holder name */}
    <p className="text-sm text-slate-200 mb-1.5 truncate">{p.holderName}</p>

    {/* Meta row */}
    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
      <span>{TYPE_ICON[p.type] ?? '📄'} {p.type}</span>
      <span className="text-slate-600">·</span>
      <span>{fmt$(p.premium)}/yr</span>
      {p.eventCount !== undefined && (
        <>
          <span className="text-slate-600">·</span>
          <span>{p.eventCount} events</span>
        </>
      )}
    </div>
  </button>
);

export default PolicyCard;
