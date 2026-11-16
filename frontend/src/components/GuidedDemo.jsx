import React, { useState } from 'react';
import {
  Presentation, CheckCircle2, ChevronRight, ChevronLeft, ArrowRight,
  Database, PlaySquare, Terminal, Cpu, Brain, HardDrive, Sparkles,
  ExternalLink, Layers
} from 'lucide-react';

export default function GuidedDemo({ onNavigateTab }) {
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    {
      step: 1,
      title: 'Problem & Executive Dashboard',
      time: '0:00 - 1:30',
      description: 'Introduce the CMS 30-day readmission problem and present the executive telemetry aggregated by Spark SQL across 69,990 unique patient encounters.',
      talkingPoints: [
        'Hospitals face up to 3% reimbursement cuts under the CMS HRRP program for excess 30-day readmissions.',
        'Diabetic cohorts have a natural readmission rate of ~8.98% (6,285 positive cases in this dataset).',
        'Show average stay of 4.27 days and primary diagnosis bounceback rates (>10% for Circulatory and Diabetes).'
      ],
      targetTab: 'overview',
      targetName: 'Executive Dashboard'
    },
    {
      step: 2,
      title: 'Medallion Lakehouse & Schema Exploration',
      time: '1:30 - 3:00',
      description: 'Demonstrate the physical Bronze, Silver, and Gold Parquet layers, de-duplication to eliminate temporal patient leakage, and column statistics.',
      talkingPoints: [
        'Bronze layer ingested 101,766 raw records using an explicit StructType schema to eliminate schema inference overhead.',
        'Silver layer dropped >40% missing columns (weight, payer_code, medical_specialty) and filtered out deceased/hospice patients.',
        'PySpark Window function deduplicated 101,766 encounters to 69,990 clean index patient encounters, eliminating temporal leakage.',
        'Gold layer categorizes ICD-9 diagnosis codes into 9 clinical categories.'
      ],
      targetTab: 'explorer',
      targetName: 'Data Lake Explorer'
    },
    {
      step: 3,
      title: 'Interactive BDA Pipeline Execution',
      time: '3:00 - 4:30',
      description: 'Show the live asynchronous pipeline console where PySpark stages (Ingest, Clean, Features, MLlib, Benchmark) can be triggered in the background.',
      talkingPoints: [
        'Each pipeline script runs in an isolated background subprocess without blocking the web server.',
        'Real-time streaming logs from PySpark show DataFrame transformations, stage durations, and exit codes.',
        'Strict dependency tracking prevents downstream stages from running if parent data is missing.'
      ],
      targetTab: 'pipeline',
      targetName: 'Interactive Pipeline'
    },
    {
      step: 4,
      title: 'Spark SQL Analytics Engine',
      time: '4:30 - 6:00',
      description: 'Run parameterized Spark SQL query templates directly on Gold Parquet partitions and observe dynamic Recharts visualizations.',
      talkingPoints: [
        'Demonstrates Spark SQL Catalyst Optimizer performance on Gold Parquet columnar data.',
        'Show readmission rates by primary diagnosis, age bracket, and stay duration buckets in sub-second latency.',
        'Point out multi-variable high-risk segments (Diagnosis × Disposition × Prior Inpatient visits) with sample size >= 50.'
      ],
      targetTab: 'spark_sql',
      targetName: 'Spark SQL Workspace'
    },
    {
      step: 5,
      title: 'Scalability Benchmark: Pandas vs. PySpark',
      time: '6:00 - 7:30',
      description: 'Present the 100k, 500k, and 1,000,000-row benchmark demonstrating the classic scaling crossover point.',
      talkingPoints: [
        'At 100k rows, Pandas is faster (1.71s vs 14.98s) due to Spark JVM and coordinator startup overhead.',
        'At 500k rows, runtime reaches parity (~7-8s).',
        'At 1,000,000 rows, PySpark is 1.68x faster than Pandas (8.40s vs 14.08s) achieving 119,000+ rows/second throughput.',
        'Spark MLlib distributed Random Forest achieved 0.6403 ROC-AUC on distributed DataFrames.'
      ],
      targetTab: 'benchmark',
      targetName: 'Scalability Benchmark'
    },
    {
      step: 6,
      title: 'Real-Time Patient Risk Predictor (SHAP)',
      time: '7:30 - 9:00',
      description: 'Simulate an acute patient intake using the calibrated XGBoost model and TreeSHAP waterfall explanation.',
      talkingPoints: [
        'Click the "High Risk" preset button to instantly populate a multi-morbidity complex diabetic patient.',
        'Explain the risk meter: Calibrated probability vs. 13% operational decision threshold.',
        'Highlight the top 5 TreeSHAP clinical drivers (red bars = risk factors, green = protective factors).',
        'Show concrete actionable discharge interventions (nurse phone follow-up within 48h, endocrinologist within 7 days).'
      ],
      targetTab: 'predictor',
      targetName: 'Patient Risk Predictor'
    },
    {
      step: 7,
      title: 'Model Governance, PR/ROC Curves & Fairness',
      time: '9:00 - 10:00',
      description: 'Defend model selection, Platt Sigmoid calibration, confusion matrix cost trade-offs, and demographic fairness audits.',
      talkingPoints: [
        'Model Comparison: XGBoost selected over Random Forest and Logistic Regression based on validation ROC-AUC (0.6466) and recall (54%).',
        'Precision-Recall curve shows 0.1770 PR-AUC (near 2x lift over 8.98% baseline prevalence).',
        'Operational threshold tuned to 0.13 to prioritize sensitivity: A $15 preventive call is vastly cheaper than an unflagged $14,000 readmission.',
        'Demographic audit confirms Equal Opportunity (Recall) parity across Race (53-54%) and Gender (53-54%).'
      ],
      targetTab: 'transparency',
      targetName: 'Model Transparency & Fairness'
    }
  ];

  const current = steps.find((s) => s.step === currentStep) || steps[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-black/20 px-3 py-1 rounded-full border border-white/20">
            <Presentation className="w-3.5 h-3.5 text-amber-300" />
            <span>Guided Walkthrough Mode</span>
          </div>
          <span className="text-xs font-mono font-semibold bg-white/20 px-2.5 py-1 rounded">
            Step {currentStep} of {steps.length} • {current.time}
          </span>
        </div>

        <h1 className="text-2xl font-black tracking-tight">{current.title}</h1>
        <p className="text-amber-100 text-sm mt-1 max-w-3xl">{current.description}</p>
      </div>

      {/* Main Guided Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Key Presentation Talking Points for Evaluators:
          </h3>
          <ul className="space-y-2.5 text-xs text-slate-800">
            {current.talkingPoints.map((point, pIdx) => (
              <li key={pIdx} className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Button: Jump to Live Screen */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Click to view and demonstrate the live working module:
          </div>

          <button
            onClick={() => onNavigateTab(current.targetTab)}
            className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>Open {current.targetName}</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Navigation */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            disabled={currentStep <= 1}
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Step
          </button>

          <div className="flex gap-1.5">
            {steps.map((s) => (
              <button
                key={s.step}
                onClick={() => setCurrentStep(s.step)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition ${
                  currentStep === s.step
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.step}
              </button>
            ))}
          </div>

          <button
            disabled={currentStep >= steps.length}
            onClick={() => setCurrentStep((s) => Math.min(steps.length, s + 1))}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            Next Step
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
