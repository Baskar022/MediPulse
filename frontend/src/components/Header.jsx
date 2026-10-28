import React from 'react';
import { Activity, Database, Brain, Users, BarChart3, ShieldAlert } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: BarChart3 },
    { id: 'predictor', label: 'Patient Risk Predictor', icon: Activity },
    { id: 'population', label: 'Population Health', icon: Users },
    { id: 'transparency', label: 'Model Transparency & Fairness', icon: Brain },
    { id: 'pipeline', label: 'Big Data Lakehouse & Benchmarks', icon: Database },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">Medi<span className="text-sky-600">Pulse</span></span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-sky-100 text-sky-800 rounded-full">v1.0 Local</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Hospital Readmission Risk & Population Health Analytics</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mandatory Clinical Disclaimer Banner */}
      <div className="bg-amber-50 border-t border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-center gap-2 font-medium">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Decision-support prototype, not a medical device. Clinical decisions must rely on licensed healthcare professional judgment.</span>
      </div>
    </header>
  );
}
