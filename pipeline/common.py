"""
MediPulse Common Spark Session and Path Utilities
Configures PySpark in local mode with Windows optimizations and memory allocations,
with seamless fallback when running in lightweight cloud containers without JVM.
"""

import os
import sys
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HADOOP_DIR = os.path.join(BASE_DIR, "hadoop")
if os.path.exists(HADOOP_DIR):
    os.environ["HADOOP_HOME"] = HADOOP_DIR
    os.environ["PATH"] = os.path.join(HADOOP_DIR, "bin") + os.pathsep + os.environ.get("PATH", "")

DATA_DIR = os.path.join(BASE_DIR, "data")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

BRONZE_PARQUET = os.path.join(DATA_DIR, "bronze", "encounters.parquet")
SILVER_PARQUET = os.path.join(DATA_DIR, "silver", "encounters.parquet")
GOLD_PARQUET = os.path.join(DATA_DIR, "gold", "encounters.parquet")
CSV_PATH = os.path.join(DATA_DIR, "diabetic_data.csv")
MAPPING_PATH = os.path.join(DATA_DIR, "IDs_mapping.csv")


def has_spark_support() -> bool:
    """Checks if PySpark and a valid Java runtime exist in environment."""
    try:
        import pyspark  # noqa
        # Verify Java exists on PATH or JAVA_HOME
        if shutil.which("java") or os.environ.get("JAVA_HOME"):
            return True
        return False
    except Exception:
        return False


def get_spark_session(app_name: str = "MediPulseBigDataPipeline"):
    """
    Creates or retrieves a SparkSession optimized for local execution.
    Returns None if PySpark or Java is not present in the runtime.
    """
    if not has_spark_support():
        return None

    try:
        from pyspark.sql import SparkSession
        builder = (
            SparkSession.builder.appName(app_name)
            .master("local[*]")
            .config("spark.driver.memory", "2g")
            .config("spark.executor.memory", "2g")
            .config("spark.sql.shuffle.partitions", "4")
            .config("spark.sql.execution.arrow.pyspark.enabled", "true")
            .config("spark.hadoop.fs.file.impl", "org.apache.hadoop.fs.LocalFileSystem")
            .config("spark.ui.enabled", "false")
        )

        spark = builder.getOrCreate()
        spark.sparkContext.setLogLevel("WARN")
        return spark
    except Exception:
        return None
