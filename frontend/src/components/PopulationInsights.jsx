import React, { useEffect, useState } from 'react';
import {
  Users, Filter, AlertTriangle, Layers, ChevronRight,
  TrendingUp, Award, RefreshCw, Search
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts';
import { fetchAnalytics } from '../api';

export default function PopulationInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedDiagnosis, setSelectedDiagnosis] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchAnalytics();
        setData(res);
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
        <p className="text-sm font-medium text-slate-600">Loading Population Analytics & High-Risk Segments...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-red-700">
        <p>{error || 'Failed to load population data'}</p>
      </div>
    );
  }

  const segments = data.high_risk_segments || [];
  const dischargeData = data.by_discharge_disposition || [];
  const admissionData = data.by_admission_type || [];
  const diagnosisData = data.by_diagnosis || [];

  // Filter high-risk segments
  const filteredSegments = segments.filter((seg) => {
    const matchesDiag = selectedDiagnosis === 'All' || seg.primary_diagnosis === selectedDiagnosis;
    const matchesSearch =
      seg.primary_diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seg.discharge_disposition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seg.age_group.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDiag && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Population Health & High-Risk Stratification</h1>
        <p className="text-sm text-slate-500">
          Multi-dimensional Spark SQL grouping identifying patient cohorts with acute readmission exposure.
        </p>
      </div>

      {/* Discharge Disposition & Admission Mode Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discharge Disposition Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Readmission by Discharge Destination</h3>
              <p className="text-xs text-slate-500">Post-acute care transition outcomes</p>
            </div>
            <span className="text-xs font-medium text-sky-700 bg-sky-50 px-2 py-1 rounded">Discharge Analysis</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dischargeData.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Readmission Rate']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="readmission_rate_pct" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {dischargeData.slice(0, 6).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.readmission_rate_pct > 12.0 ? '#ef4444' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Transfers to Skilled Nursing Facilities (SNF) exhibit higher bounceback rates than home discharges.
          </p>
        </div>

        {/* Admission Type Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Readmission by Admission Acuity</h3>
              <p className="text-xs text-slate-500">Emergency vs. Urgent vs. Elective clinical pathways</p>
            </div>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded">Admission Mode</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={admissionData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Readmission Rate']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="readmission_rate_pct" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Emergency admissions display higher readmission odds than scheduled elective admissions.
          </p>
        </div>
      </div>

      {/* Top 10 High-Risk Segments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Top High-Risk Clinical Patient Segments</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cohorts generated via Spark SQL multi-grouping (Diagnosis × Discharge Destination × Age × Prior Inpatient Status, min size 50).
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search cohort..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white"
              />
            </div>

            <select
              value={selectedDiagnosis}
              onChange={(e) => setSelectedDiagnosis(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white font-medium"
            >
              <option value="All">All Diagnoses</option>
              {diagnosisData.map((d) => (
                <option key={d.label} value={d.label}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Primary Diagnosis</th>
                <th className="py-3 px-4">Discharge Disposition</th>
                <th className="py-3 px-4">Age Group</th>
                <th className="py-3 px-4">Prior Inpatient Status</th>
                <th className="py-3 px-4 text-right">Cohort Size</th>
                <th className="py-3 px-4 text-right">Avg Stay</th>
                <th className="py-3 px-4 text-right">Readmit Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredSegments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    No matching segments found for this filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSegments.map((seg) => (
                  <tr key={seg.rank} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">#{seg.rank}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                        {seg.primary_diagnosis}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{seg.discharge_disposition}</td>
                    <td className="py-3 px-4 text-slate-600">{seg.age_group}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        seg.prior_inpatient_status.includes('Prior')
                          ? 'bg-rose-50 text-rose-700 font-medium'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {seg.prior_inpatient_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {seg.segment_size.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {seg.avg_length_of_stay} days
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                      {seg.readmission_rate_pct}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
