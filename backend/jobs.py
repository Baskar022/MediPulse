"""
MediPulse Async Job Manager & Pipeline Runner
Executes pipeline scripts asynchronously in background worker threads,
capturing logs, exit codes, execution duration, and input/output counts.
"""

import os
import sys
import time
import uuid
import logging
import subprocess
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger("backend.jobs")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_EXE = sys.executable

# Supported Pipeline Stages and their corresponding scripts & dependencies
STAGE_DEFINITIONS = {
    "ingest": {
        "name": "Data Ingestion (Bronze Layer)",
        "script": "pipeline/ingest.py",
        "description": "Ingests raw CSV with explicit StructType schema into raw Bronze Parquet format.",
        "dependencies": [],
        "output_path": "data/bronze/encounters.parquet",
    },
    "clean": {
        "name": "Data Cleaning & De-leakage (Silver Layer)",
        "script": "pipeline/clean.py",
        "description": "Drops >40% missing columns, filters expired/hospice cases, and deduplicates to first encounter per patient.",
        "dependencies": ["ingest"],
        "output_path": "data/silver/encounters.parquet",
    },
    "features": {
        "name": "Feature Engineering (Gold Layer)",
        "script": "pipeline/features.py",
        "description": "Performs clinical ICD-9 category grouping, utilization counts, medication titration flags, and binary target creation.",
        "dependencies": ["clean"],
        "output_path": "data/gold/encounters.parquet",
    },
    "analytics": {
        "name": "Spark SQL Aggregations",
        "script": "pipeline/analytics.py",
        "description": "Runs Spark SQL group-by queries across age, diagnosis, stay duration, and extracts top 10 multi-variable risk segments.",
        "dependencies": ["features"],
        "output_path": "artifacts/analytics_summary.json",
    },
    "mllib": {
        "name": "Spark MLlib Distributed Model",
        "script": "pipeline/mllib_model.py",
        "description": "Trains a distributed Random Forest Classifier (80 trees, depth 8) on Spark DataFrames.",
        "dependencies": ["features"],
        "output_path": "artifacts/mllib_metrics.json",
    },
    "benchmark": {
        "name": "Scalability Benchmark (100k-1M Rows)",
        "script": "pipeline/benchmark.py",
        "description": "Executes identical cleaning & aggregation workloads on Pandas vs. PySpark across 100k, 500k, and 1,000,000 encounters.",
        "dependencies": ["features"],
        "output_path": "artifacts/benchmark_summary.json",
    },
    "ml_train": {
        "name": "XGBoost Training & Calibration",
        "script": "ml/train.py",
        "description": "Executes patient-level split (70/15/15), class weighting, model comparison, Platt calibration, and fairness check.",
        "dependencies": ["features"],
        "output_path": "artifacts/model.joblib",
    },
    "ml_evaluate": {
        "name": "ML Metrics & Evaluation Curves",
        "script": "ml/evaluate.py",
        "description": "Generates ROC/PR curves data, confusion matrix heatmaps, and calibration reliability metrics.",
        "dependencies": ["ml_train"],
        "output_path": "artifacts/curves_data.json",
    },
    "ml_explain": {
        "name": "TreeSHAP Attribution Engine",
        "script": "ml/explain.py",
        "description": "Computes global TreeSHAP feature rankings and prepares patient-level local attribution.",
        "dependencies": ["ml_train"],
        "output_path": "artifacts/shap_importance.json",
    }
}

# In-memory Job State Store
JOB_HISTORY: List[Dict[str, Any]] = []
ACTIVE_JOBS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.Lock()


def get_stage_info(stage: str) -> Optional[Dict[str, Any]]:
    return STAGE_DEFINITIONS.get(stage)


def get_all_stages() -> Dict[str, Any]:
    stages = {}
    for stage_id, meta in STAGE_DEFINITIONS.items():
        out_exists = os.path.exists(os.path.join(BASE_DIR, meta["output_path"]))
        out_time = None
        out_size = None
        if out_exists:
            full_p = os.path.join(BASE_DIR, meta["output_path"])
            out_time = datetime.fromtimestamp(os.path.getmtime(full_p)).isoformat()
            if os.path.isfile(full_p):
                out_size = os.path.getsize(full_p)
            elif os.path.isdir(full_p):
                out_size = sum(os.path.getsize(os.path.join(root, f)) for root, _, files in os.walk(full_p) for f in files)

        stages[stage_id] = {
            **meta,
            "stage_id": stage_id,
            "has_output": out_exists,
            "last_modified": out_time,
            "output_size_bytes": out_size,
        }
    return stages


def run_stage_background(job_id: str, stage_id: str):
    stage_meta = STAGE_DEFINITIONS[stage_id]
    script_path = os.path.join(BASE_DIR, stage_meta["script"])
    
    with _LOCK:
        job_record = ACTIVE_JOBS[job_id]
        job_record["status"] = "running"
        job_record["started_at"] = datetime.now().isoformat()

    start_time = time.perf_counter()
    logs: List[str] = []

    try:
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        # Ensure hadoop path if present
        hadoop_bin = os.path.join(BASE_DIR, "hadoop", "bin")
        if os.path.exists(hadoop_bin):
            env["HADOOP_HOME"] = os.path.join(BASE_DIR, "hadoop")
            env["PATH"] = hadoop_bin + os.pathsep + env.get("PATH", "")

        process = subprocess.Popen(
            [PYTHON_EXE, script_path],
            cwd=BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )

        for line in iter(process.stdout.readline, ""):
            clean_line = line.rstrip()
            if clean_line:
                logs.append(clean_line)
                with _LOCK:
                    job_record["logs"] = logs[-200:] # Keep last 200 lines

        process.wait()
        exit_code = process.returncode
        duration = round(time.perf_counter() - start_time, 2)

        with _LOCK:
            job_record["duration_seconds"] = duration
            job_record["completed_at"] = datetime.now().isoformat()
            job_record["exit_code"] = exit_code

            if exit_code == 0:
                job_record["status"] = "success"
                job_record["message"] = f"Stage '{stage_meta['name']}' completed successfully in {duration}s."
            else:
                job_record["status"] = "failed"
                job_record["error"] = f"Process exited with non-zero exit code {exit_code}."
                job_record["message"] = f"Stage '{stage_meta['name']}' failed after {duration}s."

            JOB_HISTORY.insert(0, dict(job_record))
            if job_id in ACTIVE_JOBS:
                del ACTIVE_JOBS[job_id]

    except Exception as e:
        duration = round(time.perf_counter() - start_time, 2)
        logger.error(f"Job execution exception: {e}", exc_info=True)
        with _LOCK:
            job_record["status"] = "failed"
            job_record["duration_seconds"] = duration
            job_record["completed_at"] = datetime.now().isoformat()
            job_record["error"] = str(e)
            job_record["message"] = f"Execution failed: {str(e)}"
            JOB_HISTORY.insert(0, dict(job_record))
            if job_id in ACTIVE_JOBS:
                del ACTIVE_JOBS[job_id]


def trigger_stage_execution(stage_id: str) -> Dict[str, Any]:
    if stage_id not in STAGE_DEFINITIONS:
        raise ValueError(f"Unknown stage '{stage_id}'. Valid stages: {list(STAGE_DEFINITIONS.keys())}")

    # Check if a job is already running
    with _LOCK:
        for j_id, j_data in ACTIVE_JOBS.items():
            if j_data.get("status") == "running":
                raise RuntimeError(f"Another job '{j_data.get('stage_name')}' (ID: {j_id}) is currently running. Please wait for it to complete.")

        job_id = str(uuid.uuid4())[:8]
        meta = STAGE_DEFINITIONS[stage_id]
        job_data = {
            "job_id": job_id,
            "stage_id": stage_id,
            "stage_name": meta["name"],
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "duration_seconds": None,
            "exit_code": None,
            "logs": [],
            "error": None,
            "message": f"Job queued for {meta['name']}."
        }
        ACTIVE_JOBS[job_id] = job_data

    thread = threading.Thread(target=run_stage_background, args=(job_id, stage_id), daemon=True)
    thread.start()

    return job_data


def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        if job_id in ACTIVE_JOBS:
            return ACTIVE_JOBS[job_id]
        for past_job in JOB_HISTORY:
            if past_job["job_id"] == job_id:
                return past_job
    return None


def get_job_history(limit: int = 20) -> List[Dict[str, Any]]:
    with _LOCK:
        active_list = list(ACTIVE_JOBS.values())
        return (active_list + JOB_HISTORY)[:limit]
