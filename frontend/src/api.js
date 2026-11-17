/**
 * MediPulse API Service Client (v2.0)
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

// 1. Core Health & System Telemetry
export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchSystemMonitor() {
  const res = await fetch(`${API_BASE}/api/system/monitor`);
  if (!res.ok) throw new Error('Failed to retrieve system diagnostics');
  return res.json();
}

// 2. Data Lakehouse & Explorer
export async function fetchAvailableLayers() {
  const res = await fetch(`${API_BASE}/api/data/layers`);
  if (!res.ok) throw new Error('Failed to fetch Medallion layers');
  return res.json();
}

export async function fetchLayerStats(layer) {
  const res = await fetch(`${API_BASE}/api/data/stats/${layer}`);
  if (!res.ok) throw new Error(`Failed to fetch stats for layer ${layer}`);
  return res.json();
}

export async function previewLayerData(layer, { page = 1, pageSize = 25, search = '', sortBy = '', sortDesc = false } = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_desc: sortDesc.toString(),
  });
  if (search) params.append('search', search);
  if (sortBy) params.append('sort_by', sortBy);

  const res = await fetch(`${API_BASE}/api/data/preview/${layer}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to preview layer ${layer}`);
  return res.json();
}

export async function fetchStorageExplorer() {
  const res = await fetch(`${API_BASE}/api/storage/explorer`);
  if (!res.ok) throw new Error('Failed to scan data lake storage');
  return res.json();
}

// 3. Data Processing Pipelines
export async function fetchPipelineStages() {
  const res = await fetch(`${API_BASE}/api/pipeline/stages`);
  if (!res.ok) throw new Error('Failed to fetch pipeline stages');
  return res.json();
}

export async function triggerPipelineStage(stageId) {
  const res = await fetch(`${API_BASE}/api/pipeline/run/${stageId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to trigger stage ${stageId}`);
  }
  return res.json();
}

export async function fetchPipelineJobStatus(jobId) {
  const res = await fetch(`${API_BASE}/api/pipeline/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Failed to fetch job ${jobId}`);
  return res.json();
}

export async function fetchPipelineHistory() {
  const res = await fetch(`${API_BASE}/api/pipeline/history`);
  if (!res.ok) throw new Error('Failed to fetch pipeline history');
  return res.json();
}

// 4. Spark SQL Workspace
export async function fetchSqlQueries() {
  const res = await fetch(`${API_BASE}/api/sql/queries`);
  if (!res.ok) throw new Error('Failed to fetch SQL query templates');
  return res.json();
}

export async function executeSqlQuery(queryId) {
  const res = await fetch(`${API_BASE}/api/sql/execute/${queryId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to execute query ${queryId}`);
  }
  return res.json();
}

// 5. Existing Analytics, Benchmarks, Models, & Predictor
export async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/api/analytics`);
  if (!res.ok) throw new Error('Failed to fetch analytics summary');
  return res.json();
}

export async function fetchModelMetrics() {
  const res = await fetch(`${API_BASE}/api/model/metrics`);
  if (!res.ok) throw new Error('Failed to fetch model metrics');
  return res.json();
}

export async function fetchBenchmark() {
  const res = await fetch(`${API_BASE}/api/benchmark`);
  if (!res.ok) throw new Error('Failed to fetch benchmark data');
  return res.json();
}

export async function predictRisk(patientData) {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patientData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Prediction request failed');
  }
  return res.json();
}
