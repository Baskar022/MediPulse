"""
MediPulse Extended Unit Tests for Data Explorer, Pipeline Jobs, Spark SQL, & Storage
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from backend.main import app

client = TestClient(app)


def test_data_layers_metadata():
    res = client.get("/api/data/layers")
    assert res.status_code == 200
    data = res.json()
    assert "raw" in data and "gold" in data
    assert data["gold"]["exists"] is True
    assert data["gold"]["total_records"] == 69990


def test_data_preview_pagination():
    res = client.get("/api/data/preview/gold?page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert len(data["data"]) == 10
    assert data["page"] == 1
    assert data["total_records"] == 69990
    assert "readmitted_30d" in data["columns"]


def test_data_preview_search():
    res = client.get("/api/data/preview/gold?page=1&page_size=5&search=Circulatory")
    assert res.status_code == 200
    data = res.json()
    assert len(data["data"]) <= 5
    assert data["filtered_records"] > 0


def test_pipeline_stages_list():
    res = client.get("/api/pipeline/stages")
    assert res.status_code == 200
    stages = res.json()
    assert "ingest" in stages
    assert "clean" in stages
    assert "features" in stages
    assert "analytics" in stages
    assert "mllib" in stages
    assert "benchmark" in stages


def test_sql_query_execution():
    # Test query templates list
    res_list = client.get("/api/sql/queries")
    assert res_list.status_code == 200
    templates = res_list.json()
    assert len(templates) >= 6

    # Test query execution
    res_exec = client.post("/api/sql/execute/readmit_by_diagnosis")
    assert res_exec.status_code == 200
    result = res_exec.json()
    assert result["query_id"] == "readmit_by_diagnosis"
    assert "data" in result
    assert len(result["data"]) > 0
    assert result["duration_seconds"] > 0


def test_storage_explorer():
    res = client.get("/api/storage/explorer")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total_items"] > 0
    # Must contain Parquet layers
    names = [i["name"] for i in data["items"]]
    assert any("gold" in n or "encounters.parquet" in n or "analytics_summary" in n for n in names)


def test_system_monitor():
    res = client.get("/api/system/monitor")
    assert res.status_code == 200
    mon = res.json()
    assert "platform" in mon
    assert "spark" in mon
    assert "storage" in mon
    assert mon["spark"]["execution_mode"] == "local[*]"
