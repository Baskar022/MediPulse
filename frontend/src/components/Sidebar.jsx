import React from 'react';
import {
  Activity, Database, Brain, Users, BarChart3, ShieldAlert,
  Table2, Cpu, HardDrive, Terminal, Presentation, PlaySquare,
  Sparkles, Layers
} from 'lucide-react';

export default function Sidebar({ activeNav, setActiveNav, isDemoMode, setIsDemoMode }) {
  const navSections = [
    {
      group: 'EXECUTIVE & CLINICAL',
      items: [
        { id: 'overview', label: 'Executive Overview', icon: BarChart3, badge: 'KPIs' },
        { id: 'predictor', label: 'Patient Risk Predictor', icon: Activity, badge: 'AI/SHAP' },
        { id: 'population', label: 'Population Health', icon: Users, badge: null },
      ]
    },
    {
      group: 'BIG DATA ANALYTICS (BDA)',
      items: [
        { id: 'explorer', label: 'Data Lake Explorer', icon: Table2, badge: 'Parquet' },
        { id: 'pipeline', label: 'Interactive BDA Pipeline', icon: PlaySquare, badge: 'Runner' },
        { id: 'spark_sql', label: 'Spark SQL Workspace', icon: Terminal, badge: 'Queries' },
        { id: 'benchmark', label: 'Scalability Benchmark', icon: Cpu, badge: '1M Rows' },
      ]
    },
    {
      group: 'GOVERNANCE & PLATFORM',
      items: [
        { id: 'transparency', label: 'Model & Fairness Audit', icon: Brain, badge: 'Curves' },
        { id: 'storage', label: 'Storage & Lakehouse Tree', icon: HardDrive, badge: 'Files' },
        { id: 'system', label: 'System & Spark Monitor', icon: Layers, badge: 'JVM' },
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
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-sky-500/20 text-sky-300 rounded border border-sky-400/30">2.0</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">BDA LAKEHOUSE & AI</p>
          </div>
        </div>
      </div>

      {/* Guided Walkthrough Mode Toggle */}
      <div className="p-3 bg-slate-950/50 border-b border-slate-800/80">
        <button
          onClick={() => {
            setIsDemoMode(!isDemoMode);
            if (!isDemoMode) setActiveNav('demo');
          }}
          className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-between border ${
            isDemoMode
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <Presentation className="w-4 h-4 text-amber-300" />
            <span>Walkthrough Mode</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/30">
            {isDemoMode ? 'Active' : 'Start'}
          </span>
        </button>
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
              const isActive = activeNav === item.id && !isDemoMode;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id);
                    setIsDemoMode(false);
                  }}
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

      {/* Footer Spark Cluster Indicator */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            PySpark Local Cluster
          </span>
          <span className="text-[10px] font-mono text-slate-400">local[*]</span>
        </div>
        <p className="text-[10px] text-slate-400 truncate">Parquet Lakehouse: 69,990 Encounters</p>
      </div>
    </aside>
  );
}
