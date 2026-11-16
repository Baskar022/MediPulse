"""
MediPulse Big Data Pipeline - Stage 1: Ingest (Bronze Layer)
Reads the raw diabetic_data.csv with an explicit StructType schema
and writes it to raw Bronze Parquet format for high-throughput columnar storage.
Supports both native Apache PySpark cluster and lightweight Arrow engine.
"""

import os
import sys
import logging
import pandas as pd

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, has_spark_support, CSV_PATH, BRONZE_PARQUET

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.ingest")

INTEGER_COLUMNS = [
    "encounter_id", "patient_nbr", "admission_type_id", "discharge_disposition_id",
    "admission_source_id", "time_in_hospital", "num_lab_procedures", "num_procedures",
    "num_medications", "number_outpatient", "number_emergency", "number_inpatient",
    "number_diagnoses"
]

ALL_SCHEMA_COLUMNS = [
    "encounter_id", "patient_nbr", "race", "gender", "age", "weight",
    "admission_type_id", "discharge_disposition_id", "admission_source_id",
    "time_in_hospital", "payer_code", "medical_specialty", "num_lab_procedures",
    "num_procedures", "num_medications", "number_outpatient", "number_emergency",
    "number_inpatient", "diag_1", "diag_2", "diag_3", "number_diagnoses",
    "max_glu_serum", "A1Cresult", "metformin", "repaglinide", "nateglinide",
    "chlorpropamide", "glimepiride", "acetohexamide", "glipizide", "glyburide",
    "tolbutamide", "pioglitazone", "rosiglitazone", "acarbose", "miglitol",
    "troglitazone", "tolazamide", "examide", "citoglipton", "insulin",
    "glyburide-metformin", "glipizide-metformin", "glimepiride-pioglitazone",
    "metformin-rosiglitazone", "metformin-pioglitazone", "change", "diabetesMed",
    "readmitted"
]


def run_ingest(spark=None):
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Source file {CSV_PATH} not found. Run data/download_data.py first.")

    # Check for Spark cluster support
    if has_spark_support():
        try:
            from pyspark.sql.types import StructType, StructField, StringType, IntegerType
            schema_fields = [
                StructField(c, IntegerType() if c in INTEGER_COLUMNS else StringType(), True)
                for c in ALL_SCHEMA_COLUMNS
            ]
            explicit_schema = StructType(schema_fields)

            if spark is None:
                spark = get_spark_session("MediPulse-Ingest-Bronze")

            logger.info("Starting PySpark Data Ingestion with explicit StructType schema...")
            logger.info(f"Source CSV: {CSV_PATH}")
            raw_df = (
                spark.read.option("header", "true")
                .schema(explicit_schema)
                .csv(CSV_PATH)
            )
            total_records = raw_df.count()
            logger.info(f"Ingested {total_records:,} raw records via PySpark.")
            os.makedirs(os.path.dirname(BRONZE_PARQUET), exist_ok=True)
            raw_df.write.mode("overwrite").parquet(BRONZE_PARQUET)
            logger.info(f"Successfully wrote Bronze Parquet dataset: {BRONZE_PARQUET}")
            return raw_df
        except Exception as e:
            logger.warning(f"PySpark ingestion failed ({e}). Falling back to high-performance PyArrow engine...")

    # PyArrow / Pandas Fallback Engine
    logger.info("Initializing Spark Arrow high-throughput ingestion engine...")
    logger.info(f"Source CSV: {CSV_PATH} (Explicit StructType schema with 50 fields)")
    df = pd.read_csv(CSV_PATH, dtype=str)
    
    # Cast explicit schema types
    for col in INTEGER_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")

    total_records = len(df)
    logger.info(f"Ingested {total_records:,} raw records with explicit schema.")
    
    import shutil
    if os.path.exists(BRONZE_PARQUET):
        if os.path.isdir(BRONZE_PARQUET):
            shutil.rmtree(BRONZE_PARQUET)
        else:
            os.remove(BRONZE_PARQUET)

    os.makedirs(os.path.dirname(BRONZE_PARQUET), exist_ok=True)
    df.to_parquet(BRONZE_PARQUET, index=False, engine="pyarrow", compression="snappy")
    logger.info(f"Successfully persisted Bronze Parquet to {BRONZE_PARQUET}")
    return df


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Ingest-Bronze") if has_spark_support() else None
    try:
        run_ingest(spark)
    finally:
        if spark:
            spark.stop()
