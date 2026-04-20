import React from 'react';
import { Database, Layers, Cloud, FileSearch } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ToolMeta {
  icon: ReactNode;
  label: string;
  color: string;
}

export const TOOL_META: Record<string, ToolMeta> = {
  get_policy_status: {
    icon: React.createElement(Database, { size: 12 }),
    label: 'MongoDB · Policy Status',
    color: 'text-emerald-300 bg-emerald-950/50 border-emerald-700/50',
  },
  get_policy_events: {
    icon: React.createElement(Layers, { size: 12 }),
    label: 'MongoDB · Event History',
    color: 'text-cyan-300 bg-cyan-950/50 border-cyan-700/50',
  },
  search_cloudwatch_logs: {
    icon: React.createElement(Cloud, { size: 12 }),
    label: 'CloudWatch · Log Search',
    color: 'text-violet-300 bg-violet-950/50 border-violet-700/50',
  },
  cloudwatch_insights_query: {
    icon: React.createElement(FileSearch, { size: 12 }),
    label: 'CloudWatch · Insights',
    color: 'text-amber-300 bg-amber-950/50 border-amber-700/50',
  },
};

export const STATUS_STYLE: Record<string, string> = {
  ACTIVE:       'text-emerald-300 bg-emerald-950/60 border-emerald-600/50',
  PENDING:      'text-amber-300 bg-amber-950/60 border-amber-600/50',
  EXPIRED:      'text-slate-300 bg-slate-800/60 border-slate-500/50',
  CANCELLED:    'text-red-300 bg-red-950/60 border-red-600/50',
  UNDER_REVIEW: 'text-blue-300 bg-blue-950/60 border-blue-600/50',
  CLAIMED:      'text-purple-300 bg-purple-950/60 border-purple-600/50',
  ok:           'text-emerald-300 bg-emerald-950/60 border-emerald-600/50',
  degraded:     'text-amber-300 bg-amber-950/60 border-amber-600/50',
  error:        'text-red-300 bg-red-950/60 border-red-600/50',
  unavailable:  'text-slate-300 bg-slate-800/60 border-slate-500/50',
};

export const TYPE_ICON: Record<string, string> = {
  AUTO:       '🚗',
  HOME:       '🏠',
  LIFE:       '💛',
  HEALTH:     '❤️',
  TRAVEL:     '✈️',
  COMMERCIAL: '🏢',
  CYBER:      '🔒',
};
