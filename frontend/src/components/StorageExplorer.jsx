import React, { useEffect, useState } from 'react';
import {
  HardDrive, Folder, File, Database, Layers, RefreshCw,
  AlertCircle, Download, CheckCircle2, FileCode, Clock
} from 'lucide-react';
import { fetchStorageExplorer } from '../api';

export default function StorageExplorer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const loadStorage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStorageExplorer();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-600">Scanning physical Lakehouse & artifacts directory tree...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-bold">Failed to inspect data lake storage</p>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  const items = data.items || [];
  const categories = ['All', 'Data Lake (Lakehouse)', 'Artifacts & Models'];
  const filtered = selectedCategory === 'All' ? items : items.filter((i) => i.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-sky-600" />
            <span>Storage Lakehouse & Parquet Artifact Tree</span>
          </h1>
          <p className="text-sm text-slate-500">
            Real-time file system inspection of Bronze/Silver/Gold Parquet partitions, serialized models, and JSON summaries.
          </p>
        </div>

        <button
          onClick={loadStorage}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Rescan Disk</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedCategory === c
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* File Tree Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <span>Authorized Lakehouse Files ({filtered.length} entries)</span>
          </h3>
          <span className="text-xs font-mono text-slate-500">Root: {data.root_directory}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Artifact / Directory Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4 text-right">Physical Size</th>
                <th className="py-2.5 px-4">Relative Path</th>
                <th className="py-2.5 px-4">Last Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] bg-white">
              {filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    {item.is_directory ? (
                      <Folder className="w-4 h-4 text-amber-500 fill-amber-100 shrink-0" />
                    ) : item.name.endsWith('.joblib') ? (
                      <Database className="w-4 h-4 text-indigo-500 shrink-0" />
                    ) : item.name.endsWith('.png') ? (
                      <File className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <FileCode className="w-4 h-4 text-sky-500 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-600">{item.category}</td>
                  <td className="py-2.5 px-4 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.is_directory ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.is_directory ? 'Directory' : item.name.split('.').pop()?.toUpperCase() || 'FILE'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-900 font-bold">
                    {item.size_formatted}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 text-[10px] truncate max-w-xs">
                    {item.relative_path}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 font-sans">
                    {new Date(item.modified_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
