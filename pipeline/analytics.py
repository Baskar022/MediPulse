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
"""

import os
import sys
import json
import logging
from pyspark.sql import functions as F

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, GOLD_PARQUET, ARTIFACTS_DIR

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.analytics")


def run_analytics(spark=None):
    if spark is None:
        spark = get_spark_session("MediPulse-Analytics")

    logger.info(f"Loading Gold Parquet from {GOLD_PARQUET}...")
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
    logger.info(f"KPIs computed: {kpis}")

    def query_breakdown(group_col, order_clause=None):
        order_str = order_clause if order_clause else f"total_count DESC"
        q = f"""
            SELECT
                COALESCE(CAST({group_col} AS STRING), 'Unknown') as label,
                COUNT(*) as total_count,
                SUM(readmitted_30d) as readmitted_count,
                ROUND(AVG(readmitted_30d) * 100, 2) as readmission_rate_pct,
                ROUND(AVG(time_in_hospital), 2) as avg_stay_days
            FROM gold_encounters
            GROUP BY {group_col}
            ORDER BY {order_str}
        """
        rows = spark.sql(q).collect()
        return [
            {
                "label": r["label"],
                "total_count": int(r["total_count"]),
                "readmitted_count": int(r["readmitted_count"]),
                "readmission_rate_pct": float(r["readmission_rate_pct"] or 0.0),
                "avg_stay_days": float(r["avg_stay_days"] or 0.0)
            }
            for r in rows
        ]

    # Time in hospital buckets
    spark.sql("""
        SELECT
            CASE
                WHEN time_in_hospital BETWEEN 1 AND 2 THEN '1-2 Days'
                WHEN time_in_hospital BETWEEN 3 AND 5 THEN '3-5 Days'
                WHEN time_in_hospital BETWEEN 6 AND 8 THEN '6-8 Days'
                WHEN time_in_hospital BETWEEN 9 AND 11 THEN '9-11 Days'
                ELSE '12-14 Days'
            END as stay_bucket,
            COUNT(*) as total_count,
            SUM(readmitted_30d) as readmitted_count,
            ROUND(AVG(readmitted_30d) * 100, 2) as readmission_rate_pct,
            MIN(time_in_hospital) as sort_key
        FROM gold_encounters
        GROUP BY 1
        ORDER BY sort_key ASC
    """).createOrReplaceTempView("stay_buckets_view")

    stay_buckets = [
        {
            "label": r["stay_bucket"],
            "total_count": int(r["total_count"]),
            "readmitted_count": int(r["readmitted_count"]),
            "readmission_rate_pct": float(r["readmission_rate_pct"] or 0.0)
        }
        for r in spark.sql("SELECT * FROM stay_buckets_view").collect()
    ]

    breakdowns = {
        "kpis": kpis,
        "by_age": query_breakdown("age", "label ASC"),
        "by_race": query_breakdown("race"),
        "by_gender": query_breakdown("gender"),
        "by_admission_type": query_breakdown("admission_type_desc"),
        "by_discharge_disposition": query_breakdown("discharge_disposition_desc"),
        "by_diagnosis": query_breakdown("diag_1_category"),
        "by_a1c": query_breakdown("A1Cresult"),
        "by_med_change": query_breakdown("change"),
        "by_stay_duration": stay_buckets
    }

    # Top 10 High-Risk Segments (Diagnosis + Discharge + Prior Inpatient condition)
    high_risk_segments_df = spark.sql("""
        SELECT
            diag_1_category as primary_diagnosis,
            discharge_disposition_desc as discharge_disposition,
            age as age_group,
            CASE WHEN number_inpatient > 0 THEN 'Prior Inpatient Visit' ELSE 'No Prior Inpatient' END as prior_inpatient_status,
            COUNT(*) as segment_size,
            SUM(readmitted_30d) as readmitted_count,
            ROUND(AVG(readmitted_30d) * 100, 2) as readmission_rate_pct,
            ROUND(AVG(time_in_hospital), 2) as avg_length_of_stay
        FROM gold_encounters
        GROUP BY 1, 2, 3, 4
        HAVING COUNT(*) >= 50
        ORDER BY readmission_rate_pct DESC, segment_size DESC
        LIMIT 10
    """)

    top_segments = [
        {
            "rank": i + 1,
            "primary_diagnosis": r["primary_diagnosis"],
            "discharge_disposition": r["discharge_disposition"],
            "age_group": r["age_group"],
            "prior_inpatient_status": r["prior_inpatient_status"],
            "segment_size": int(r["segment_size"]),
            "readmitted_count": int(r["readmitted_count"]),
            "readmission_rate_pct": float(r["readmission_rate_pct"] or 0.0),
            "avg_length_of_stay": float(r["avg_length_of_stay"] or 0.0)
        }
        for i, r in enumerate(high_risk_segments_df.collect())
    ]

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    summary_path = os.path.join(ARTIFACTS_DIR, "analytics_summary.json")
    segments_path = os.path.join(ARTIFACTS_DIR, "high_risk_segments.json")

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(breakdowns, f, indent=2)
    with open(segments_path, "w", encoding="utf-8") as f:
        json.dump(top_segments, f, indent=2)

    logger.info(f"Saved analytics summary to {summary_path}")
    logger.info(f"Saved high-risk segments to {segments_path}")
    return breakdowns, top_segments


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Analytics")
    try:
        run_analytics(spark)
    finally:
        spark.stop()
