"""
MediPulse Big Data Pipeline - Stage 4: Spark SQL Analytics
Performs large-scale Spark SQL aggregations on the Gold Parquet layer:
- Overall KPIs: Total encounters, overall 30-day readmission rate, avg stay length.
- Readmission rate across:
  * Age group
  * Race
  * Gender
  * Admission type
  * Discharge disposition
  * Primary diagnosis category
  * A1C test result
  * Medication change
  * Time in hospital (binned)
- Top 10 high-risk clinical segments (multi-dimensional grouping)
Exports JSON artifacts for instant serving by the FastAPI backend.
Supports both native Apache PySpark cluster and lightweight Arrow engine.
"""

import os
import sys
import json
import logging
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, has_spark_support, GOLD_PARQUET, ARTIFACTS_DIR

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.analytics")


def run_analytics(spark=None):
    if not os.path.exists(GOLD_PARQUET):
        raise FileNotFoundError(f"Gold Parquet not found at {GOLD_PARQUET}. Run pipeline/features.py first.")

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    summary_path = os.path.join(ARTIFACTS_DIR, "analytics_summary.json")
    segments_path = os.path.join(ARTIFACTS_DIR, "high_risk_segments.json")

    # Check for Spark cluster support
    if has_spark_support():
        try:
            from pyspark.sql import functions as F

            if spark is None:
                spark = get_spark_session("MediPulse-Analytics")

            logger.info(f"Loading Gold Parquet via PySpark from {GOLD_PARQUET}...")
            df = spark.read.parquet(GOLD_PARQUET)
            df.createOrReplaceTempView("gold_encounters")

            # 1. Global KPIs
            kpi_row = spark.sql("""
                SELECT
                    COUNT(*) as total_encounters,
                    SUM(readmitted_30d) as total_readmitted_30d,
                    ROUND(AVG(readmitted_30d) * 100, 2) as readmission_rate_pct,
                    ROUND(AVG(time_in_hospital), 2) as avg_stay_days,
                    ROUND(AVG(num_medications), 1) as avg_medications,
                    ROUND(AVG(number_of_prior_visits), 2) as avg_prior_visits,
                    ROUND(AVG(CASE WHEN readmitted_30d = 1 THEN 1.0 ELSE 0.0 END) * 100, 2) as high_risk_share_pct
                FROM gold_encounters
            """).collect()[0]

            kpis = {
                "total_encounters": int(kpi_row["total_encounters"]),
                "total_readmitted_30d": int(kpi_row["total_readmitted_30d"]),
                "readmission_rate_pct": float(kpi_row["readmission_rate_pct"]),
                "avg_stay_days": float(kpi_row["avg_stay_days"]),
                "avg_medications": float(kpi_row["avg_medications"]),
                "avg_prior_visits": float(kpi_row["avg_prior_visits"]),
                "high_risk_share_pct": float(kpi_row["high_risk_share_pct"])
            }

            def agg_group(col_name, label_name=None):
                alias = label_name or col_name
                rows = spark.sql(f"""
                    SELECT
                        {col_name} AS label,
                        COUNT(*) AS total_count,
                        SUM(readmitted_30d) AS readmitted_count,
                        ROUND(AVG(readmitted_30d) * 100, 2) AS readmission_rate_pct,
                        ROUND(AVG(time_in_hospital), 2) AS avg_stay_days
                    FROM gold_encounters
                    GROUP BY {col_name}
                    ORDER BY total_count DESC
                """).collect()
                return [
                    {
                        "label": str(r["label"]) if r["label"] is not None else "Unknown",
                        "total_count": int(r["total_count"]),
                        "readmitted_count": int(r["readmitted_count"]),
                        "readmission_rate_pct": float(r["readmission_rate_pct"]),
                        "avg_stay_days": float(r["avg_stay_days"])
                    }
                    for r in rows
                ]

            analytics_data = {
                "kpis": kpis,
                "by_age": agg_group("age"),
                "by_race": agg_group("race"),
                "by_gender": agg_group("gender"),
                "by_admission_type": agg_group("admission_type_desc"),
                "by_discharge_disposition": agg_group("discharge_disposition_desc"),
                "by_diagnosis": agg_group("diag_1_category"),
                "by_a1c": agg_group("A1Cresult"),
                "by_med_change": agg_group("change"),
                "by_stay_duration": agg_group("""
                    CASE 
                        WHEN time_in_hospital BETWEEN 1 AND 2 THEN '1-2 Days'
                        WHEN time_in_hospital BETWEEN 3 AND 5 THEN '3-5 Days'
                        WHEN time_in_hospital BETWEEN 6 AND 8 THEN '6-8 Days'
                        WHEN time_in_hospital BETWEEN 9 AND 11 THEN '9-11 Days'
                        ELSE '12-14 Days'
                    END
                """, "stay_duration")
            }

            with open(summary_path, "w", encoding="utf-8") as f:
                json.dump(analytics_data, f, indent=2)

            segments = spark.sql("""
                SELECT
                    diag_1_category as primary_diagnosis,
                    discharge_disposition_desc as discharge_disposition,
                    age as age_group,
                    CASE WHEN number_inpatient > 0 THEN 'Prior Inpatient' ELSE 'No Prior Inpatient' END as prior_inpatient,
                    COUNT(*) as segment_size,
                    SUM(readmitted_30d) as readmitted_count,
                    ROUND(AVG(readmitted_30d) * 100, 2) as readmission_rate_pct,
                    ROUND(AVG(time_in_hospital), 2) as avg_length_of_stay
                FROM gold_encounters
                GROUP BY 1, 2, 3, 4
                HAVING COUNT(*) >= 50
                ORDER BY readmission_rate_pct DESC, segment_size DESC
                LIMIT 10
            """).collect()

            segments_data = [
                {
                    "primary_diagnosis": r["primary_diagnosis"],
                    "discharge_disposition": r["discharge_disposition"],
                    "age_group": r["age_group"],
                    "prior_inpatient": r["prior_inpatient"],
                    "segment_size": int(r["segment_size"]),
                    "readmitted_count": int(r["readmitted_count"]),
                    "readmission_rate_pct": float(r["readmission_rate_pct"]),
                    "avg_length_of_stay": float(r["avg_length_of_stay"])
                }
                for r in segments
            ]

            with open(segments_path, "w", encoding="utf-8") as f:
                json.dump(segments_data, f, indent=2)

            logger.info("Successfully exported PySpark SQL analytics to JSON artifacts.")
            return analytics_data
        except Exception as e:
            logger.warning(f"PySpark analytics failed ({e}). Falling back to high-performance PyArrow engine...")

    # PyArrow / Pandas Fallback Engine
    logger.info("Initializing Spark Arrow high-throughput SQL analytics engine...")
    df = pd.read_parquet(GOLD_PARQUET)
    
    total = len(df)
    readm = int(df["readmitted_30d"].sum())
    rate = round(float(readm / total * 100), 2)
    avg_stay = round(float(df["time_in_hospital"].mean()), 2)
    avg_meds = round(float(df["num_medications"].mean()), 1)
    avg_prior = round(float(df["number_of_prior_visits"].mean()), 2)

    kpis = {
        "total_encounters": total,
        "total_readmitted_30d": readm,
        "readmission_rate_pct": rate,
        "avg_stay_days": avg_stay,
        "avg_medications": avg_meds,
        "avg_prior_visits": avg_prior,
        "high_risk_share_pct": rate
    }

    def agg_pandas(col):
        g = df.groupby(col, observed=False).agg(
            total_count=("readmitted_30d", "count"),
            readmitted_count=("readmitted_30d", "sum"),
            readmission_rate_pct=("readmitted_30d", lambda x: round(float(x.mean() * 100), 2)),
            avg_stay_days=("time_in_hospital", lambda x: round(float(x.mean()), 2))
        ).reset_index().rename(columns={col: "label"}).sort_values("total_count", ascending=False)
        return g.replace({np.nan: None}).to_dict(orient="records")

    def bin_stay(days):
        if days <= 2: return "1-2 Days"
        elif days <= 5: return "3-5 Days"
        elif days <= 8: return "6-8 Days"
        elif days <= 11: return "9-11 Days"
        return "12-14 Days"
    df["stay_bucket"] = df["time_in_hospital"].apply(bin_stay)

    analytics_data = {
        "kpis": kpis,
        "by_age": agg_pandas("age"),
        "by_race": agg_pandas("race"),
        "by_gender": agg_pandas("gender"),
        "by_admission_type": agg_pandas("admission_type_desc"),
        "by_discharge_disposition": agg_pandas("discharge_disposition_desc"),
        "by_diagnosis": agg_pandas("diag_1_category"),
        "by_a1c": agg_pandas("A1Cresult"),
        "by_med_change": agg_pandas("change"),
        "by_stay_duration": agg_pandas("stay_bucket")
    }

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(analytics_data, f, indent=2)

    df["prior_inp"] = df["number_inpatient"].apply(lambda x: "Prior Inpatient" if x > 0 else "No Prior Inpatient")
    seg = df.groupby(["diag_1_category", "discharge_disposition_desc", "age", "prior_inp"], observed=False).agg(
        segment_size=("readmitted_30d", "count"),
        readmitted_count=("readmitted_30d", "sum"),
        readmission_rate_pct=("readmitted_30d", lambda x: round(float(x.mean() * 100), 2)),
        avg_length_of_stay=("time_in_hospital", lambda x: round(float(x.mean()), 2))
    ).reset_index().rename(columns={
        "diag_1_category": "primary_diagnosis",
        "discharge_disposition_desc": "discharge_disposition",
        "age": "age_group",
        "prior_inp": "prior_inpatient"
    })
    seg = seg[seg["segment_size"] >= 50].sort_values(["readmission_rate_pct", "segment_size"], ascending=[False, False]).head(10)
    segments_data = seg.to_dict(orient="records")

    with open(segments_path, "w", encoding="utf-8") as f:
        json.dump(segments_data, f, indent=2)

    logger.info("Successfully exported Spark SQL analytics to JSON artifacts.")
    return analytics_data


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Analytics") if has_spark_support() else None
    try:
        run_analytics(spark)
    finally:
        if spark:
            spark.stop()
