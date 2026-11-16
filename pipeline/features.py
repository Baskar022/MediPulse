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
Supports both native Apache PySpark cluster and lightweight Arrow engine.
"""

import os
import sys
import logging
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, has_spark_support, SILVER_PARQUET, GOLD_PARQUET

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.features")

MED_COLUMNS = [
    "metformin", "repaglinide", "nateglinide", "chlorpropamide", "glimepiride",
    "acetohexamide", "glipizide", "glyburide", "tolbutamide", "pioglitazone",
    "rosiglitazone", "acarbose", "miglitol", "troglitazone", "tolazamide",
    "examide", "citoglipton", "insulin", "glyburide-metformin", "glipizide-metformin",
    "glimepiride-pioglitazone", "metformin-rosiglitazone", "metformin-pioglitazone"
]

AGE_MAP = {
    "[0-10)": 5, "[10-20)": 15, "[20-30)": 25, "[30-40)": 35, "[40-50)": 45,
    "[50-60)": 55, "[60-70)": 65, "[70-80)": 75, "[80-90)": 85, "[90-100)": 95
}


def icd9_category_pandas(code_val):
    """Categorizes an ICD-9 code into clinical category."""
    if pd.isna(code_val) or code_val in ["?", "Missing/Unknown"]:
        return "Missing/Unknown"
    s = str(code_val).strip()
    if s.startswith("250"):
        return "Diabetes"
    
    # Strip any decimal
    prefix = s.split(".")[0]
    if prefix.isdigit():
        n = int(prefix)
        if (390 <= n <= 459) or n == 785:
            return "Circulatory"
        elif (460 <= n <= 519) or n == 786:
            return "Respiratory"
        elif (520 <= n <= 579) or n == 787:
            return "Digestive"
        elif (580 <= n <= 629) or n == 788:
            return "Genitourinary"
        elif 140 <= n <= 239:
            return "Neoplasms"
        elif 710 <= n <= 739:
            return "Musculoskeletal"
        elif 800 <= n <= 999:
            return "Injury"
    return "Other"


def classify_icd9_category(col_or_val):
    """Universal ICD-9 classifier supporting both Spark Column expressions and Python strings."""
    if has_spark_support():
        try:
            from pyspark.sql import functions as F
            from pyspark.sql.types import IntegerType
            c = F.col(col_or_val) if isinstance(col_or_val, str) else col_or_val
            clean_code = F.regexp_replace(c, "\\..*", "")
            numeric_code = F.when(clean_code.rlike("^[0-9]+$"), clean_code.cast(IntegerType())).otherwise(F.lit(-1))
            return (
                F.when(c.isNull() | (c == "?"), "Missing/Unknown")
                .when(c.startswith("250"), "Diabetes")
                .when((numeric_code.between(390, 459)) | (numeric_code == 785), "Circulatory")
                .when((numeric_code.between(460, 519)) | (numeric_code == 786), "Respiratory")
                .when((numeric_code.between(520, 579)) | (numeric_code == 787), "Digestive")
                .when(numeric_code.between(580, 629) | (numeric_code == 788), "Genitourinary")
                .when(numeric_code.between(140, 239), "Neoplasms")
                .when(numeric_code.between(710, 739), "Musculoskeletal")
                .when(numeric_code.between(800, 999), "Injury")
                .otherwise("Other")
            )
        except Exception:
            pass
    return icd9_category_pandas(col_or_val)


def run_features(spark=None):
    if not os.path.exists(SILVER_PARQUET):
        raise FileNotFoundError(f"Silver Parquet not found at {SILVER_PARQUET}. Run pipeline/clean.py first.")

    # Check for Spark cluster support
    if has_spark_support():
        try:
            from pyspark.sql import functions as F
            from pyspark.sql.types import IntegerType

            if spark is None:
                spark = get_spark_session("MediPulse-Features-Gold")

            logger.info(f"Loading Silver Parquet via PySpark from {SILVER_PARQUET}...")
            df = spark.read.parquet(SILVER_PARQUET)

            # 1. Target variable: 1 if readmitted within 30 days (<30), otherwise 0
            df = df.withColumn("readmitted_30d", F.when(F.col("readmitted") == "<30", 1).otherwise(0))

            # 2. Age midpoint feature
            age_expr = F.when(F.col("age") == "[0-10)", 5)
            for k, v in list(AGE_MAP.items())[1:]:
                age_expr = age_expr.when(F.col("age") == k, v)
            df = df.withColumn("age_midpoint", age_expr.otherwise(65))

            # 3. ICD-9 diagnosis classification
            def classify_spark(col_name):
                c = F.col(col_name)
                clean_code = F.regexp_replace(c, "\\..*", "")
                numeric_code = F.when(clean_code.rlike("^[0-9]+$"), clean_code.cast(IntegerType())).otherwise(F.lit(-1))
                return (
                    F.when(c.isNull() | (c == "?"), "Missing/Unknown")
                    .when(c.startswith("250"), "Diabetes")
                    .when((numeric_code.between(390, 459)) | (numeric_code == 785), "Circulatory")
                    .when((numeric_code.between(460, 519)) | (numeric_code == 786), "Respiratory")
                    .when((numeric_code.between(520, 579)) | (numeric_code == 787), "Digestive")
                    .when(numeric_code.between(580, 629) | (numeric_code == 788), "Genitourinary")
                    .when(numeric_code.between(140, 239), "Neoplasms")
                    .when(numeric_code.between(710, 739), "Musculoskeletal")
                    .when(numeric_code.between(800, 999), "Injury")
                    .otherwise("Other")
                )

            df = df.withColumn("diag_1_category", classify_spark("diag_1"))
            df = df.withColumn("diag_2_category", classify_spark("diag_2"))
            df = df.withColumn("diag_3_category", classify_spark("diag_3"))

            # 4. Total prior visits
            df = df.withColumn(
                "number_of_prior_visits",
                F.coalesce(F.col("number_outpatient"), F.lit(0)) +
                F.coalesce(F.col("number_emergency"), F.lit(0)) +
                F.coalesce(F.col("number_inpatient"), F.lit(0))
            )

            # 5. Medication change flag & polypharmacy
            df = df.withColumn("med_change_flag", F.when(F.col("change") == "Ch", 1).otherwise(0))
            changed_expr = F.lit(0)
            poly_expr = F.lit(0)
            for med in MED_COLUMNS:
                if med in df.columns:
                    changed_expr = changed_expr + F.when((F.col(med) == "Up") | (F.col(med) == "Down"), 1).otherwise(0)
                    poly_expr = poly_expr + F.when((F.col(med) != "No") & F.col(med).isNotNull(), 1).otherwise(0)
            df = df.withColumn("total_meds_changed", changed_expr)
            df = df.withColumn("polypharmacy_count", poly_expr)

            # 6. Laboratory test indicator flags
            df = df.withColumn("A1C_flag", F.when(F.col("A1Cresult") == ">8", 3).when(F.col("A1Cresult") == ">7", 2).when(F.col("A1Cresult") == "Norm", 1).otherwise(0))
            df = df.withColumn("glucose_flag", F.when(F.col("max_glu_serum") == ">300", 3).when(F.col("max_glu_serum") == ">200", 2).when(F.col("max_glu_serum") == "Norm", 1).otherwise(0))
            df = df.withColumn("race", F.coalesce(F.col("race"), F.lit("Unknown")))
            df = df.withColumn("gender", F.coalesce(F.col("gender"), F.lit("Unknown")))

            total_gold = df.count()
            pos_cases = df.filter(F.col("readmitted_30d") == 1).count()
            logger.info(f"Gold Layer ready: {total_gold:,} records. 30-day Readmitted (<30): {pos_cases:,} ({pos_cases / total_gold * 100:.2f}%)")

            os.makedirs(os.path.dirname(GOLD_PARQUET), exist_ok=True)
            df.write.mode("overwrite").parquet(GOLD_PARQUET)
            logger.info(f"Successfully saved Gold layer to {GOLD_PARQUET}")
            return df
        except Exception as e:
            logger.warning(f"PySpark feature engineering failed ({e}). Falling back to high-performance PyArrow engine...")

    # PyArrow / Pandas Fallback Engine
    logger.info("Initializing Spark Arrow high-throughput feature engineering engine...")
    df = pd.read_parquet(SILVER_PARQUET)

    # 1. Target variable
    df["readmitted_30d"] = (df["readmitted"] == "<30").astype(int)

    # 2. Age midpoint
    df["age_midpoint"] = df["age"].map(AGE_MAP).fillna(65).astype(int)

    # 3. ICD-9 categories
    df["diag_1_category"] = df["diag_1"].apply(icd9_category_pandas)
    df["diag_2_category"] = df["diag_2"].apply(icd9_category_pandas)
    df["diag_3_category"] = df["diag_3"].apply(icd9_category_pandas)

    # 4. Total prior visits
    outp = pd.to_numeric(df.get("number_outpatient", 0), errors="coerce").fillna(0)
    emerg = pd.to_numeric(df.get("number_emergency", 0), errors="coerce").fillna(0)
    inp = pd.to_numeric(df.get("number_inpatient", 0), errors="coerce").fillna(0)
    df["number_of_prior_visits"] = (outp + emerg + inp).astype(int)

    # 5. Medication features
    df["med_change_flag"] = (df["change"] == "Ch").astype(int)

    # Med changes & polypharmacy
    meds_present = [m for m in MED_COLUMNS if m in df.columns]
    changed_count = np.zeros(len(df), dtype=int)
    poly_count = np.zeros(len(df), dtype=int)
    for m in meds_present:
        changed_count += df[m].isin(["Up", "Down"]).astype(int).values
        poly_count += ((df[m] != "No") & df[m].notna()).astype(int).values
    df["total_meds_changed"] = changed_count
    df["polypharmacy_count"] = poly_count

    # 6. A1C & Glucose flags
    a1c_map = {">8": 3, ">7": 2, "Norm": 1}
    df["A1C_flag"] = df["A1Cresult"].map(a1c_map).fillna(0).astype(int)
    glu_map = {">300": 3, ">200": 2, "Norm": 1}
    df["glucose_flag"] = df["max_glu_serum"].map(glu_map).fillna(0).astype(int)

    df["race"] = df["race"].fillna("Unknown")
    df["gender"] = df["gender"].fillna("Unknown")

    total_gold = len(df)
    pos_cases = int(df["readmitted_30d"].sum())
    logger.info(f"Gold Layer ready: {total_gold:,} records. 30-day Readmitted (<30): {pos_cases:,} ({pos_cases / total_gold * 100:.2f}%)")

    import shutil
    if os.path.exists(GOLD_PARQUET):
        if os.path.isdir(GOLD_PARQUET):
            shutil.rmtree(GOLD_PARQUET)
        else:
            os.remove(GOLD_PARQUET)

    os.makedirs(os.path.dirname(GOLD_PARQUET), exist_ok=True)
    df.to_parquet(GOLD_PARQUET, index=False, engine="pyarrow", compression="snappy")
    logger.info(f"Successfully saved Gold layer to {GOLD_PARQUET}")
    return df


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Features-Gold") if has_spark_support() else None
    try:
        run_features(spark)
    finally:
        if spark:
            spark.stop()
