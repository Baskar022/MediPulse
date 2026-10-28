import React, { useEffect, useState } from 'react';
import {
  Brain, ShieldCheck, Scale, AlertOctagon, CheckCircle2,
  LineChart as LineChartIcon, RefreshCw, Info, HelpCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { fetchModelMetrics } from '../api';

export default function ModelTransparency() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCurve, setActiveCurve] = useState('roc'); // 'roc' or 'pr'

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchModelMetrics();
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
        <p className="text-sm font-medium text-slate-600">Retrieving Model Metrics, ROC/PR Curves & Fairness Audits...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-red-700">
        <p>{error || 'Failed to load model metrics'}</p>
      </div>
    );
  }

  const metricsObj = data.metrics || {};
  const testMetrics = metricsObj.test_metrics || {};
  const comparison = metricsObj.model_comparison || [];
  const cm = testMetrics.confusion_matrix || { tn: 0, fp: 0, fn: 0, tp: 0 };
  const curves = data.curves || {};
  const fairness = data.fairness || {};
  const totalCases = cm.tn + cm.fp + cm.fn + cm.tp;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Model Governance, Transparency & Fairness</h1>
        <p className="text-sm text-slate-500">
          Rigorous clinical evaluation on held-out patient cohorts with calibrated sensitivity and demographic parity auditing.
        </p>
      </div>

      {/* Model Selection & Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-sky-600" />
              <span>Algorithm Comparison & Champion Selection</span>
            </h3>
            <p className="text-xs text-slate-500">Evaluated on 10,498 validation encounters with class weighting</p>
          </div>
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
            Selected: {metricsObj.champion_model || 'XGBoost'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">Model Candidate</th>
                <th className="py-3 px-4 text-right">Validation ROC-AUC</th>
                <th className="py-3 px-4 text-right">Validation PR-AUC</th>
                <th className="py-3 px-4 text-right">Sensitivity / Recall</th>
                <th className="py-3 px-4 text-right">Precision</th>
                <th className="py-3 px-4 text-right">F1-Score</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {comparison.map((m) => {
                const isChampion = m.model_name === metricsObj.champion_model;
                return (
                  <tr key={m.model_name} className={isChampion ? 'bg-sky-50/40 font-semibold' : 'hover:bg-slate-50'}>
                    <td className="py-3 px-4 text-slate-900">{m.model_name}</td>
                    <td className="py-3 px-4 text-right text-slate-800">{m.roc_auc}</td>
                    <td className="py-3 px-4 text-right text-slate-800">{m.pr_auc}</td>
                    <td className="py-3 px-4 text-right text-slate-800">{(m.recall * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-slate-800">{(m.precision * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-slate-800">{m.f1_score}</td>
                    <td className="py-3 px-4 text-center">
                      {isChampion ? (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-sky-100 text-sky-800 font-bold">Champion</span>
                      ) : (
                        <span className="text-slate-400 text-xs">Baseline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Held-out Test Metrics KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Held-Out ROC-AUC</div>
          <div className="text-2xl font-black text-sky-600 mt-1">{testMetrics.roc_auc}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Global discriminative power</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">PR-AUC (Avg Prec)</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{testMetrics.pr_auc}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Baseline: {(curves.baseline_prevalence * 100).toFixed(1)}%</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Sensitivity (Recall)</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">{(testMetrics.recall * 100).toFixed(1)}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Captures readmitted cohort</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Precision (PPV)</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{(testMetrics.precision * 100).toFixed(1)}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Positive predictive value</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Operational Threshold</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{metricsObj.operational_threshold}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Platt calibrated cut-off</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Calibration Method</div>
          <div className="text-base font-bold text-slate-900 mt-2 truncate">Sigmoid (Platt)</div>
          <p className="text-[11px] text-slate-400 mt-0.5">CalibratedClassifierCV</p>
        </div>
      </div>

      {/* Curves & Confusion Matrix Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Curves (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeCurve === 'roc' ? 'ROC Curve (Receiver Operating Characteristic)' : 'Precision-Recall Curve (PRC)'}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeCurve === 'roc' ? 'True Positive Rate vs. False Positive Rate across all thresholds' : 'Precision vs. Recall addressing extreme class imbalance'}
                </p>
              </div>

              {/* Curve Toggle */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setActiveCurve('roc')}
                  className={`px-3 py-1 rounded-md transition ${activeCurve === 'roc' ? 'bg-white shadow text-sky-700 font-bold' : 'text-slate-600'}`}
                >
                  ROC
                </button>
                <button
                  onClick={() => setActiveCurve('pr')}
                  className={`px-3 py-1 rounded-md transition ${activeCurve === 'pr' ? 'bg-white shadow text-emerald-700 font-bold' : 'text-slate-600'}`}
                >
                  PR Curve
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {activeCurve === 'roc' ? (
                  <LineChart data={curves.roc_curve || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'False Positive Rate (1 - Specificity)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#64748b' }} />
                    <YAxis dataKey="tpr" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'True Positive Rate (Recall)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Rate']} />
                    <ReferenceLine x={0.13} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Threshold (0.13)', fill: '#b45309', fontSize: 10 }} />
                    <Line type="monotone" dataKey="tpr" stroke="#0284c7" strokeWidth={2.5} dot={false} name="Model ROC" />
                  </LineChart>
                ) : (
                  <LineChart data={curves.pr_curve || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="recall" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Recall (Sensitivity)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#64748b' }} />
                    <YAxis dataKey="precision" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Precision (PPV)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Rate']} />
                    <ReferenceLine y={curves.baseline_prevalence} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Baseline (${(curves.baseline_prevalence*100).toFixed(1)}%)`, fill: '#ef4444', fontSize: 10 }} />
                    <Line type="monotone" dataKey="precision" stroke="#10b981" strokeWidth={2.5} dot={false} name="Model PR" />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 text-xs text-slate-600">
            <strong>Clinical Justification:</strong> {metricsObj.threshold_justification}
          </div>
        </div>

        {/* Confusion Matrix Heatmap (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Operational Confusion Matrix</h3>
            <p className="text-xs text-slate-500 mb-4">Evaluated on {totalCases.toLocaleString()} held-out patient encounters</p>

            <div className="grid grid-cols-2 gap-3">
              {/* True Negative */}
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-center">
                <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wide">True Negatives (TN)</span>
                <div className="text-2xl font-black text-sky-900 mt-1">{cm.tn.toLocaleString()}</div>
                <div className="text-xs text-sky-700">{((cm.tn / totalCases) * 100).toFixed(1)}% of total</div>
                <p className="text-[10px] text-sky-600 mt-1">Correctly identified low-risk</p>
              </div>

              {/* False Positive */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">False Positives (FP)</span>
                <div className="text-2xl font-black text-amber-900 mt-1">{cm.fp.toLocaleString()}</div>
                <div className="text-xs text-amber-700">{((cm.fp / totalCases) * 100).toFixed(1)}% of total</div>
                <p className="text-[10px] text-amber-600 mt-1">Preventive outreach initiated</p>
              </div>

              {/* False Negative */}
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">False Negatives (FN)</span>
                <div className="text-2xl font-black text-rose-900 mt-1">{cm.fn.toLocaleString()}</div>
                <div className="text-xs text-rose-700">{((cm.fn / totalCases) * 100).toFixed(1)}% of total</div>
                <p className="text-[10px] text-rose-600 mt-1">Unflagged readmissions</p>
              </div>

              {/* True Positive */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">True Positives (TP)</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">{cm.tp.toLocaleString()}</div>
                <div className="text-xs text-emerald-700">{((cm.tp / totalCases) * 100).toFixed(1)}% of total</div>
                <p className="text-[10px] text-emerald-600 mt-1">Interventions delivered</p>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-4">
            <strong>Operational Trade-off:</strong> In clinical readmission prevention, False Positives (a precautionary follow-up call) cost ~$15, whereas an unprevented False Negative readmission incurs an average inpatient cost of ~$14,000 and penalty exposure under CMS HRRP.
          </div>
        </div>
      </div>

      {/* Fairness & Ethics Subgroup Audits */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              <span>Demographic Parity & Subgroup Fairness Audit</span>
            </h3>
            <p className="text-xs text-slate-500">Evaluating Equal Opportunity (Recall) & ROC-AUC across Race, Gender, and Age cohorts</p>
          </div>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">Fairness Check</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Race Subgroups */}
          <div className="p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Race / Ethnicity Subgroups</h4>
            <div className="space-y-2.5 text-xs">
              {(fairness.race || []).map((sub) => (
                <div key={sub.subgroup} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{sub.subgroup}</span>
                    <span className="text-sky-700">AUC: {sub.roc_auc}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 mt-1 text-[11px]">
                    <span>Cohort: {sub.sample_size.toLocaleString()}</span>
                    <span>Recall: {(sub.recall * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gender Subgroups */}
          <div className="p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Gender Subgroups</h4>
            <div className="space-y-2.5 text-xs">
              {(fairness.gender || []).map((sub) => (
                <div key={sub.subgroup} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{sub.subgroup}</span>
                    <span className="text-indigo-700">AUC: {sub.roc_auc}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 mt-1 text-[11px]">
                    <span>Cohort: {sub.sample_size.toLocaleString()}</span>
                    <span>Recall: {(sub.recall * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Age Cohorts */}
          <div className="p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Top Age Cohorts</h4>
            <div className="space-y-2.5 text-xs">
              {(fairness.age || []).slice(0, 4).map((sub) => (
                <div key={sub.subgroup} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{sub.subgroup}</span>
                    <span className="text-emerald-700">AUC: {sub.roc_auc}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 mt-1 text-[11px]">
                    <span>Cohort: {sub.sample_size.toLocaleString()}</span>
                    <span>Recall: {(sub.recall * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Model Limitations & Ethics */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3 text-xs text-slate-600">
        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-amber-600" />
          <span>Clinical Implementation Limitations & Ethical Safeguards</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <strong className="text-slate-800 block mb-1">EHR Retrospective Bias</strong>
            Data collected between 1999–2008 reflects legacy inpatient treatment guidelines. Modern continuous glucose monitors (CGM) and SGLT2 inhibitors are absent.
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <strong className="text-slate-800 block mb-1">Unmeasured SDOH Factors</strong>
            Clinical readmissions heavily depend on social determinants of health (food access, transportation, medication co-pay affordability) not captured in billing claims.
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <strong className="text-slate-800 block mb-1">Human-in-the-Loop Requirement</strong>
            This software is purely assistive. Model outputs must be cross-verified by a multidisciplinary discharge planning team before care transitions are finalized.
          </div>
        </div>
      </div>
    </div>
  );
}
