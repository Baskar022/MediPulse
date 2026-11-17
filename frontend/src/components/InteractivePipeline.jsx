import React, { useEffect, useState } from 'react';
import {
  PlaySquare, CheckCircle2, AlertCircle, RefreshCw, Terminal,
  Clock, ArrowRight, Layers, FileCode, Cpu, ShieldAlert,
  ChevronRight, CornerDownRight
} from 'lucide-react';
import { fetchPipelineStages, triggerPipelineStage, fetchPipelineJobStatus, fetchPipelineHistory } from '../api';

export default function InteractivePipeline() {
  const [stages, setStages] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState(null);
  const [error, setError] = useState(null);

  const loadPipelineInfo = async () => {
    try {
      const [s, h] = await Promise.all([fetchPipelineStages(), fetchPipelineHistory()]);
      setStages(s);
      setHistory(h);
      // If there is an active job, pick it
      const running = h.find((j) => j.status === 'running' || j.status === 'pending');
      if (running && (!activeJob || activeJob.job_id !== running.job_id)) {
        setActiveJob(running);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelineInfo();
  }, []);

  // Polling active job
  useEffect(() => {
    let timer = null;
    if (activeJob && (activeJob.status === 'running' || activeJob.status === 'pending')) {
      timer = setInterval(async () => {
        try {
          const updated = await fetchPipelineJobStatus(activeJob.job_id);
          setActiveJob(updated);
          if (updated.status === 'success' || updated.status === 'failed') {
            loadPipelineInfo();
          }
        } catch (err) {
          console.error('Job polling error:', err);
        }
      }, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeJob]);

  const handleRunStage = async (stageId) => {
    setError(null);
    try {
      const newJob = await triggerPipelineStage(stageId);
      setActiveJob(newJob);
      loadPipelineInfo();
    } catch (err) {
      setError(err.message);
    }
  };

  const stageKeys = ['ingest', 'clean', 'features', 'analytics', 'mllib', 'benchmark'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PlaySquare className="w-6 h-6 text-sky-600" />
            <span>Data Processing Pipelines</span>
          </h1>
          <p className="text-sm text-slate-500">
            Execute, inspect, monitor, and audit healthcare data transformation and ingestion stages in real-time.
          </p>
        </div>

        <button
          onClick={loadPipelineInfo}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Stage State</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stage Flow Execution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stageKeys.map((sId, idx) => {
          const st = stages[sId] || {};
          const isRunningThis = activeJob && activeJob.stage_id === sId && activeJob.status === 'running';
          const isPendingThis = activeJob && activeJob.stage_id === sId && activeJob.status === 'pending';

          return (
            <div
              key={sId}
              className={`p-4 rounded-xl border bg-white shadow-2xs flex flex-col justify-between transition ${
                isRunningThis
                  ? 'ring-2 ring-sky-500 border-transparent bg-sky-50/20'
                  : st.has_output
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-dashed border-slate-300 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Stage {idx + 1}: {sId.toUpperCase()}
                  </span>

                  {st.has_output ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Ready
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono">Not Run</span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-1">{st.name || sId}</h3>
                <p className="text-xs text-slate-500 mb-3">{st.description}</p>

                <div className="text-[11px] font-mono text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3">
                  <div className="truncate">Script: <code className="text-sky-800">{st.script}</code></div>
                  <div className="truncate">Output: <code className="text-slate-700">{st.output_path}</code></div>
                  {st.output_size_bytes && (
                    <div>Size: {(st.output_size_bytes / (1024 * 1024)).toFixed(2)} MB</div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  disabled={Boolean(activeJob && (activeJob.status === 'running' || activeJob.status === 'pending'))}
                  onClick={() => handleRunStage(sId)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5 ${
                    isRunningThis || isPendingThis
                      ? 'bg-amber-500 text-white animate-pulse cursor-wait'
                      : activeJob && (activeJob.status === 'running' || activeJob.status === 'pending')
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-sky-600 hover:bg-sky-700 text-white'
                  }`}
                >
                  {isRunningThis ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing in Background...</span>
                    </>
                  ) : (
                    <>
                      <PlaySquare className="w-3.5 h-3.5" />
                      <span>Run {st.name ? st.name.split(' ')[0] : sId}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Active Execution Console */}
      {activeJob && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white">Live Execution Terminal:</span>
              <span className="text-sky-300 font-mono">{activeJob.stage_name} (Job: {activeJob.job_id})</span>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                activeJob.status === 'running'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse'
                  : activeJob.status === 'success'
                  ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-rose-400/20 text-rose-300 border border-rose-400/30'
              }`}>
                {activeJob.status}
              </span>

              {activeJob.duration_seconds && (
                <span className="text-slate-400 font-mono text-[11px]">
                  Duration: {activeJob.duration_seconds}s
                </span>
              )}
            </div>
          </div>

          <div className="p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto space-y-1 bg-black/40">
            {activeJob.logs.length === 0 ? (
              <p className="text-slate-500 italic">Initiating PySpark process in background thread...</p>
            ) : (
              activeJob.logs.map((line, lIdx) => (
                <div key={lIdx} className="leading-relaxed hover:bg-slate-800/40 px-1 rounded">
                  <span className="text-slate-400 select-none mr-2">$</span>
                  <span className={line.includes('WARN') ? 'text-amber-300' : line.includes('INFO') ? 'text-emerald-300' : 'text-slate-300'}>
                    {line}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Execution History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>Pipeline Stage Execution History</span>
            </h3>
            <p className="text-xs text-slate-500">Audit trail of real backend jobs triggered during this session</p>
          </div>
          <span className="text-xs text-slate-500 font-mono font-bold">
            {history.length} Jobs Logged
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No pipeline jobs executed yet in this session. Click any "Run" button above to launch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-4">Job ID</th>
                  <th className="py-2.5 px-4">Stage</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Duration</th>
                  <th className="py-2.5 px-4">Started At</th>
                  <th className="py-2.5 px-4">Result / Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {history.map((j) => (
                  <tr key={j.job_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setActiveJob(j)}>
                    <td className="py-2.5 px-4 font-bold text-sky-700">{j.job_id}</td>
                    <td className="py-2.5 px-4 text-slate-800 font-semibold">{j.stage_name}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        j.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : j.status === 'running'
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700 font-bold">
                      {j.duration_seconds ? `${j.duration_seconds}s` : '--'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-sans font-medium whitespace-nowrap">
                      {j.started_at ? (
                        typeof j.started_at === 'string' && j.started_at.includes('IST')
                          ? j.started_at
                          : new Date(j.started_at_iso || j.started_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST'
                      ) : '--'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 truncate max-w-xs font-sans">
                      {j.message || j.error || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
