"""
MediPulse FastAPI Application Server
Provides secure REST endpoints for patient risk prediction, clinical explainability (SHAP),
Spark SQL population analytics, ML evaluation transparency, and big data benchmarks.
"""

import os
import sys
import json
import logging
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Add project root to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from backend.schemas import PatientInput, PredictionResponse, HealthResponse
from ml.explain import explain_single_patient, load_artifacts
from backend.jobs import (
    get_all_stages, trigger_stage_execution, get_job_status, get_job_history
)
from backend.explorer import (
    get_dataset_stats, preview_dataset, explore_storage_lakehouse
)
from backend.sql_engine import (
    get_available_queries, execute_sql_query
)
from backend.monitor import get_system_telemetry

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backend.main")

ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MediPulse API and pre-warming ML models...")
    try:
        load_artifacts()
        logger.info("Machine learning model and SHAP explainer warmed up successfully.")
    except Exception as e:
        logger.warning(f"ML models could not be loaded on startup (run pipeline/ml first): {e}")
    yield

app = FastAPI(
    title="MediPulse: Hospital Readmission Risk & Population Health API",
    description="Production-grade AI & Big Data Healthcare Analytics decision-support backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware allowing local React Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount artifacts folder to serve generated plots (ROC, PR curve, confusion matrix, SHAP, benchmark)
if os.path.exists(ARTIFACTS_DIR):
    app.mount("/artifacts", StaticFiles(directory=ARTIFACTS_DIR), name="artifacts")


@app.get("/api/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint checking server and model status."""
    model_exists = os.path.exists(os.path.join(ARTIFACTS_DIR, "model.joblib"))
    return {
        "status": "healthy",
        "version": "1.0.0",
        "models_loaded": model_exists
    }


@app.post("/api/predict", response_model=PredictionResponse)
def predict_readmission_risk(patient: PatientInput):
    """
    Accepts patient encounter parameters, computes calibrated 30-day readmission risk,
    identifies individual SHAP contributing factors, and returns targeted clinical interventions.
    """
    p_dict = patient.model_dump()

    # Derived clinical feature calculations matching feature engineering pipeline
    # 1. age_midpoint
    age_map = {
        "[0-10)": 5, "[10-20)": 15, "[20-30)": 25, "[30-40)": 35, "[40-50)": 45,
        "[50-60)": 55, "[60-70)": 65, "[70-80)": 75, "[80-90)": 85, "[90-100)": 95
    }
    p_dict["age_midpoint"] = age_map.get(p_dict["age"], 65)

    # 2. prior visits
    p_dict["number_of_prior_visits"] = (
        p_dict["number_outpatient"] + p_dict["number_emergency"] + p_dict["number_inpatient"]
    )

    # 3. med change flag
    p_dict["med_change_flag"] = 1 if p_dict["change"] == "Ch" else 0

    # 4. total meds changed & polypharmacy estimate
    p_dict["total_meds_changed"] = 1 if p_dict.get("insulin") in ["Up", "Down"] else 0
    p_dict["polypharmacy_count"] = max(1, min(p_dict["num_medications"] // 3, 10))

    # 5. A1C and Glucose flags
    a1c_map = {">8": 3, ">7": 2, "Norm": 1, "None": 0}
    p_dict["A1C_flag"] = a1c_map.get(p_dict["A1Cresult"], 0)

    glu_map = {">300": 3, ">200": 2, "Norm": 1, "None": 0}
    p_dict["glucose_flag"] = glu_map.get(p_dict["max_glu_serum"], 0)

    try:
        explanation = explain_single_patient(p_dict)
        return explanation
    except Exception as e:
        logger.error(f"Prediction inference failure: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}. Ensure ML training pipeline has executed."
        )


@app.get("/api/analytics/{metric}")
def get_analytics_metric(metric: str):
    """Serves individual precomputed Spark SQL aggregation breakdowns."""
    summary_path = os.path.join(ARTIFACTS_DIR, "analytics_summary.json")
    segments_path = os.path.join(ARTIFACTS_DIR, "high_risk_segments.json")

    if metric == "high_risk_segments":
        if not os.path.exists(segments_path):
            raise HTTPException(status_code=404, detail="High risk segments not found. Run pipeline/analytics.py first.")
        with open(segments_path, "r", encoding="utf-8") as f:
            return json.load(f)

    if not os.path.exists(summary_path):
        raise HTTPException(status_code=404, detail="Analytics summary not found. Run pipeline/analytics.py first.")

    with open(summary_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if metric in data:
        return data[metric]
    else:
        valid_keys = list(data.keys()) + ["high_risk_segments"]
        raise HTTPException(status_code=404, detail=f"Metric '{metric}' not found. Available metrics: {valid_keys}")


@app.get("/api/analytics")
def get_all_analytics():
    """Serves complete population analytics summary including KPIs and demographic breakdowns."""
    summary_path = os.path.join(ARTIFACTS_DIR, "analytics_summary.json")
    segments_path = os.path.join(ARTIFACTS_DIR, "high_risk_segments.json")

    if not os.path.exists(summary_path):
        raise HTTPException(status_code=404, detail="Analytics data not found. Run pipeline/analytics.py first.")

    with open(summary_path, "r", encoding="utf-8") as f:
        summary = json.load(f)

    if os.path.exists(segments_path):
        with open(segments_path, "r", encoding="utf-8") as f:
            summary["high_risk_segments"] = json.load(f)

    return summary


@app.get("/api/model/metrics")
def get_model_metrics():
    """Serves comprehensive evaluation metrics, ROC/PR curves data, fairness audits, and MLlib results."""
    res = {}
    metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
    curves_path = os.path.join(ARTIFACTS_DIR, "curves_data.json")
    fairness_path = os.path.join(ARTIFACTS_DIR, "fairness.json")
    shap_path = os.path.join(ARTIFACTS_DIR, "shap_importance.json")
    mllib_path = os.path.join(ARTIFACTS_DIR, "mllib_metrics.json")

    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            res["metrics"] = json.load(f)
    if os.path.exists(curves_path):
        with open(curves_path, "r", encoding="utf-8") as f:
            res["curves"] = json.load(f)
    if os.path.exists(fairness_path):
        with open(fairness_path, "r", encoding="utf-8") as f:
            res["fairness"] = json.load(f)
    if os.path.exists(shap_path):
        with open(shap_path, "r", encoding="utf-8") as f:
            res["shap_importance"] = json.load(f)
    if os.path.exists(mllib_path):
        with open(mllib_path, "r", encoding="utf-8") as f:
            res["mllib"] = json.load(f)

    if not res:
        raise HTTPException(status_code=404, detail="Model evaluation artifacts not found. Run ml/train.py and ml/evaluate.py first.")

    return res


@app.get("/api/benchmark")
def get_benchmark_results():
    """Serves Pandas vs PySpark scalability runtime comparison data."""
    bench_path = os.path.join(ARTIFACTS_DIR, "benchmark_summary.json")
    if not os.path.exists(bench_path):
        raise HTTPException(status_code=404, detail="Benchmark results not found. Run pipeline/benchmark.py first.")

    with open(bench_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ==============================================================================
# PHASE 2 & 7: DATA EXPLORER & STORAGE ENDPOINTS
# ==============================================================================

@app.get("/api/data/layers")
def get_available_layers():
    """Returns metadata and statistics for all Medallion layers (Raw, Bronze, Silver, Gold)."""
    layers = ["raw", "bronze", "silver", "gold"]
    return {l: get_dataset_stats(l) for l in layers}


@app.get("/api/data/stats/{layer}")
def get_layer_statistics(layer: str):
    """Returns deep schema summary, null percentages, and distributions for a layer."""
    try:
        return get_dataset_stats(layer)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/data/preview/{layer}")
def preview_layer_data(
    layer: str,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_desc: bool = False
):
    """Server-side paginated preview of actual Parquet/CSV data."""
    try:
        return preview_dataset(
            layer=layer,
            page=page,
            page_size=min(page_size, 100),
            search=search,
            sort_by=sort_by,
            sort_desc=sort_desc
        )
    except Exception as e:
        logger.error(f"Error previewing layer {layer}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/storage/explorer")
def get_storage_explorer():
    """Scans authorized data/ and artifacts/ directories for file metadata and sizes."""
    try:
        return explore_storage_lakehouse()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# PHASE 3: INTERACTIVE BDA PIPELINE RUNNER ENDPOINTS
# ==============================================================================

@app.get("/api/pipeline/stages")
def get_pipeline_stages():
    """Returns all pipeline stages, their dependencies, and output status."""
    return get_all_stages()


@app.post("/api/pipeline/run/{stage_id}")
def run_pipeline_stage(stage_id: str):
    """Triggers background execution of a pipeline stage."""
    try:
        job = trigger_stage_execution(stage_id)
        return job
    except RuntimeError as re:
        raise HTTPException(status_code=409, detail=str(re))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pipeline/jobs/{job_id}")
def get_pipeline_job_status(job_id: str):
    """Polls real-time job execution status, duration, and logs."""
    job = get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job ID '{job_id}' not found.")
    return job


@app.get("/api/pipeline/history")
def get_pipeline_execution_history():
    """Returns execution history of recent pipeline stages."""
    return get_job_history()


# ==============================================================================
# PHASE 4: SPARK SQL ANALYTICS WORKSPACE ENDPOINTS
# ==============================================================================

@app.get("/api/sql/queries")
def get_sql_query_templates():
    """Returns available predefined Spark SQL queries with clinical descriptions."""
    return get_available_queries()


@app.post("/api/sql/execute/{query_id}")
def execute_spark_sql(query_id: str):
    """Executes a predefined Spark SQL query on Gold layer data and returns tabular and chart data."""
    try:
        return execute_sql_query(query_id)
    except FileNotFoundError as fe:
        raise HTTPException(status_code=404, detail=str(fe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"SQL execution failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# PHASE 8: SYSTEM MONITOR & DIAGNOSTICS ENDPOINT
# ==============================================================================

@app.get("/api/system/monitor")
def get_system_monitor():
    """Returns real host telemetry: Python, PySpark, JVM, OS, and memory metrics."""
    return get_system_telemetry()


# Mount built React frontend distribution (if present) for unified single-service deployment
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
