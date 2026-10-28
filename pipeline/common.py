"""
MediPulse Common Spark Session and Path Utilities
Configures PySpark in local mode with Windows optimizations and memory allocations.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HADOOP_DIR = os.path.join(BASE_DIR, "hadoop")
os.environ["HADOOP_HOME"] = HADOOP_DIR
os.environ["PATH"] = os.path.join(HADOOP_DIR, "bin") + os.pathsep + os.environ.get("PATH", "")

from pyspark.sql import SparkSession

DATA_DIR = os.path.join(BASE_DIR, "data")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

BRONZE_PARQUET = os.path.join(DATA_DIR, "bronze", "encounters.parquet")
SILVER_PARQUET = os.path.join(DATA_DIR, "silver", "encounters.parquet")
GOLD_PARQUET = os.path.join(DATA_DIR, "gold", "encounters.parquet")
CSV_PATH = os.path.join(DATA_DIR, "diabetic_data.csv")
MAPPING_PATH = os.path.join(DATA_DIR, "IDs_mapping.csv")


def get_spark_session(app_name: str = "MediPulseBigDataPipeline") -> SparkSession:
    """
    Creates or retrieves a SparkSession optimized for local Windows execution.
    Configures driver memory, legacy time parser, and parquet optimizations.
    """
    builder = (
        SparkSession.builder.appName(app_name)
        .master("local[*]")
        .config("spark.driver.memory", "4g")
        .config("spark.executor.memory", "4g")
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.sql.execution.arrow.pyspark.enabled", "true")
        .config("spark.hadoop.fs.file.impl", "org.apache.hadoop.fs.LocalFileSystem")
        .config("spark.ui.enabled", "false")
    )

    spark = builder.getOrCreate()
    spark.sparkContext.setLogLevel("WARN")
    return spark
