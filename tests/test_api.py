"""
MediPulse Unit Tests: Backend FastAPI Endpoints & /api/predict
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from backend.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["models_loaded"] is True


def test_predict_endpoint_success():
    payload = {
        "age": "[70-80)",
        "gender": "Female",
        "race": "Caucasian",
        "time_in_hospital": 6,
        "num_lab_procedures": 54,
        "num_procedures": 2,
        "num_medications": 18,
        "number_outpatient": 0,
        "number_emergency": 1,
        "number_inpatient": 2,
        "number_diagnoses": 9,
        "diag_1_category": "Circulatory",
        "admission_type_desc": "Emergency",
        "discharge_disposition_desc": "Discharged to home",
        "A1Cresult": ">8",
        "max_glu_serum": "None",
        "change": "Ch",
        "diabetesMed": "Yes",
        "insulin": "Up"
    }

    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    res = response.json()

    assert "risk_probability" in res
    assert 0.0 <= res["risk_probability"] <= 1.0
    assert res["risk_level"] in ["Low", "Medium", "High"]
    assert len(res["top_factors"]) == 5
    assert len(res["recommendations"]) >= 1

    # Check top factor structure
    factor = res["top_factors"][0]
    assert "feature" in factor
    assert "impact" in factor
    assert "direction" in factor
    assert factor["direction"] in ["increases_risk", "reduces_risk"]


def test_analytics_endpoints():
    response = client.get("/api/analytics")
    assert response.status_code == 200
    data = response.json()
    assert "kpis" in data
    assert "by_age" in data
    assert "by_diagnosis" in data

    # Test single metric endpoint
    res_kpis = client.get("/api/analytics/kpis")
    assert res_kpis.status_code == 200
    assert "total_encounters" in res_kpis.json()


def test_model_metrics_endpoint():
    response = client.get("/api/model/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "curves" in data
    assert "fairness" in data
    assert "shap_importance" in data


def test_benchmark_endpoint():
    response = client.get("/api/benchmark")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    # Check 1M row benchmark row exists
    scales = [r["rows_label"] for r in data]
    assert "1M" in scales
