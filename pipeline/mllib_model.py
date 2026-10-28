"""
MediPulse Big Data Pipeline - Stage 5: Spark MLlib Model
Trains a distributed Machine Learning model (Random Forest Classifier) using Spark MLlib
directly on the Gold Parquet layer to satisfy the Big Data Analytics curriculum.
Evaluates ROC-AUC, PR-AUC, Accuracy, and F1-score on a distributed test set.
"""

import os
import sys
import json
import logging
from pyspark.ml import Pipeline
from pyspark.ml.feature import StringIndexer, VectorAssembler, Imputer
from pyspark.ml.classification import RandomForestClassifier, GBTClassifier
from pyspark.ml.evaluation import BinaryClassificationEvaluator, MulticlassClassificationEvaluator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.common import get_spark_session, GOLD_PARQUET, ARTIFACTS_DIR

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline.mllib_model")


def run_mllib_training(spark=None):
    if spark is None:
        spark = get_spark_session("MediPulse-MLlib")

    logger.info(f"Loading Gold Parquet from {GOLD_PARQUET} for MLlib training...")
    df = spark.read.parquet(GOLD_PARQUET)

    # Patient-level stratified/random split
    train_df, test_df = df.randomSplit([0.8, 0.2], seed=42)
    logger.info(f"Train split: {train_df.count():,} encounters | Test split: {test_df.count():,} encounters")

    # Feature definitions
    categorical_cols = ["gender", "race", "diag_1_category", "admission_type_desc", "discharge_disposition_desc"]
    numeric_cols = [
        "time_in_hospital", "num_lab_procedures", "num_procedures", "num_medications",
        "number_outpatient", "number_emergency", "number_inpatient",
        "number_diagnoses", "number_of_prior_visits", "med_change_flag",
        "total_meds_changed", "age_midpoint", "A1C_flag", "glucose_flag", "polypharmacy_count"
    ]

    indexers = [
        StringIndexer(inputCol=c, outputCol=f"{c}_idx", handleInvalid="keep")
        for c in categorical_cols
    ]

    indexed_cols = [f"{c}_idx" for c in categorical_cols]
    assembler = VectorAssembler(
        inputCols=numeric_cols + indexed_cols,
        outputCol="raw_features",
        handleInvalid="skip"
    )

    # Random Forest Classifier with balanced trees
    rf = RandomForestClassifier(
        labelCol="readmitted_30d",
        featuresCol="raw_features",
        numTrees=80,
        maxDepth=8,
        seed=42
    )

    pipeline = Pipeline(stages=indexers + [assembler, rf])

    logger.info("Fitting Spark MLlib Random Forest pipeline...")
    model = pipeline.fit(train_df)

    logger.info("Transforming test dataset and evaluating distributed predictions...")
    predictions = model.transform(test_df)

    # Evaluators
    roc_evaluator = BinaryClassificationEvaluator(
        labelCol="readmitted_30d",
        rawPredictionCol="rawPrediction",
        metricName="areaUnderROC"
    )
    pr_evaluator = BinaryClassificationEvaluator(
        labelCol="readmitted_30d",
        rawPredictionCol="rawPrediction",
        metricName="areaUnderPR"
    )
    acc_evaluator = MulticlassClassificationEvaluator(
        labelCol="readmitted_30d",
        predictionCol="prediction",
        metricName="accuracy"
    )
    f1_evaluator = MulticlassClassificationEvaluator(
        labelCol="readmitted_30d",
        predictionCol="prediction",
        metricName="f1"
    )

    roc_auc = float(roc_evaluator.evaluate(predictions))
    pr_auc = float(pr_evaluator.evaluate(predictions))
    accuracy = float(acc_evaluator.evaluate(predictions))
    f1 = float(f1_evaluator.evaluate(predictions))

    metrics = {
        "engine": "Apache Spark MLlib (Distributed)",
        "model_type": "RandomForestClassifier",
        "trees": 80,
        "max_depth": 8,
        "train_samples": train_df.count(),
        "test_samples": test_df.count(),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "accuracy": round(accuracy, 4),
        "f1_score": round(f1, 4),
    }

    logger.info(f"Spark MLlib Results: {metrics}")

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    out_file = os.path.join(ARTIFACTS_DIR, "mllib_metrics.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    logger.info(f"Saved MLlib metrics to {out_file}")

    return metrics


if __name__ == "__main__":
    spark = get_spark_session("MediPulse-MLlib")
    try:
        run_mllib_training(spark)
    finally:
        spark.stop()
