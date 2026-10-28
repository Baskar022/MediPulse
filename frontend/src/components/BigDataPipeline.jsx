import React, { useEffect, useState } from 'react';
import {
  Database, Cpu, ArrowRight, Layers, CheckCircle2,
  Server, Zap, RefreshCw, BarChart2, ShieldCheck, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts';
import { fetchBenchmark, fetchModelMetrics } from '../api';

export default function BigDataPipeline() {
  const [benchmarks, setBenchmarks] = useState([]);
  const [mllibData, setMllibData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [bRes, mRes] = await Promise.all([fetchBenchmark(), fetchModelMetrics()]);
        setBenchmarks(bRes);
        setMllibData(mRes.mllib || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Retrieving PySpark Architecture & Benchmark Logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Big Data Analytics: PySpark Lakehouse & Benchmarks</h1>
        <p className="text-sm text-slate-500">
          Medallion architecture (Bronze → Silver → Gold) and empirical scalability benchmark up to 1,000,000 encounters.
        </p>
      </div>

      {/* Medallion Architecture Flow Diagram */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            <span>MediPulse Medallion Lakehouse Architecture</span>
          </h3>
          <span className="text-xs font-medium text-slate-500">Storage: Apache Parquet Columnar</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bronze Card */}
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-900">BRONZE LAYER</span>
              <Database className="w-4 h-4 text-amber-700" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Raw Encounters Ingestion</h4>
            <p className="text-xs text-slate-600 mb-3">
              Explicit StructType schema ingestion of diabetic_data.csv without schema inference overhead.
            </p>
            <div className="text-[11px] font-mono bg-white/80 p-2 rounded border border-amber-200 text-slate-700 space-y-1">
              <div>• File: data/bronze/encounters.parquet</div>
              <div>• Records: 101,766 encounters</div>
              <div>• Columns: 50 raw attributes</div>
            </div>
          </div>

          {/* Silver Card */}
          <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-800">SILVER LAYER</span>
              <Cpu className="w-4 h-4 text-slate-700" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Standardized & Deduplicated</h4>
            <p className="text-xs text-slate-600 mb-3">
              Drop &gt;40% missing (weight, payer, specialty); filter expired (11, 13, 14, 19-21); deduplicate to 1st encounter per patient.
            </p>
            <div className="text-[11px] font-mono bg-white p-2 rounded border border-slate-200 text-slate-700 space-y-1">
              <div>• File: data/silver/encounters.parquet</div>
              <div>• Retained: 69,990 unique patients</div>
              <div>• IDs mapped: Admission, Discharge</div>
            </div>
          </div>

          {/* Gold Card */}
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-200 text-emerald-900">GOLD LAYER</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Enriched Feature Store</h4>
            <p className="text-xs text-slate-600 mb-3">
              ICD-9 clinical grouping, total prior utilization, med change counter, polypharmacy count, binary target.
            </p>
            <div className="text-[11px] font-mono bg-white/80 p-2 rounded border border-emerald-200 text-slate-700 space-y-1">
              <div>• File: data/gold/encounters.parquet</div>
              <div>• Readmission rate: 8.98% (&lt;30 days)</div>
              <div>• Downstream: Spark SQL & MLlib</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scalability Benchmark: Pandas vs PySpark */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Benchmark Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Scalability Benchmark: Pandas vs. PySpark</h3>
                <p className="text-xs text-slate-500">Execution time (seconds) for identical data cleaning & multi-group aggregation</p>
              </div>
              <span className="px-2 py-1 text-xs font-bold rounded bg-sky-50 text-sky-700 border border-sky-100">
                100k, 500k, 1M Rows
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benchmarks} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="rows_label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis unit="s" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(val, name) => [`${val}s`, name === 'pandas_seconds' ? 'Pandas (Single Thread)' : 'PySpark (Local Cluster)']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <Legend />
                  <Bar dataKey="pandas_seconds" name="Pandas" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pyspark_seconds" name="PySpark" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 mt-2">
            <strong>Scaling Crossover Point:</strong> At 100k rows, Pandas is faster due to PySpark JVM initialization. At 500k rows, execution times equalize (~7-8s). At 1,000,000 records, PySpark achieves a <strong>1.68x speedup</strong> over Pandas (8.40s vs 14.08s) through columnar partitioning and multi-core execution.
          </div>
        </div>

        {/* Distributed MLlib Metrics & Benchmark Summary Table (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Spark MLlib Model Card */}
          {mllibData && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-sky-600" />
                  <span>Spark MLlib Distributed Model</span>
                </h4>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Distributed Cluster
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Model Type</span>
                  <span className="font-bold text-slate-800">{mllibData.model_type}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Ensemble Specs</span>
                  <span className="font-bold text-slate-800">{mllibData.trees} Trees, Depth {mllibData.max_depth}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Distributed ROC-AUC</span>
                  <span className="font-bold text-sky-700">{mllibData.roc_auc}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Distributed Accuracy</span>
                  <span className="font-bold text-emerald-700">{(mllibData.accuracy * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Benchmark Table */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Throughput & Scaling Metrics</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2 px-2">Scale</th>
                    <th className="py-2 px-2 text-right">Pandas</th>
                    <th className="py-2 px-2 text-right">PySpark</th>
                    <th className="py-2 px-2 text-right">Spark Throughput</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {benchmarks.map((b) => (
                    <tr key={b.rows_label}>
                      <td className="py-2 px-2 font-bold text-slate-900">{b.rows_label} Rows</td>
                      <td className="py-2 px-2 text-right text-orange-600 font-semibold">{b.pandas_seconds}s</td>
                      <td className="py-2 px-2 text-right text-sky-600 font-semibold">{b.pyspark_seconds}s</td>
                      <td className="py-2 px-2 text-right text-slate-700">
                        {b.pyspark_throughput_rows_per_sec?.toLocaleString()} rows/s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
