import type { FC } from 'react';
import { Shield, Database, Cloud, Cpu } from 'lucide-react';
import HealthBar from './HealthBar.js';

const Navbar: FC = () => (
  <header className="flex-shrink-0 h-13 bg-slate-900 border-b border-slate-700/60 flex items-center px-6 gap-4 z-20 shadow-sm">

    {/* Logo */}
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
        <Shield size={15} className="text-white" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-base font-bold text-white tracking-tight">PolicyTrace</span>
        <span className="hidden sm:inline text-xs font-medium text-slate-400 bg-slate-800 border border-slate-700/60 rounded px-1.5 py-0.5">
          POC
        </span>
      </div>
    </div>

    {/* Divider */}
    <div className="h-5 w-px bg-slate-700/60 mx-1" />

    {/* Stack badges */}
    {/* <div className="hidden md:flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-800/70 border border-slate-700/50 rounded-lg px-2.5 py-1">
        <Database size={11} className="text-emerald-400" />
        MongoDB
      </span>
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-800/70 border border-slate-700/50 rounded-lg px-2.5 py-1">
        <Cloud size={11} className="text-violet-400" />
        CloudWatch
      </span>
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-800/70 border border-slate-700/50 rounded-lg px-2.5 py-1">
        <Cpu size={11} className="text-amber-400" />
        Llama 3.2
      </span>
    </div> */}

    {/* Right */}
    <div className="ml-auto">
      <HealthBar />
    </div>
  </header>
);

export default Navbar;
