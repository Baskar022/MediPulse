import React, { useEffect, useState, useRef } from 'react';
import {
  Terminal, Play, Clock, CheckCircle2, AlertCircle, BarChart3,
  Layers, Code2, RefreshCw, FileText, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { fetchSqlQueries, executeSqlQuery } from '../api';

export default function SparkSqlWorkspace() {
  const [queries, setQueries] = useState([]);
  const [selectedQueryId, setSelectedQueryId] = useState('readmit_by_diagnosis');
  const [loadingList, setLoadingList] = useState(true);

  // Execution result
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const activeReqRef = useRef(0);

  useEffect(() => {
    async function load() {
      setLoadingList(true);
      try {
        const qList = await fetchSqlQueries();
        setQueries(qList);
        if (qList.length > 0) {
          // Auto execute default query
          runQuery('readmit_by_diagnosis');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingList(false);
      }
    }
    load();
  }, []);

  const runQuery = async (qId) => {
    setSelectedQueryId(qId);
    setExecuting(true);
    setError(null);
    const reqId = ++activeReqRef.current;

    try {
      const res = await executeSqlQuery(qId);
      if (reqId === activeReqRef.current) {
        setResult(res);
      }
    } catch (err) {
      if (reqId === activeReqRef.current) {
        setError(err.message || 'Query execution failed');
      }
    } finally {
      if (reqId === activeReqRef.current) {
        setExecuting(false);
      }
    }
  };

  const activeMeta = queries.find((q) => q.id === selectedQueryId) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Terminal className="w-6 h-6 text-sky-600" />
            <span>Clinical Query Workspace</span>
          </h1>
          <p className="text-sm text-slate-500">
            Execute clinical analytics queries and cohort aggregations directly across standardized patient encounter partitions.
          </p>
        </div>

        <div className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs text-slate-600">
          Engine: <strong className="text-sky-700">Spark SQL Catalyst Optimizer</strong>
        </div>
      </div>

      {/* Query Selector Template Pills */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Select Analytical Query Template:
        </div>
        <div className="flex flex-wrap gap-2">
          {queries.map((q) => {
            const isSelected = selectedQueryId === q.id;
            return (
              <button
                key={q.id}
                onClick={() => runQuery(q.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 opacity-80" />
                <span>{q.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SQL Code Box with Execution Controls */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">Spark SQL Statement:</span>
            <span className="text-sky-400 font-mono text-[11px]">{selectedQueryId}</span>
          </div>

          <button
            disabled={executing}
            onClick={() => runQuery(selectedQueryId)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {executing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Query</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 font-mono text-xs text-sky-300 bg-black/40 overflow-x-auto leading-relaxed">
          {result?.sql || activeMeta.sql || 'SELECT * FROM gold_encounters;'}
        </pre>

        {result && (
          <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Query returned {result.records_count} records
            </span>
            <span>Execution Duration: <strong className="text-white">{result.duration_seconds}s</strong></span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Visualization & Tabular Data Grid */}
      {result && (
        <div className="space-y-6">
          {/* Dynamic Recharts Bar Chart (if not purely tabular) */}
          {result.chart_type === 'bar' && result.data.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{result.title}</h3>
                  <p className="text-xs text-slate-500">{result.description}</p>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded border border-sky-100">
                  Dynamic Recharts SVG
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey={result.x_key} angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val) => [`${val}%`, 'Readmission Rate']}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                    <Bar dataKey="readmission_rate_pct" fill="#0284c7" radius={[4, 4, 0, 0]}>
                      {result.data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={Number(entry.readmission_rate_pct) > 10.0 ? '#ef4444' : '#0284c7'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabular Output Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <span>Resulting Dataset ({result.records_count} Rows)</span>
              </h3>
              <span className="text-xs font-mono text-slate-500">Spark DataFrame Result</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col} className="py-2.5 px-4 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px] bg-white">
                  {result.data.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/80 transition">
                      {result.columns.map((col) => {
                        const val = row[col];
                        const isRate = col.includes('rate') || col.includes('pct');
                        return (
                          <td key={col} className="py-2.5 px-4 whitespace-nowrap text-slate-800">
                            {isRate ? (
                              <span className={`font-bold ${Number(val) > 10 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {val}%
                              </span>
                            ) : (
                              String(val ?? '--')
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
