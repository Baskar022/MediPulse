"""
MediPulse Big Data Pipeline - Stage 3: Features (Gold Layer)
Engineers clinical features and domain aggregations:
- ICD-9 diagnosis code grouping into primary clinical categories.
- Combined prior hospital utilization (number_of_prior_visits).
- Medication adjustments (med_change_flag, total_meds_changed, polypharmacy_count).
- Age midpoint numeric feature.
- Laboratory test indicator flags (A1C_flag, glucose_flag).
- Binary 30-day readmission target: 1 if readmitted == '<30', else 0.
- Saves result to Gold Parquet.
"""

import os
import sys
import logging
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, DoubleType

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, SILVER_PARQUET, GOLD_PARQUET

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.features")

MED_COLUMNS = [
    "metformin", "repaglinide", "nateglinide", "chlorpropamide", "glimepiride",
    "acetohexamide", "glipizide", "glyburide", "tolbutamide", "pioglitazone",
    "rosiglitazone", "acarbose", "miglitol", "troglitazone", "tolazamide",
    "examide", "citoglipton", "insulin", "glyburide-metformin", "glipizide-metformin",
    "glimepiride-pioglitazone", "metformin-rosiglitazone", "metformin-pioglitazone"
]


def classify_icd9_category(col_name: str):
    """
    Classifies ICD-9 codes into 9 major clinical categories:
    Circulatory, Respiratory, Digestive, Diabetes, Injury,
    Musculoskeletal, Genitourinary, Neoplasms, Other.
    """
    col = F.col(col_name)
    # Check if code is numeric or has decimals
    # Strip any prefix/suffix
    clean_code = F.regexp_replace(col, "\\..*", "")
    numeric_code = F.when(clean_code.rlike("^[0-9]+$"), clean_code.cast(IntegerType())).otherwise(F.lit(-1))

    return (
        F.when(col.isNull() | (col == "?"), "Missing/Unknown")
        .when(col.startswith("250"), "Diabetes")
        .when((numeric_code.between(390, 459)) | (numeric_code == 785), "Circulatory")
        .when((numeric_code.between(460, 519)) | (numeric_code == 786), "Respiratory")
        .when((numeric_code.between(520, 579)) | (numeric_code == 787), "Digestive")
        .when(numeric_code.between(580, 629) | (numeric_code == 788), "Genitourinary")
        .when(numeric_code.between(140, 239), "Neoplasms")
        .when(numeric_code.between(710, 739), "Musculoskeletal")
        .when(numeric_code.between(800, 999), "Injury")
        .otherwise("Other")
    )


def run_features(spark=None):
    if spark is None:
        spark = get_spark_session("MediPulse-Features-Gold")

    logger.info(f"Loading Silver Parquet from {SILVER_PARQUET}...")
    df = spark.read.parquet(SILVER_PARQUET)

    # 1. Target variable: 1 if readmitted within 30 days (<30), otherwise 0
    df = df.withColumn(
        "readmitted_30d",
        F.when(F.col("readmitted") == "<30", 1).otherwise(0)
    )

    # 2. Age midpoint feature
    df = df.withColumn(
        "age_midpoint",
        F.when(F.col("age") == "[0-10)", 5)
        .when(F.col("age") == "[10-20)", 15)
        .when(F.col("age") == "[20-30)", 25)
        .when(F.col("age") == "[30-40)", 35)
        .when(F.col("age") == "[40-50)", 45)
        .when(F.col("age") == "[50-60)", 55)
        .when(F.col("age") == "[60-70)", 65)
        .when(F.col("age") == "[70-80)", 75)
        .when(F.col("age") == "[80-90)", 85)
        .when(F.col("age") == "[90-100)", 95)
        .otherwise(65)
    )

    # 3. ICD-9 diagnosis classification
    df = df.withColumn("diag_1_category", classify_icd9_category("diag_1"))
    df = df.withColumn("diag_2_category", classify_icd9_category("diag_2"))
    df = df.withColumn("diag_3_category", classify_icd9_category("diag_3"))

    # 4. Total prior visits (Outpatient + Emergency + Inpatient)
    df = df.withColumn(
        "number_of_prior_visits",
        F.coalesce(F.col("number_outpatient"), F.lit(0)) +
        F.coalesce(F.col("number_emergency"), F.lit(0)) +
        F.coalesce(F.col("number_inpatient"), F.lit(0))
    )

    # 5. Medication change flag (1 if change == 'Ch' else 0)
    df = df.withColumn(
        "med_change_flag",
        F.when(F.col("change") == "Ch", 1).otherwise(0)
    )

    # 6. Total medications changed (Up or Down across 23 medications)
    changed_expr = F.lit(0)
    polypharmacy_expr = F.lit(0)
    for med in MED_COLUMNS:
        if med in df.columns:
            changed_expr = changed_expr + F.when((F.col(med) == "Up") | (F.col(med) == "Down"), 1).otherwise(0)
            polypharmacy_expr = polypharmacy_expr + F.when((F.col(med) != "No") & F.col(med).isNotNull(), 1).otherwise(0)

    df = df.withColumn("total_meds_changed", changed_expr)
    df = df.withColumn("polypharmacy_count", polypharmacy_expr)

    # 7. A1C result numeric indicator
    df = df.withColumn(
        "A1C_flag",
        F.when(F.col("A1Cresult") == ">8", 3)
        .when(F.col("A1Cresult") == ">7", 2)
        .when(F.col("A1Cresult") == "Norm", 1)
        .otherwise(0)  # None or not tested
    )

    # 8. Max glucose serum numeric indicator
    df = df.withColumn(
        "glucose_flag",
        F.when(F.col("max_glu_serum") == ">300", 3)
        .when(F.col("max_glu_serum") == ">200", 2)
        .when(F.col("max_glu_serum") == "Norm", 1)
        .otherwise(0)  # None or not tested
    )

    # Fill default race/gender if null
    df = df.withColumn("race", F.coalesce(F.col("race"), F.lit("Unknown")))
    df = df.withColumn("gender", F.coalesce(F.col("gender"), F.lit("Unknown")))

    total_gold = df.count()
    pos_cases = df.filter(F.col("readmitted_30d") == 1).count()
    logger.info(f"Gold Layer ready: {total_gold:,} records. 30-day Readmitted (<30): {pos_cases:,} ({pos_cases / total_gold * 100:.2f}%)")

    os.makedirs(os.path.dirname(GOLD_PARQUET), exist_ok=True)
    df.write.mode("overwrite").parquet(GOLD_PARQUET)
    logger.info(f"Successfully saved Gold layer to {GOLD_PARQUET}")
    return df


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Features-Gold")
    try:
        run_features(spark)
    finally:
        spark.stop()
