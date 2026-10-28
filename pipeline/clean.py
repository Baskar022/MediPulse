"""
MediPulse Big Data Pipeline - Stage 2: Clean (Silver Layer)
Cleans and standardizes encounters:
- Replaces '?' with null across all string fields.
- Drops columns with >40% missing data (weight, payer_code, medical_specialty).
- Maps admission, discharge, and admission source IDs to clinical text descriptions.
- Filters out expired and hospice discharges (IDs 11, 13, 14, 19, 20, 21) as they cannot be readmitted.
- Deduplicates to keep only the initial encounter per patient_nbr to eliminate patient leakage.
- Saves result to Silver Parquet.
"""

import os
import sys
import logging
from pyspark.sql import functions as F
from pyspark.sql.window import Window

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, BRONZE_PARQUET, SILVER_PARQUET, MAPPING_PATH

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.clean")

# Excluded discharge disposition IDs:
# 11: Expired
# 13: Hospice / home
# 14: Hospice / medical facility
# 19: Expired at home. Medicaid only, hospice.
# 20: Expired in a medical facility. Medicaid only, hospice.
# 21: Expired, place unknown. Medicaid only, hospice.
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
    if spark is None:
        spark = get_spark_session("MediPulse-Clean-Silver")

    logger.info(f"Loading Bronze Parquet from {BRONZE_PARQUET}...")
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
    # Weight: >96% missing
    # Payer_code: ~40-52% missing
    # Medical_specialty: ~49% missing
    dropped_cols = ["weight", "payer_code", "medical_specialty"]
    logger.info(f"Dropping high-missingness (>40%) columns: {dropped_cols}")
    df = df.drop(*dropped_cols)

    # 3. Exclude patients who expired or entered hospice care
    df = df.filter(~F.col("discharge_disposition_id").isin(EXPIRED_HOSPICE_DISCHARGE_IDS))
    after_filter_count = df.count()
    logger.info(f"Filtered out expired/hospice records: {initial_count - after_filter_count:,} dropped, {after_filter_count:,} remaining.")

    # 4. Map IDs to clinical descriptions using Spark mapping expressions
    admission_types, discharge_dispositions, admission_sources = load_mapping_dicts()

    # Create mapping expressions with Fallback
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
    # We sort by encounter_id ascending for each patient_nbr
    window_spec = Window.partitionBy("patient_nbr").orderBy("encounter_id")
    df = df.withColumn("encounter_rank", F.row_number().over(window_spec))
    df = df.filter(F.col("encounter_rank") == 1).drop("encounter_rank")

    final_count = df.count()
    logger.info(f"Deduplicated to first encounter per patient: {final_count:,} unique patient encounters retained.")

    os.makedirs(os.path.dirname(SILVER_PARQUET), exist_ok=True)
    df.write.mode("overwrite").parquet(SILVER_PARQUET)
    logger.info(f"Successfully saved Silver layer to {SILVER_PARQUET}")
    return df


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Clean-Silver")
    try:
        run_clean(spark)
    finally:
        spark.stop()
