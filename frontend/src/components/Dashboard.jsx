import React, { useEffect, useState } from 'react';
import {
  Users, Activity, Clock, AlertTriangle, Pill, Stethoscope,
  TrendingUp, CheckCircle, RefreshCw, Layers
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts';
import { fetchAnalytics } from '../api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAnalytics();
      setData(res);
    } catch (err) {
      setError(err.message || 'Unable to connect to backend analytics API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Querying Apache Spark SQL Gold Lakehouse Aggregations...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <AlertTriangle className="w-10 h-10 text-red-600 mx-auto mb-2" />
        <h3 className="text-lg font-bold text-red-800">Analytics Data Unavailable</h3>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const kpis = data.kpis || {};
  const diagnosisData = data.by_diagnosis || [];
  const ageData = data.by_age || [];
  const stayData = data.by_stay_duration || [];
  const a1cData = data.by_a1c || [];

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hospital Executive Overview</h1>
          <p className="text-sm text-slate-500">
            Real-time population health telemetry derived from {kpis.total_encounters?.toLocaleString()} deduplicated patient encounters via Spark SQL.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          <Layers className="w-4 h-4 text-sky-600" />
          <span>Storage: Parquet Gold Layer</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Patient Cohort</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {kpis.total_encounters?.toLocaleString() || '--'}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Unique encounters</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">30-Day Readmission</span>
            <Activity className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-700">
              {kpis.readmission_rate_pct}%
            </div>
            <p className="text-xs text-rose-600/80 mt-0.5">{kpis.total_readmitted_30d?.toLocaleString()} readmissions</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Length of Stay</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {kpis.avg_stay_days} <span className="text-sm font-normal text-slate-500">days</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Per hospital stay</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Medications</span>
            <Pill className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {kpis.avg_medications}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Active meds/encounter</p>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Prior Visits</span>
            <Stethoscope className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {kpis.avg_prior_visits}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Acute visits past yr</p>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Target Flag</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">
              {kpis.high_risk_share_pct}%
            </div>
            <p className="text-xs text-slate-500 mt-0.5">CMS readmit incidence</p>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Readmission by Primary Diagnosis */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">30-Day Readmission by Clinical Diagnosis</h3>
              <p className="text-xs text-slate-500">Grouped ICD-9 diagnostic categories</p>
            </div>
            <span className="text-xs font-medium text-sky-700 bg-sky-50 px-2 py-1 rounded">Spark GroupBy</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagnosisData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Readmission Rate']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="readmission_rate_pct" fill="#0284c7" radius={[4, 4, 0, 0]}>
                  {diagnosisData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.readmission_rate_pct > 10.0 ? '#ef4444' : '#0284c7'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            *Red bars denote clinical cohorts exceeding the 10.0% readmission risk threshold.
          </p>
        </div>

        {/* Chart 2: Readmission by Age Bracket */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">30-Day Readmission by Patient Age Group</h3>
              <p className="text-xs text-slate-500">Stratified geriatric and adult demographics</p>
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Demographics</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Readmission Rate']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="readmission_rate_pct" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Senior cohorts ([70-80), [80-90)) represent {Math.round((ageData.filter(a => a.label.includes('70') || a.label.includes('80')).reduce((s, a) => s + a.total_count, 0) / kpis.total_encounters) * 100)}% of total hospital volume.
          </p>
        </div>
      </div>

      {/* Secondary Charts: Length of Stay & HbA1c */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Length of Stay Buckets */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Risk by Hospital Stay Duration</h3>
              <p className="text-xs text-slate-500">Inpatient stay length vs. 30-day bounceback probability</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stayData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Readmission Rate']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="readmission_rate_pct" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* HbA1c Testing Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">HbA1c Lab Testing & Readmission Outcome</h3>
              <p className="text-xs text-slate-500">Comparison of glycemic monitoring documentation</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a1cData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Readmission Rate']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="readmission_rate_pct" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
