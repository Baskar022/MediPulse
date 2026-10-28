"""
MediPulse Big Data Pipeline - Stage 1: Ingest (Bronze Layer)
Reads the raw diabetic_data.csv with an explicit StructType schema
and writes it to raw Bronze Parquet format for high-throughput columnar storage.
"""

import os
import sys
import logging
from pyspark.sql.types import StructType, StructField, StringType, IntegerType

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, CSV_PATH, BRONZE_PARQUET

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.ingest")

EXPLICIT_SCHEMA = StructType([
    StructField("encounter_id", IntegerType(), True),
    StructField("patient_nbr", IntegerType(), True),
    StructField("race", StringType(), True),
    StructField("gender", StringType(), True),
    StructField("age", StringType(), True),
    StructField("weight", StringType(), True),
    StructField("admission_type_id", IntegerType(), True),
    StructField("discharge_disposition_id", IntegerType(), True),
    StructField("admission_source_id", IntegerType(), True),
    StructField("time_in_hospital", IntegerType(), True),
    StructField("payer_code", StringType(), True),
    StructField("medical_specialty", StringType(), True),
    StructField("num_lab_procedures", IntegerType(), True),
    StructField("num_procedures", IntegerType(), True),
    StructField("num_medications", IntegerType(), True),
    StructField("number_outpatient", IntegerType(), True),
    StructField("number_emergency", IntegerType(), True),
    StructField("number_inpatient", IntegerType(), True),
    StructField("diag_1", StringType(), True),
    StructField("diag_2", StringType(), True),
    StructField("diag_3", StringType(), True),
    StructField("number_diagnoses", IntegerType(), True),
    StructField("max_glu_serum", StringType(), True),
    StructField("A1Cresult", StringType(), True),
    StructField("metformin", StringType(), True),
    StructField("repaglinide", StringType(), True),
    StructField("nateglinide", StringType(), True),
    StructField("chlorpropamide", StringType(), True),
    StructField("glimepiride", StringType(), True),
    StructField("acetohexamide", StringType(), True),
    StructField("glipizide", StringType(), True),
    StructField("glyburide", StringType(), True),
    StructField("tolbutamide", StringType(), True),
    StructField("pioglitazone", StringType(), True),
    StructField("rosiglitazone", StringType(), True),
    StructField("acarbose", StringType(), True),
    StructField("miglitol", StringType(), True),
    StructField("troglitazone", StringType(), True),
    StructField("tolazamide", StringType(), True),
    StructField("examide", StringType(), True),
    StructField("citoglipton", StringType(), True),
    StructField("insulin", StringType(), True),
    StructField("glyburide-metformin", StringType(), True),
    StructField("glipizide-metformin", StringType(), True),
    StructField("glimepiride-pioglitazone", StringType(), True),
    StructField("metformin-rosiglitazone", StringType(), True),
    StructField("metformin-pioglitazone", StringType(), True),
    StructField("change", StringType(), True),
    StructField("diabetesMed", StringType(), True),
    StructField("readmitted", StringType(), True),
])


def run_ingest(spark=None):
    if spark is None:
        spark = get_spark_session("MediPulse-Ingest-Bronze")

    logger.info(f"Ingesting raw CSV from {CSV_PATH} with explicit schema...")
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Source file {CSV_PATH} not found. Run download_data.py first.")

    raw_df = (
        spark.read.option("header", "true")
        .schema(EXPLICIT_SCHEMA)
        .csv(CSV_PATH)
    )

    total_records = raw_df.count()
    logger.info(f"Ingested {total_records:,} raw records. Writing to Bronze Parquet at {BRONZE_PARQUET}...")

    os.makedirs(os.path.dirname(BRONZE_PARQUET), exist_ok=True)
    raw_df.write.mode("overwrite").parquet(BRONZE_PARQUET)
    logger.info(f"Successfully created Bronze layer Parquet dataset: {BRONZE_PARQUET}")
    return raw_df


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Ingest-Bronze")
    try:
        run_ingest(spark)
    finally:
        spark.stop()
