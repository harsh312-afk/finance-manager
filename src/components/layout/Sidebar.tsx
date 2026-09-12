import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  PiggyBank, 
  CalendarClock,
  Sparkles,
  Keyboard
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenShortcuts: () => void;
  alertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  onOpenShortcuts,
  alertCount = 0
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortcut: 'g o' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, shortcut: 'g t' },
    { id: 'budgets', label: 'Budgets', icon: PieChart, shortcut: 'g b', badge: alertCount > 0 ? alertCount : undefined },
    { id: 'pots', label: 'Saving Pots', icon: PiggyBank, shortcut: 'g p' },
    { id: 'recurring', label: 'Recurring Bills', icon: CalendarClock, shortcut: 'g r' }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 space-x-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <Sparkles className="w-5 h-5 text-slate-950 font-bold" />
        </div>
        <div>
          <h1 className="font-extrabold text-base tracking-tight text-white flex items-center">
            VaultFlow
          </h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Finance Manager</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                )}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-500 group-hover:text-slate-400'
                }`}>
                  {item.shortcut}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Shortcuts */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <button
          onClick={onOpenShortcuts}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
        >
          <div className="flex items-center space-x-2">
            <Keyboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Shortcuts</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-300 rounded border border-slate-600">
            ?
          </kbd>
        </button>

        <div className="px-1 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>SQLite 3.53 Engine</span>
          </span>
          <span className="font-mono text-slate-500">v1.0</span>
        </div>
      </div>
    </aside>
  );
};
