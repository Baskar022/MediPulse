"""
MediPulse Data Explorer & Storage Inspector Service
Provides paginated dataset previews, schema metadata, column distributions,
and directory structure inspection for Bronze, Silver, Gold, and raw files.
"""

import os
import sys
import glob
import math
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import pandas as pd
import numpy as np

logger = logging.getLogger("backend.explorer")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

DATASET_PATHS = {
    "raw": os.path.join(DATA_DIR, "diabetic_data.csv"),
    "bronze": os.path.join(DATA_DIR, "bronze", "encounters.parquet"),
    "silver": os.path.join(DATA_DIR, "silver", "encounters.parquet"),
    "gold": os.path.join(DATA_DIR, "gold", "encounters.parquet"),
}

LAYER_METADATA = {
    "raw": {
        "title": "Raw Ingestion Source",
        "description": "Original UCI Diabetes encounter records directly loaded from hospital archives.",
        "expected_rows": 101766,
        "format": "CSV"
    },
    "bronze": {
        "title": "Bronze Medallion Layer",
        "description": "Raw data converted into compressed columnar Parquet format using explicit StructType schema.",
        "expected_rows": 101766,
        "format": "Apache Parquet"
    },
    "silver": {
        "title": "Silver Medallion Layer",
        "description": "Cleaned, null-imputed, filtered (expired/hospice excluded), and deduplicated to 1st encounter per patient.",
        "expected_rows": 69990,
        "format": "Apache Parquet"
    },
    "gold": {
        "title": "Gold Medallion Layer",
        "description": "Clinically enriched feature store (ICD-9 grouping, prior visits, polypharmacy count, binary target).",
        "expected_rows": 69990,
        "format": "Apache Parquet"
    }
}


def get_layer_path(layer: str) -> str:
    path = DATASET_PATHS.get(layer.lower())
    if not path:
        raise ValueError(f"Unknown layer '{layer}'. Must be one of: {list(DATASET_PATHS.keys())}")
    return path


def load_dataset_slice(layer: str) -> pd.DataFrame:
    path = get_layer_path(layer)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset for layer '{layer}' does not exist at {path}.")

    if path.endswith(".csv"):
        # For raw CSV, read sample or full with low_memory
        df = pd.read_csv(path, low_memory=False)
    else:
        df = pd.read_parquet(path)
    return df


def get_dataset_stats(layer: str) -> Dict[str, Any]:
    path = get_layer_path(layer)
    if not os.path.exists(path):
        return {
            "layer": layer,
            "exists": False,
            "error": f"Path not found: {path}"
        }

    meta = LAYER_METADATA.get(layer, {})
    file_size_bytes = 0
    if os.path.isfile(path):
        file_size_bytes = os.path.getsize(path)
    elif os.path.isdir(path):
        file_size_bytes = sum(os.path.getsize(os.path.join(r, f)) for r, _, files in os.walk(path) for f in files)

    df = load_dataset_slice(layer)
    total_rows, total_cols = df.shape
    
    # Calculate null percentages
    null_counts = df.isnull().sum()
    null_ratios = {col: round(float(count / total_rows * 100), 2) for col, count in null_counts.items() if count > 0}

    # Schema definition
    columns_info = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        nunique = int(df[col].nunique(dropna=True))
        n_null = int(df[col].isnull().sum())
        sample_vals = [str(x) for x in df[col].dropna().head(3).tolist()]
        columns_info.append({
            "name": col,
            "type": dtype,
            "distinct_values": nunique,
            "null_count": n_null,
            "null_pct": round(float(n_null / total_rows * 100), 2) if total_rows > 0 else 0,
            "sample_values": sample_vals
        })

    # Duplicates check (patient_nbr if present)
    dup_patients = 0
    if "patient_nbr" in df.columns:
        dup_patients = int(total_rows - df["patient_nbr"].nunique())

    return {
        "layer": layer,
        "exists": True,
        "title": meta.get("title"),
        "description": meta.get("description"),
        "format": meta.get("format"),
        "path": os.path.relpath(path, BASE_DIR),
        "file_size_bytes": file_size_bytes,
        "file_size_mb": round(file_size_bytes / (1024 * 1024), 2),
        "total_records": total_rows,
        "total_columns": total_cols,
        "duplicate_patients": dup_patients,
        "columns_summary": columns_info,
        "high_missingness_columns": {k: v for k, v in null_ratios.items() if v >= 30.0}
    }


def preview_dataset(
    layer: str,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_desc: bool = False
) -> Dict[str, Any]:
    df = load_dataset_slice(layer)
    total_records = len(df)

    if search:
        search_lower = search.strip().lower()
        # Filter across all string/object columns
        mask = np.zeros(len(df), dtype=bool)
        for col in df.columns:
            mask = mask | df[col].astype(str).str.lower().str.contains(search_lower, na=False)
        df = df[mask]

    filtered_records = len(df)

    if sort_by and sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=not sort_desc)

    # Paginate
    total_pages = max(1, math.ceil(filtered_records / page_size))
    page = max(1, min(page, total_pages))
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    page_df = df.iloc[start_idx:end_idx].copy()
    
    # Replace NaN with None for JSON serializability
    page_df = page_df.replace({np.nan: None})
    records = page_df.to_dict(orient="records")

    return {
        "layer": layer,
        "page": page,
        "page_size": page_size,
        "total_records": total_records,
        "filtered_records": filtered_records,
        "total_pages": total_pages,
        "columns": list(df.columns),
        "data": records
    }


def explore_storage_lakehouse() -> Dict[str, Any]:
    """Inspects storage directories: data/ (parquet partitions) and artifacts/."""
    items = []

    def scan_dir(dir_path: str, category: str):
        if not os.path.exists(dir_path):
            return
        for entry in os.scandir(dir_path):
            if entry.name.startswith((".", "__")):
                continue
            
            is_dir = entry.is_dir()
            size = 0
            file_count = 1
            if is_dir:
                for root, _, files in os.walk(entry.path):
                    for f in files:
                        p = os.path.join(root, f)
                        size += os.path.getsize(p)
                        file_count += 1
            else:
                size = entry.stat().st_size

            mod_time = datetime.fromtimestamp(entry.stat().st_mtime).isoformat()
            items.append({
                "name": entry.name,
                "relative_path": os.path.relpath(entry.path, BASE_DIR),
                "category": category,
                "is_directory": is_dir,
                "size_bytes": size,
                "size_formatted": f"{size / (1024 * 1024):.2f} MB" if size >= 1024*1024 else f"{size / 1024:.1f} KB",
                "modified_at": mod_time,
                "file_count": file_count if is_dir else 1
            })

    scan_dir(DATA_DIR, "Data Lake (Lakehouse)")
    scan_dir(ARTIFACTS_DIR, "Artifacts & Models")

    return {
        "root_directory": os.path.basename(BASE_DIR),
        "total_items": len(items),
        "items": sorted(items, key=lambda x: (x["category"], x["name"]))
    }
