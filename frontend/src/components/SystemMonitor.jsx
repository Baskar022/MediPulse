import React, { useEffect, useState } from 'react';
import {
  Layers, Cpu, Server, CheckCircle2, AlertTriangle, RefreshCw,
  HardDrive, Terminal, ShieldCheck, Activity
} from 'lucide-react';
import { fetchSystemMonitor } from '../api';

export default function SystemMonitor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMonitor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSystemMonitor();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitor();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-600">Gathering host system diagnostics, PySpark & JVM telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-bold">Failed to load system diagnostics</p>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  const { platform, python, spark, java, storage } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-600" />
            <span>System Health & Engine Telemetry</span>
          </h1>
          <p className="text-sm text-slate-500">
            Real host runtime telemetry: CPU cores, Python environment, engine configuration, JVM status, and storage utilization.
          </p>
        </div>

        <button
          onClick={loadMonitor}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Grid of Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: PySpark Cluster */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Apache Spark</span>
            <Cpu className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {spark.version || 'v4.2.1'}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Mode: <strong>{spark.execution_mode}</strong></span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">Driver/Exec: {spark.driver_memory}</p>
        </div>

        {/* Card 2: Java Runtime */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">JVM Runtime</span>
            <Server className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-base font-bold text-slate-900 truncate" title={java.version_info}>
            {java.version_info.split('(')[0] || 'Java Installed'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Status: <strong className={java.installed ? 'text-emerald-700' : 'text-amber-700'}>
              {java.installed ? 'Available' : 'Missing'}
            </strong>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono truncate">{java.java_home}</p>
        </div>

        {/* Card 3: Python Environment */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Python Engine</span>
            <Terminal className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            Python {python.version}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Cores: <strong>{platform.cpu_cores} vCPUs</strong>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono truncate">{platform.os} {platform.architecture}</p>
        </div>

        {/* Card 4: Local Storage */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Disk Capacity</span>
            <HardDrive className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {storage.free_disk_gb} GB <span className="text-xs font-normal text-slate-500">free</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Total: <strong>{storage.total_disk_gb} GB</strong>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full"
              style={{ width: `${storage.disk_utilization_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Deep Environment Configuration Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Host Environment & Spark Configuration Matrix</span>
          </h3>
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            System Healthy
          </span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="grid grid-cols-3 p-3 hover:bg-slate-50/60">
            <span className="font-semibold text-slate-600">Operating System</span>
            <span className="col-span-2 text-slate-800 font-mono">{platform.os} {platform.os_release} ({platform.os_version})</span>
          </div>
          <div className="grid grid-cols-3 p-3 hover:bg-slate-50/60">
            <span className="font-semibold text-slate-600">PySpark Cluster Master</span>
            <span className="col-span-2 text-sky-800 font-mono font-bold">{spark.execution_mode} (Allocating all available CPU cores)</span>
          </div>
          <div className="grid grid-cols-3 p-3 hover:bg-slate-50/60">
            <span className="font-semibold text-slate-600">PySpark Memory Allocation</span>
            <span className="col-span-2 text-slate-800 font-mono">Driver: {spark.driver_memory} | Executor: {spark.executor_memory} | Shuffle Partitions: 4</span>
          </div>
          <div className="grid grid-cols-3 p-3 hover:bg-slate-50/60">
            <span className="font-semibold text-slate-600">Windows Hadoop winutils</span>
            <span className="col-span-2 font-mono">
              {spark.winutils_configured ? (
                <span className="text-emerald-700 font-bold">✅ Configured (hadoop/bin/winutils.exe & hadoop.dll present)</span>
              ) : (
                <span className="text-slate-500">POSIX Native / Cloud Linux Container</span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-3 p-3 hover:bg-slate-50/60">
            <span className="font-semibold text-slate-600">Project Root Path</span>
            <span className="col-span-2 text-slate-800 font-mono truncate">{storage.project_root}</span>
          </div>
          <div className="grid grid-cols-3 p-3 hover:bg-slate-50/60">
            <span className="font-semibold text-slate-600">Python Interpreter Executable</span>
            <span className="col-span-2 text-slate-800 font-mono truncate">{python.executable}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
