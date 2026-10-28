import React, { useState } from 'react';
import {
  Activity, AlertCircle, ArrowUpRight, ArrowDownRight, CheckCircle2,
  HelpCircle, UserCheck, Stethoscope, RefreshCw, FileText
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { predictRisk } from '../api';

const PRESETS = {
  high: {
    name: 'High-Risk Complex Diabetic',
    data: {
      age: '[70-80)',
      gender: 'Female',
      race: 'Caucasian',
      time_in_hospital: 7,
      num_lab_procedures: 62,
      num_procedures: 2,
      num_medications: 21,
      number_outpatient: 1,
      number_emergency: 2,
      number_inpatient: 3,
      number_diagnoses: 9,
      diag_1_category: 'Circulatory',
      admission_type_desc: 'Emergency',
      discharge_disposition_desc: 'Discharged/transferred to SNF',
      A1Cresult: '>8',
      max_glu_serum: 'None',
      change: 'Ch',
      diabetesMed: 'Yes',
      insulin: 'Up'
    }
  },
  moderate: {
    name: 'Moderate-Risk Standard Patient',
    data: {
      age: '[50-60)',
      gender: 'Male',
      race: 'AfricanAmerican',
      time_in_hospital: 4,
      num_lab_procedures: 42,
      num_procedures: 1,
      num_medications: 14,
      number_outpatient: 0,
      number_emergency: 0,
      number_inpatient: 1,
      number_diagnoses: 7,
      diag_1_category: 'Diabetes',
      admission_type_desc: 'Emergency',
      discharge_disposition_desc: 'Discharged to home',
      A1Cresult: 'Norm',
      max_glu_serum: 'None',
      change: 'Ch',
      diabetesMed: 'Yes',
      insulin: 'Steady'
    }
  },
  low: {
    name: 'Low-Risk Elective Patient',
    data: {
      age: '[30-40)',
      gender: 'Female',
      race: 'Caucasian',
      time_in_hospital: 2,
      num_lab_procedures: 28,
      num_procedures: 3,
      num_medications: 8,
      number_outpatient: 0,
      number_emergency: 0,
      number_inpatient: 0,
      number_diagnoses: 4,
      diag_1_category: 'Digestive',
      admission_type_desc: 'Elective',
      discharge_disposition_desc: 'Discharged to home',
      A1Cresult: 'None',
      max_glu_serum: 'None',
      change: 'No',
      diabetesMed: 'No',
      insulin: 'No'
    }
  }
};

export default function RiskPredictor() {
  const [formData, setFormData] = useState(PRESETS.high.data);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applyPreset = (key) => {
    setFormData(PRESETS[key].data);
    setResult(null);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await predictRisk(formData);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Error executing AI risk prediction model');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Readmission Risk Predictor</h1>
          <p className="text-sm text-slate-500">
            Real-time inference using Calibrated XGBoost with local TreeSHAP clinical attribution.
          </p>
        </div>
        {/* Preset Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('high')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
          >
            High Risk
          </button>
          <button
            type="button"
            onClick={() => applyPreset('moderate')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
          >
            Moderate
          </button>
          <button
            type="button"
            onClick={() => applyPreset('low')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
          >
            Low Risk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Patient Form (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 text-slate-800 font-semibold text-sm">
            <UserCheck className="w-4 h-4 text-sky-600" />
            <span>Clinical Encounter Parameters</span>
          </div>

          <form onSubmit={handlePredict} className="space-y-4">
            {/* Demographics Row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Age Bracket</label>
                <select
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500"
                >
                  {['[0-10)', '[10-20)', '[20-30)', '[30-40)', '[40-50)', '[50-60)', '[60-70)', '[70-80)', '[80-90)', '[90-100)'].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Race / Ethnicity</label>
                <select
                  name="race"
                  value={formData.race}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Caucasian">Caucasian</option>
                  <option value="AfricanAmerican">African American</option>
                  <option value="Hispanic">Hispanic</option>
                  <option value="Asian">Asian</option>
                  <option value="Other">Other / Unknown</option>
                </select>
              </div>
            </div>

            {/* Inpatient Stay & Prior Acute Utilization */}
            <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Length of Stay (Days)</label>
                <input
                  type="number"
                  name="time_in_hospital"
                  min="1"
                  max="14"
                  value={formData.time_in_hospital}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-rose-700 mb-1">Prior Inpatient Visits</label>
                <input
                  type="number"
                  name="number_inpatient"
                  min="0"
                  max="20"
                  value={formData.number_inpatient}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-rose-300 bg-rose-50/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prior Emergency</label>
                <input
                  type="number"
                  name="number_emergency"
                  min="0"
                  max="20"
                  value={formData.number_emergency}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prior Outpatient</label>
                <input
                  type="number"
                  name="number_outpatient"
                  min="0"
                  max="20"
                  value={formData.number_outpatient}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                />
              </div>
            </div>

            {/* Clinical Complexity */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lab Tests Done</label>
                <input
                  type="number"
                  name="num_lab_procedures"
                  min="1"
                  max="130"
                  value={formData.num_lab_procedures}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Procedures</label>
                <input
                  type="number"
                  name="num_procedures"
                  min="0"
                  max="6"
                  value={formData.num_procedures}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Medications Count</label>
                <input
                  type="number"
                  name="num_medications"
                  min="1"
                  max="80"
                  value={formData.num_medications}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Diagnoses Entered</label>
                <input
                  type="number"
                  name="number_diagnoses"
                  min="1"
                  max="16"
                  value={formData.number_diagnoses}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300"
                />
              </div>
            </div>

            {/* Diagnostic & Admission Details */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Diagnosis</label>
                <select
                  name="diag_1_category"
                  value={formData.diag_1_category}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50"
                >
                  <option value="Circulatory">Circulatory (Heart)</option>
                  <option value="Diabetes">Diabetes (250.xx)</option>
                  <option value="Respiratory">Respiratory</option>
                  <option value="Digestive">Digestive</option>
                  <option value="Genitourinary">Genitourinary</option>
                  <option value="Musculoskeletal">Musculoskeletal</option>
                  <option value="Neoplasms">Neoplasms</option>
                  <option value="Injury">Injury</option>
                  <option value="Other">Other Clinical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Type</label>
                <select
                  name="admission_type_desc"
                  value={formData.admission_type_desc}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50"
                >
                  <option value="Emergency">Emergency</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Elective">Elective</option>
                  <option value="Other/Unknown">Other / Not Mapped</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Discharge Disposition</label>
                <select
                  name="discharge_disposition_desc"
                  value={formData.discharge_disposition_desc}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50"
                >
                  <option value="Discharged to home">Discharged to home</option>
                  <option value="Discharged/transferred to SNF">Discharged to SNF</option>
                  <option value="Discharged/transferred to home with home health service">Home Health Service</option>
                  <option value="Discharged/transferred to another short term general hospital">Short Term Hospital</option>
                  <option value="Left AMA">Left AMA (Against Medical Advice)</option>
                  <option value="Other">Other Facility</option>
                </select>
              </div>
            </div>

            {/* Glycemic Markers & Pharmacotherapy */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">HbA1c Lab Result</label>
                <select
                  name="A1Cresult"
                  value={formData.A1Cresult}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-slate-50"
                >
                  <option value="None">None (Not Tested)</option>
                  <option value="Norm">Normal (&lt;7%)</option>
                  <option value=">7">&gt;7% (Elevated)</option>
                  <option value=">8">&gt;8% (Poor Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Max Serum Glucose</label>
                <select
                  name="max_glu_serum"
                  value={formData.max_glu_serum}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-slate-50"
                >
                  <option value="None">None</option>
                  <option value="Norm">Normal</option>
                  <option value=">200">&gt;200 mg/dL</option>
                  <option value=">300">&gt;300 mg/dL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Medication Changed</label>
                <select
                  name="change"
                  value={formData.change}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-slate-50"
                >
                  <option value="No">No Dosage Change</option>
                  <option value="Ch">Ch (Dosage Changed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Insulin Regimen</label>
                <select
                  name="insulin"
                  value={formData.insulin}
                  onChange={handleChange}
                  className="w-full text-xs p-2 rounded border border-slate-300 bg-slate-50"
                >
                  <option value="No">No Insulin</option>
                  <option value="Steady">Steady Dose</option>
                  <option value="Up">Up (Titrated Up)</option>
                  <option value="Down">Down (Titrated Down)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing Calibrated SHAP Attribution...</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <span>Assess 30-Day Readmission Risk</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Prediction Results & SHAP Explainer (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!result && !loading && (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center min-h-[420px]">
              <Stethoscope className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Awaiting Clinical Encounter Data</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Fill in the encounter details or select a preset, then click assess to evaluate 30-day bounceback probability.
              </p>
            </div>
          )}

          {result && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 animate-in fade-in duration-300">
              {/* Risk Meter Card */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                result.risk_level === 'High'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : result.risk_level === 'Medium'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Calibrated Risk Level</div>
                  <div className="text-2xl font-black">{result.risk_level} Risk</div>
                  <div className="text-xs mt-0.5 opacity-90">
                    Threshold: {(result.operational_threshold * 100).toFixed(0)}% | Probability: {result.risk_percentage}%
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-black tracking-tight">{result.risk_percentage}%</div>
                  <div className="text-[10px] font-medium opacity-80">30-Day Readmit Chance</div>
                </div>
              </div>

              {/* SHAP Local Waterfall Attribution */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Top 5 Clinical SHAP Drivers</h4>
                  <span className="text-[10px] text-slate-400">TreeSHAP Log-Odds</span>
                </div>

                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={result.top_factors}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: '#334155' }} width={90} />
                      <Tooltip
                        formatter={(val, name, item) => [
                          `${val} (${item.payload.direction === 'increases_risk' ? 'Increases Risk' : 'Reduces Risk'})`,
                          'SHAP Impact'
                        ]}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', fontSize: '11px', border: '1px solid #cbd5e1' }}
                      />
                      <ReferenceLine x={0} stroke="#94a3b8" />
                      <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                        {result.top_factors.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.direction === 'increases_risk' ? '#ef4444' : '#10b981'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[10px] text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> Increases Readmission Likelihood</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Protective / Mitigating Factor</span>
                </div>
              </div>

              {/* Plain-Language Recommendations */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  <span>Clinical Action Plan & Interventions</span>
                </h4>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
