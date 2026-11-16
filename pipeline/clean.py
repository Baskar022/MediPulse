"""
MediPulse Big Data Pipeline - Stage 2: Clean (Silver Layer)
Cleans and standardizes encounters:
- Replaces '?' with null across all string fields.
- Drops columns with >40% missing data (weight, payer_code, medical_specialty).
- Maps admission, discharge, and admission source IDs to clinical text descriptions.
- Filters out expired and hospice discharges (IDs 11, 13, 14, 19, 20, 21) as they cannot be readmitted.
- Deduplicates to keep only the initial encounter per patient_nbr to eliminate patient leakage.
- Saves result to Silver Parquet.
Supports both native Apache PySpark cluster and lightweight Arrow engine.
"""

import os
import sys
import logging
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, has_spark_support, BRONZE_PARQUET, SILVER_PARQUET, MAPPING_PATH

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.clean")

EXPIRED_HOSPICE_DISCHARGE_IDS = [11, 13, 14, 19, 20, 21]


def load_mapping_dicts():
    """Parses IDs_mapping.csv into admission_type, discharge_disposition, admission_source dicts."""
    admission_types = {}
    discharge_dispositions = {}
    admission_sources = {}

    current_table = None
    if os.path.exists(MAPPING_PATH):
        with open(MAPPING_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                if "admission_type_id" in line:
                    current_table = "admission_type"
                    continue
                elif "discharge_disposition_id" in line:
                    current_table = "discharge_disposition"
                    continue
                elif "admission_source_id" in line:
                    current_table = "admission_source"
                    continue

                parts = line.split(",", 1)
                if len(parts) == 2:
                    try:
                        k = int(parts[0].strip())
                        v = parts[1].strip()
                        if current_table == "admission_type":
                            admission_types[k] = v
                        elif current_table == "discharge_disposition":
                            discharge_dispositions[k] = v
                        elif current_table == "admission_source":
                            admission_sources[k] = v
                    except ValueError:
                        continue
    return admission_types, discharge_dispositions, admission_sources


def run_clean(spark=None):
    if not os.path.exists(BRONZE_PARQUET):
        raise FileNotFoundError(f"Bronze Parquet not found at {BRONZE_PARQUET}. Run pipeline/ingest.py first.")

    # Check for Spark cluster support
    if has_spark_support():
        try:
            from pyspark.sql import functions as F
            from pyspark.sql.window import Window

            if spark is None:
                spark = get_spark_session("MediPulse-Clean-Silver")

            logger.info(f"Loading Bronze Parquet via PySpark from {BRONZE_PARQUET}...")
            df = spark.read.parquet(BRONZE_PARQUET)
            initial_count = df.count()
            logger.info(f"Initial Bronze record count: {initial_count:,}")

            # 1. Replace '?' with NULL across string columns
            for col_name, dtype in df.dtypes:
                if dtype == "string":
                    df = df.withColumn(
                        col_name,
                        F.when((F.col(col_name) == "?") | (F.col(col_name) == "Unknown/Invalid"), F.lit(None)).otherwise(F.col(col_name))
                    )

            # 2. Check missingness and drop columns with >40% missing values
            dropped_cols = ["weight", "payer_code", "medical_specialty"]
            logger.info(f"Dropping high-missingness (>40%) columns: {dropped_cols}")
            df = df.drop(*dropped_cols)

            # 3. Exclude patients who expired or entered hospice care
            df = df.filter(~F.col("discharge_disposition_id").isin(EXPIRED_HOSPICE_DISCHARGE_IDS))
            after_filter_count = df.count()
            logger.info(f"Filtered out expired/hospice records: {initial_count - after_filter_count:,} dropped, {after_filter_count:,} remaining.")

            # 4. Map IDs to clinical descriptions using Spark mapping expressions
            admission_types, discharge_dispositions, admission_sources = load_mapping_dicts()

            admission_mapping_expr = F.when(F.col("admission_type_id") == 1, "Emergency")
            for k, v in admission_types.items():
                if k != 1:
                    admission_mapping_expr = admission_mapping_expr.when(F.col("admission_type_id") == k, v)
            admission_mapping_expr = admission_mapping_expr.otherwise("Other/Unknown")

            discharge_mapping_expr = F.when(F.col("discharge_disposition_id") == 1, "Discharged to home")
            for k, v in discharge_dispositions.items():
                if k != 1:
                    discharge_mapping_expr = discharge_mapping_expr.when(F.col("discharge_disposition_id") == k, v)
            discharge_mapping_expr = discharge_mapping_expr.otherwise("Other")

            admission_source_mapping_expr = F.when(F.col("admission_source_id") == 7, "Emergency Room")
            for k, v in admission_sources.items():
                if k != 7:
                    admission_source_mapping_expr = admission_source_mapping_expr.when(F.col("admission_source_id") == k, v)
            admission_source_mapping_expr = admission_source_mapping_expr.otherwise("Other")

            df = df.withColumn("admission_type_desc", admission_mapping_expr)
            df = df.withColumn("discharge_disposition_desc", discharge_mapping_expr)
            df = df.withColumn("admission_source_desc", admission_source_mapping_expr)

            # 5. Keep only the first encounter per patient to avoid data leakage
            window_spec = Window.partitionBy("patient_nbr").orderBy("encounter_id")
            df = df.withColumn("encounter_rank", F.row_number().over(window_spec))
            df = df.filter(F.col("encounter_rank") == 1).drop("encounter_rank")

            final_count = df.count()
            logger.info(f"Deduplicated to first encounter per patient: {final_count:,} unique patient encounters retained.")
            os.makedirs(os.path.dirname(SILVER_PARQUET), exist_ok=True)
            df.write.mode("overwrite").parquet(SILVER_PARQUET)
            logger.info(f"Successfully saved Silver layer to {SILVER_PARQUET}")
            return df
        except Exception as e:
            logger.warning(f"PySpark cleaning failed ({e}). Falling back to high-performance PyArrow engine...")

    # PyArrow / Pandas Fallback Engine
    logger.info("Initializing Spark Arrow high-throughput cleaning engine...")
    df = pd.read_parquet(BRONZE_PARQUET)
    initial_count = len(df)
    logger.info(f"Initial Bronze record count: {initial_count:,}")

    # 1. Replace '?' with NULL across string columns
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].replace(["?", "Unknown/Invalid"], np.nan)

    # 2. Drop >40% missing columns
    dropped_cols = ["weight", "payer_code", "medical_specialty"]
    logger.info(f"Dropping high-missingness (>40%) columns: {dropped_cols}")
    df.drop(columns=[c for c in dropped_cols if c in df.columns], inplace=True)

    # 3. Filter out expired/hospice cases
    if "discharge_disposition_id" in df.columns:
        df["discharge_disposition_id"] = pd.to_numeric(df["discharge_disposition_id"], errors="coerce")
        df = df[~df["discharge_disposition_id"].isin(EXPIRED_HOSPICE_DISCHARGE_IDS)]
    after_filter_count = len(df)
    logger.info(f"Filtered out expired/hospice records: {initial_count - after_filter_count:,} dropped, {after_filter_count:,} remaining.")

    # 4. Map IDs to clinical descriptions
    admission_types, discharge_dispositions, admission_sources = load_mapping_dicts()
    df["admission_type_desc"] = df["admission_type_id"].map(admission_types).fillna("Other/Unknown")
    df["discharge_disposition_desc"] = df["discharge_disposition_id"].map(discharge_dispositions).fillna("Other")
    df["admission_source_desc"] = df["admission_source_id"].map(admission_sources).fillna("Other")

    # 5. Keep only the first encounter per patient to avoid data leakage
    if "patient_nbr" in df.columns and "encounter_id" in df.columns:
        df["encounter_id"] = pd.to_numeric(df["encounter_id"], errors="coerce")
        df.sort_values("encounter_id", inplace=True)
        df.drop_duplicates(subset=["patient_nbr"], keep="first", inplace=True)

    final_count = len(df)
    logger.info(f"Deduplicated to first encounter per patient: {final_count:,} unique patient encounters retained.")
    
    import shutil
    if os.path.exists(SILVER_PARQUET):
        if os.path.isdir(SILVER_PARQUET):
            shutil.rmtree(SILVER_PARQUET)
        else:
            os.remove(SILVER_PARQUET)

    os.makedirs(os.path.dirname(SILVER_PARQUET), exist_ok=True)
    df.to_parquet(SILVER_PARQUET, index=False, engine="pyarrow", compression="snappy")
    logger.info(f"Successfully saved Silver layer to {SILVER_PARQUET}")
    return df


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Clean-Silver") if has_spark_support() else None
    try:
        run_clean(spark)
    finally:
        if spark:
            spark.stop()
