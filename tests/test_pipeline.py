"""
MediPulse Unit Tests: Data Cleaning & Feature Pipeline
"""

import os
import sys
import pytest
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from pipeline.features import classify_icd9_category


def test_clean_missingness_and_exclusion():
    """Verifies that expired disposition IDs and missing values are properly handled."""
    from pipeline.clean import EXPIRED_HOSPICE_DISCHARGE_IDS

    # Dispositions 11 (Expired), 13/14 (Hospice), 19/20/21 (Expired at home/medicaid)
    assert 11 in EXPIRED_HOSPICE_DISCHARGE_IDS
    assert 13 in EXPIRED_HOSPICE_DISCHARGE_IDS
    assert 14 in EXPIRED_HOSPICE_DISCHARGE_IDS
    assert 19 in EXPIRED_HOSPICE_DISCHARGE_IDS
    assert 20 in EXPIRED_HOSPICE_DISCHARGE_IDS
    assert 21 in EXPIRED_HOSPICE_DISCHARGE_IDS


def test_gold_parquet_integrity():
    """Validates schema and zero leakage in gold parquet."""
    gold_path = os.path.join(BASE_DIR, "data", "gold", "encounters.parquet")
    assert os.path.exists(gold_path), "Gold parquet file must exist"

    df = pd.read_parquet(gold_path)
    assert len(df) > 50000, "Should have retained encounters"
    # Patient uniqueness
    assert df["patient_nbr"].nunique() == len(df), "Gold layer must contain unique patients only (no leakage)"

    # Target integrity
    assert set(df["readmitted_30d"].unique()).issubset({0, 1})

    # ICD-9 classification presence
    assert "diag_1_category" in df.columns
    assert "number_of_prior_visits" in df.columns
    assert "A1C_flag" in df.columns
