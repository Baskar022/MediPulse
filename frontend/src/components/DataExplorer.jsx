import React, { useEffect, useState } from 'react';
import {
  Table2, Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  Database, AlertCircle, FileText, Download, CheckCircle2, RefreshCw,
  Layers, HardDrive, Info
} from 'lucide-react';
import { fetchAvailableLayers, previewLayerData } from '../api';

export default function DataExplorer() {
  const [layers, setLayers] = useState({});
  const [selectedLayer, setSelectedLayer] = useState('gold');
  const [loadingLayers, setLoadingLayers] = useState(true);

  // Table Data State
  const [dataPayload, setDataPayload] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDesc, setSortDesc] = useState(false);
  const [error, setError] = useState(null);

  // Active column inspection modal/panel
  const [selectedColumn, setSelectedColumn] = useState(null);

  useEffect(() => {
    async function loadLayers() {
      setLoadingLayers(true);
      try {
        const l = await fetchAvailableLayers();
        setLayers(l);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingLayers(false);
      }
    }
    loadLayers();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const res = await previewLayerData(selectedLayer, {
        page,
        pageSize,
        search,
        sortBy,
        sortDesc
      });
      setDataPayload(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLayer, page, pageSize, sortBy, sortDesc]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(col);
      setSortDesc(false);
    }
    setPage(1);
  };

  const currentStats = layers[selectedLayer] || {};

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Table2 className="w-6 h-6 text-sky-600" />
            <span>Medallion Data Lakehouse Explorer</span>
          </h1>
          <p className="text-sm text-slate-500">
            Directly browse, query, filter, and inspect physical schemas across Raw, Bronze, Silver, and Gold Parquet layers.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
          <HardDrive className="w-4 h-4 text-slate-500" />
          <span>Storage: Apache Parquet Columnar</span>
        </div>
      </div>

      {/* Medallion Layer Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['raw', 'bronze', 'silver', 'gold'].map((l) => {
          const isSelected = selectedLayer === l;
          const stat = layers[l] || {};
          const colors = {
            raw: 'border-slate-300 hover:border-slate-400',
            bronze: 'border-amber-400 hover:border-amber-500',
            silver: 'border-slate-400 hover:border-slate-500',
            gold: 'border-emerald-400 hover:border-emerald-500',
          };
          const badges = {
            raw: 'bg-slate-100 text-slate-700',
            bronze: 'bg-amber-100 text-amber-800',
            silver: 'bg-slate-200 text-slate-800',
            gold: 'bg-emerald-100 text-emerald-800',
          };

          return (
            <button
              key={l}
              onClick={() => {
                setSelectedLayer(l);
                setPage(1);
                setSearch('');
                setSortBy('');
                setSelectedColumn(null);
              }}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                isSelected
                  ? 'bg-white ring-2 ring-sky-500 shadow-md border-transparent'
                  : `bg-slate-50/80 ${colors[l]} opacity-80 hover:opacity-100`
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${badges[l]}`}>
                  {l} Layer
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {stat.format || 'Parquet'}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 mt-1">
                {stat.total_records ? stat.total_records.toLocaleString() : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">rows</span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                <span>{stat.total_columns || '--'} columns</span>
                <span>{stat.file_size_mb ? `${stat.file_size_mb} MB` : ''}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Layer Clinical Context Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-bold text-slate-900 mr-2">{currentStats.title || selectedLayer.toUpperCase()}</span>
          <span className="text-slate-600">{currentStats.description}</span>
          {currentStats.duplicate_patients > 0 && (
            <span className="ml-2 inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
              ⚠️ {currentStats.duplicate_patients.toLocaleString()} repeat patient visits present (Temporal leakage uncleaned in this layer)
            </span>
          )}
          {selectedLayer === 'gold' && (
            <span className="ml-2 inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
              ✅ De-leaked: 69,990 unique patients (Index visit only)
            </span>
          )}
        </div>
        <div className="font-mono text-slate-500 shrink-0">
          File: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">{currentStats.path}</code>
        </div>
      </div>

      {/* Search, Page Size & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search records in ${selectedLayer} layer (e.g. Circulatory, 428, Emergency)...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs shadow-2xs transition"
          >
            Filter
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                loadData();
              }}
              className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex items-center gap-3 text-xs text-slate-600 shrink-0">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border border-slate-300 rounded-md p-1.5 bg-slate-50 text-xs font-medium"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loadingData ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">Reading columnar Parquet partition from disk...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-700">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-bold">Failed to load layer data</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
        ) : !dataPayload || dataPayload.data.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No matching records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider select-none">
                <tr>
                  <th className="py-2.5 px-3 text-slate-400 w-12 text-center">#</th>
                  {dataPayload.columns.slice(0, 18).map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="py-2.5 px-3 hover:bg-slate-100 cursor-pointer transition whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col}</span>
                        <ArrowUpDown className={`w-3 h-3 ${sortBy === col ? 'text-sky-600 font-bold' : 'text-slate-300'}`} />
                      </div>
                    </th>
                  ))}
                  {dataPayload.columns.length > 18 && (
                    <th className="py-2.5 px-3 text-slate-400">+{dataPayload.columns.length - 18} more cols</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {dataPayload.data.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/80 transition font-mono">
                    <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                      {(page - 1) * pageSize + rIdx + 1}
                    </td>
                    {dataPayload.columns.slice(0, 18).map((col) => {
                      const val = row[col];
                      const isNull = val === null || val === undefined;
                      const isTarget = col === 'readmitted_30d';

                      return (
                        <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-700">
                          {isNull ? (
                            <span className="text-slate-300 italic font-sans text-[10px]">NULL</span>
                          ) : isTarget ? (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              val === 1 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {val === 1 ? '1 (Readmitted <30d)' : '0 (No Readmit)'}
                            </span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                    {dataPayload.columns.length > 18 && (
                      <td className="py-2 px-3 text-slate-400 text-[11px]">...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination Controls */}
        {dataPayload && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-900">
                {Math.min(page * pageSize, dataPayload.filtered_records)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{dataPayload.filtered_records.toLocaleString()}</span> entries
              {dataPayload.filtered_records < dataPayload.total_records && (
                <span className="text-slate-400 ml-1">
                  (filtered from {dataPayload.total_records.toLocaleString()} total)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <span className="px-2 font-mono font-medium">
                Page {page} of {dataPayload.total_pages}
              </span>

              <button
                disabled={page >= dataPayload.total_pages}
                onClick={() => setPage((p) => Math.min(dataPayload.total_pages, p + 1))}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Schema & Column Distributions Viewer */}
      {currentStats.columns_summary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Column Data Types, Distinct Values & Missingness Profile</span>
              </h3>
              <p className="text-xs text-slate-500">
                Schema inspection derived directly from Parquet metadata dictionary
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
              {currentStats.total_columns} Physical Attributes
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full text-xs text-left divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                <tr>
                  <th className="py-2 px-3">Column Name</th>
                  <th className="py-2 px-3">Physical Type</th>
                  <th className="py-2 px-3 text-right">Distinct Values</th>
                  <th className="py-2 px-3 text-right">Missing / Null Count</th>
                  <th className="py-2 px-3 text-right">Null %</th>
                  <th className="py-2 px-3">Sample Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {currentStats.columns_summary.map((c) => (
                  <tr key={c.name} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-800">{c.name}</td>
                    <td className="py-2 px-3 text-sky-700">{c.type}</td>
                    <td className="py-2 px-3 text-right text-slate-700">{c.distinct_values.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-slate-700">{c.null_count.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        c.null_pct > 30 ? 'bg-rose-100 text-rose-800' : c.null_pct > 0 ? 'bg-amber-100 text-amber-800' : 'text-slate-400'
                      }`}>
                        {c.null_pct}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 truncate max-w-xs font-sans">
                      {c.sample_values.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
