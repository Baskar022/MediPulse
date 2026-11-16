import React from 'react';
import { ShieldAlert, Server, Bell, RefreshCw, Sparkles, ChevronRight } from 'lucide-react';

export default function TopNav({ activeNav, onRefresh }) {
  const titles = {
    overview: 'Executive Dashboard & Clinical KPIs',
    predictor: 'Real-Time Patient Risk Predictor (SHAP)',
    population: 'Population Health & High-Risk Stratification',
    explorer: 'Interactive Medallion Data Lake Explorer',
    pipeline: 'Apache PySpark Pipeline Execution Console',
    spark_sql: 'Spark SQL Analytics Workspace',
    benchmark: 'Big Data Scalability Benchmark (100k - 1M Rows)',
    transparency: 'Model Governance, PR/ROC Curves & Fairness',
    storage: 'Storage Lakehouse & Parquet Artifact Tree',
    system: 'Platform Diagnostic & Spark JVM Monitor',
    demo: 'Interactive 7-Minute Walkthrough Mode'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
      <div className="px-6 py-3 flex items-center justify-between">
        {/* Breadcrumb / Title */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">MediPulse 2.0</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60">
            {titles[activeNav] || activeNav.toUpperCase()}
          </span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>FastAPI Backend Connected</span>
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

      {/* Mandatory Clinical Disclaimer Banner */}
      <div className="bg-amber-50/80 border-t border-amber-200/80 px-4 py-1 text-[11px] text-amber-900 flex items-center justify-center gap-2 font-medium">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Academic Big Data Analytics & Decision-Support Prototype (Not an FDA Medical Device). Clinical judgment required.</span>
      </div>
    </header>
  );
}
