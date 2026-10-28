"""
MediPulse Big Data Pipeline - Stage 6: Scalability Benchmark
Compares execution time and memory characteristics between Pandas and PySpark
for identical cleaning and multi-group aggregations across 100k, 500k, and 1M records.
Saves CSV, JSON summary, and benchmark chart in artifacts/.
"""

import os
import sys
import time
import json
import logging
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, CSV_PATH, ARTIFACTS_DIR
from data.generate_large_dataset import generate_scaled_dataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.benchmark")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def benchmark_pandas(file_path: str):
    start = time.perf_counter()
    # 1. Ingest
    pdf = pd.read_csv(file_path, low_memory=False)

    # 2. Clean
    # Replace '?' with NaN
    pdf.replace("?", np.nan, inplace=True)
    # Drop >40% missing columns
    pdf.drop(columns=["weight", "payer_code", "medical_specialty"], errors="ignore", inplace=True)
    # Exclude expired
    expired_ids = [11, 13, 14, 19, 20, 21]
    if "discharge_disposition_id" in pdf.columns:
        pdf = pdf[~pdf["discharge_disposition_id"].isin(expired_ids)]

    # Deduplicate by patient_nbr
    if "patient_nbr" in pdf.columns:
        pdf.drop_duplicates(subset=["patient_nbr"], keep="first", inplace=True)

    # 3. Aggregate
    pdf["readmitted_30d"] = (pdf["readmitted"] == "<30").astype(int)
    agg = pdf.groupby(["age", "race"], observed=False).agg(
        total_count=("encounter_id", "count"),
        readmit_rate=("readmitted_30d", "mean"),
        avg_stay=("time_in_hospital", "mean")
    ).reset_index()

    elapsed = time.perf_counter() - start
    return round(elapsed, 3), len(pdf)


def benchmark_pyspark(spark, file_path: str):
    from pyspark.sql import functions as F
    from pyspark.sql.window import Window

    start = time.perf_counter()
    # 1. Ingest
    sdf = spark.read.option("header", "true").option("inferSchema", "true").csv(file_path)

    # 2. Clean
    for col_name, dtype in sdf.dtypes:
        if dtype == "string":
            sdf = sdf.withColumn(
                col_name,
                F.when(F.col(col_name) == "?", F.lit(None)).otherwise(F.col(col_name))
            )
    sdf = sdf.drop("weight", "payer_code", "medical_specialty")
    expired_ids = [11, 13, 14, 19, 20, 21]
    sdf = sdf.filter(~F.col("discharge_disposition_id").isin(expired_ids))

    window_spec = Window.partitionBy("patient_nbr").orderBy("encounter_id")
    sdf = sdf.withColumn("rn", F.row_number().over(window_spec)).filter(F.col("rn") == 1).drop("rn")

    # 3. Aggregate
    sdf = sdf.withColumn("readmitted_30d", F.when(F.col("readmitted") == "<30", 1).otherwise(0))
    agg = sdf.groupBy("age", "race").agg(
        F.count("encounter_id").alias("total_count"),
        F.avg("readmitted_30d").alias("readmit_rate"),
        F.avg("time_in_hospital").alias("avg_stay")
    ).collect()

    elapsed = time.perf_counter() - start
    return round(elapsed, 3), sdf.count()


def run_benchmarks(spark=None, row_scales=[100000, 500000, 1000000]):
    if spark is None:
        spark = get_spark_session("MediPulse-Benchmark")

    results = []
    logger.info("Starting Scalability Benchmark: Pandas vs PySpark...")

    for rows in row_scales:
        logger.info(f"--- Evaluating {rows:,} Rows Scale ---")
        if rows <= 101766:
            target_csv = CSV_PATH
        else:
            target_csv = os.path.join(DATA_DIR, f"benchmark_{rows//1000}k.csv")
            if not os.path.exists(target_csv):
                logger.info(f"Generating synthetic scaled file for {rows:,} rows...")
                generate_scaled_dataset(rows, target_csv)

        logger.info(f"Running Pandas on {rows:,} rows...")
        pandas_time, p_clean_rows = benchmark_pandas(target_csv)
        logger.info(f"Pandas completed in {pandas_time:.2f}s (processed {p_clean_rows:,} rows)")

        logger.info(f"Running PySpark on {rows:,} rows...")
        pyspark_time, s_clean_rows = benchmark_pyspark(spark, target_csv)
        logger.info(f"PySpark completed in {pyspark_time:.2f}s (processed {s_clean_rows:,} rows)")

        speedup = round(pandas_time / pyspark_time if pyspark_time > 0 else 1.0, 2)
        results.append({
            "rows": rows,
            "rows_label": f"{rows // 1000}K" if rows < 1000000 else f"{rows // 1000000}M",
            "pandas_seconds": pandas_time,
            "pyspark_seconds": pyspark_time,
            "pyspark_speedup_factor": speedup,
            "pandas_throughput_rows_per_sec": round(rows / pandas_time, 1),
            "pyspark_throughput_rows_per_sec": round(rows / pyspark_time, 1)
        })

    # Save CSV and JSON
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    csv_file = os.path.join(ARTIFACTS_DIR, "benchmark_results.csv")
    json_file = os.path.join(ARTIFACTS_DIR, "benchmark_summary.json")

    b_df = pd.DataFrame(results)
    b_df.to_csv(csv_file, index=False)
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Saved benchmark results to {csv_file} and {json_file}")

    # Generate visual chart
    create_benchmark_chart(results)
    return results


def create_benchmark_chart(results):
    chart_path = os.path.join(ARTIFACTS_DIR, "benchmark_comparison.png")
    labels = [r["rows_label"] for r in results]
    pandas_times = [r["pandas_seconds"] for r in results]
    pyspark_times = [r["pyspark_seconds"] for r in results]

    x = np.arange(len(labels))
    width = 0.35

    plt.figure(figsize=(9, 5.5), dpi=300)
    plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

    fig, ax = plt.subplots(figsize=(8.5, 5))
    rects1 = ax.bar(x - width/2, pandas_times, width, label="Pandas (Single-thread in-memory)", color="#f97316")
    rects2 = ax.bar(x + width/2, pyspark_times, width, label="PySpark (Local Cluster Distributed)", color="#0284c7")

    ax.set_ylabel("Execution Time (Seconds, lower is better)", fontsize=11, fontweight="bold")
    ax.set_xlabel("Dataset Scale (Encounters)", fontsize=11, fontweight="bold")
    ax.set_title("MediPulse Scalability Benchmark: Pandas vs. PySpark", fontsize=13, fontweight="bold", pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels([f"{l} Rows" for l in labels], fontsize=10)
    ax.legend(frameon=True, facecolor="white", edgecolor="#cbd5e1")

    # Add text labels on bars
    for rect in rects1:
        height = rect.get_height()
        ax.annotate(f"{height:.2f}s",
                    xy=(rect.get_x() + rect.get_width() / 2, height),
                    xytext=(0, 3), textcoords="offset points",
                    ha="center", va="bottom", fontsize=9, fontweight="bold")

    for rect in rects2:
        height = rect.get_height()
        ax.annotate(f"{height:.2f}s",
                    xy=(rect.get_x() + rect.get_width() / 2, height),
                    xytext=(0, 3), textcoords="offset points",
                    ha="center", va="bottom", fontsize=9, fontweight="bold")

    plt.tight_layout()
    plt.savefig(chart_path)
    plt.close()
    logger.info(f"Generated benchmark plot at {chart_path}")


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-Benchmark")
    try:
        run_benchmarks(spark)
    finally:
        spark.stop()
