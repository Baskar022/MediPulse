import React from 'react';
import { ShieldAlert, RefreshCw, ChevronRight } from 'lucide-react';

export default function TopNav({ activeNav, onRefresh }) {
  const titles = {
    overview: 'Platform Overview & Executive Telemetry',
    predictor: 'Real-Time Patient Risk Predictor (SHAP)',
    population: 'Population Health & Cohort Analytics',
    transparency: 'Model Governance & Fairness Auditing',
    explorer: 'Patient Data Explorer',
    spark_sql: 'Clinical Query Workspace',
    pipeline: 'Data Processing Pipelines',
    benchmark: 'Processing Performance & Scalability',
    storage: 'Storage Management & Lakehouse',
    system: 'System Health & Engine Telemetry'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
      <div className="px-6 py-3 flex items-center justify-between">
        {/* Breadcrumb / Title */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">MediPulse</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60">
            {titles[activeNav] || activeNav.toUpperCase()}
          </span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Healthcare Analytics Engine Connected</span>
          </div>

          <button
            onClick={onRefresh}
            title="Refresh active view"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Professional Clinical Decision Support Notice */}
      <div className="bg-amber-50/80 border-t border-amber-200/80 px-4 py-1 text-[11px] text-amber-900 flex items-center justify-center gap-2 font-medium">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Clinical Decision Support System. Designed for risk stratification and clinical operations. Professional clinical judgment is required.</span>
      </div>
    </header>
  );
}
