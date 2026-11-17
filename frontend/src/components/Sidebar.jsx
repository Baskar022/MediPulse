import React from 'react';
import {
  Activity, Brain, Users, BarChart3,
  Table2, Cpu, HardDrive, Terminal, PlaySquare,
  Layers
} from 'lucide-react';

export default function Sidebar({ activeNav, setActiveNav }) {
  const navSections = [
    {
      group: 'CLINICAL INTELLIGENCE',
      items: [
        { id: 'overview', label: 'Platform Overview', icon: BarChart3, badge: 'Live' },
        { id: 'predictor', label: 'Patient Risk Predictor', icon: Activity, badge: 'AI/SHAP' },
        { id: 'population', label: 'Population Health', icon: Users, badge: 'Analytics' },
        { id: 'transparency', label: 'Model Governance', icon: Brain, badge: 'Audits' },
      ]
    },
    {
      group: 'DATA PLATFORM',
      items: [
        { id: 'explorer', label: 'Patient Data Explorer', icon: Table2, badge: 'Parquet' },
        { id: 'spark_sql', label: 'Clinical Query Workspace', icon: Terminal, badge: 'SQL' },
      ]
    },
    {
      group: 'PLATFORM OPERATIONS',
      items: [
        { id: 'pipeline', label: 'Data Processing', icon: PlaySquare, badge: 'Pipelines' },
        { id: 'benchmark', label: 'Processing Performance', icon: Cpu, badge: 'Benchmarks' },
        { id: 'storage', label: 'Storage Management', icon: HardDrive, badge: 'Lakehouse' },
        { id: 'system', label: 'System Health', icon: Layers, badge: 'Telemetry' },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 shadow-xl z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-white">Medi<span className="text-sky-400">Pulse</span></span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">HEALTHCARE AI PLATFORM</p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-xs">
        {navSections.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {sec.group}
            </div>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition text-left ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      isActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Platform Status Indicator */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Clinical Data Lakehouse
          </span>
          <span className="text-[10px] font-mono text-emerald-400">ONLINE</span>
        </div>
        <p className="text-[10px] text-slate-400 truncate">69,990 Standardized Encounters</p>
      </div>
    </aside>
  );
}
