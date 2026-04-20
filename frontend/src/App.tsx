import Navbar from './components/layout/Navbar.js';
import AgentPanel from './components/agent/AgentPanel.js';

export default function App() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950">
      <Navbar />
      <main className="flex-1 min-w-0 overflow-hidden">
        <AgentPanel />
      </main>
    </div>
  );
}
