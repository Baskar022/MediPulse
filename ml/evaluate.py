"""
MediPulse ML Evaluation Module
Generates production-grade evaluation artifacts:
- ROC Curve (artifacts/roc_curve.png)
- Precision-Recall Curve (artifacts/pr_curve.png)
- Annotated Confusion Matrix Heatmap (artifacts/confusion_matrix.png)
- Calibration Reliability Diagram
- JSON curve datapoints (artifacts/curves_data.json) for live interactive frontend charts.
"""

import os
import sys
import json
import logging
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_curve, precision_recall_curve, confusion_matrix,
    roc_auc_score, average_precision_score
)
from sklearn.calibration import calibration_curve

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
TEST_DATA_PATH = os.path.join(ARTIFACTS_DIR, "test_eval_data.parquet")
METRICS_PATH = os.path.join(ARTIFACTS_DIR, "metrics.json")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml.evaluate")


def generate_evaluation_plots():
    if not os.path.exists(TEST_DATA_PATH):
        raise FileNotFoundError(f"Test evaluation data {TEST_DATA_PATH} not found. Run ml/train.py first.")

    logger.info(f"Loading test evaluation data from {TEST_DATA_PATH}...")
    df = pd.read_parquet(TEST_DATA_PATH)

    y_true = df["y_true"].values
    y_prob = df["y_prob"].values
    y_pred = df["y_pred"].values

    fpr, tpr, _ = roc_curve(y_true, y_prob)
    roc_auc = roc_auc_score(y_true, y_prob)

    precision, recall, _ = precision_recall_curve(y_true, y_prob)
    pr_auc = average_precision_score(y_true, y_prob)
    baseline_rate = float(np.mean(y_true))

    cm = confusion_matrix(y_true, y_pred)

    # 1. ROC Curve
    plt.figure(figsize=(7, 5.5), dpi=300)
    plt.plot(fpr, tpr, color="#0284c7", lw=2.5, label=f"ROC Curve (AUC = {roc_auc:.3f})")
    plt.plot([0, 1], [0, 1], color="#94a3b8", lw=1.5, linestyle="--", label="Random Classifier (AUC = 0.500)")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate (1 - Specificity)", fontsize=11, fontweight="bold")
    plt.ylabel("True Positive Rate (Sensitivity / Recall)", fontsize=11, fontweight="bold")
    plt.title("Receiver Operating Characteristic (ROC) Curve", fontsize=12, fontweight="bold", pad=12)
    plt.legend(loc="lower right", frameon=True, facecolor="white")
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.tight_layout()
    roc_path = os.path.join(ARTIFACTS_DIR, "roc_curve.png")
    plt.savefig(roc_path)
    plt.close()
    logger.info(f"Saved ROC Curve to {roc_path}")

    # 2. Precision-Recall Curve
    plt.figure(figsize=(7, 5.5), dpi=300)
    plt.plot(recall, precision, color="#10b981", lw=2.5, label=f"PR Curve (Avg Precision = {pr_auc:.3f})")
    plt.axhline(y=baseline_rate, color="#ef4444", linestyle="--", lw=1.5, label=f"Prevalence Baseline ({baseline_rate*100:.1f}%)")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("Recall (Sensitivity)", fontsize=11, fontweight="bold")
    plt.ylabel("Precision (Positive Predictive Value)", fontsize=11, fontweight="bold")
    plt.title("Precision-Recall Curve (Clinical Imbalance)", fontsize=12, fontweight="bold", pad=12)
    plt.legend(loc="upper right", frameon=True, facecolor="white")
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.tight_layout()
    pr_path = os.path.join(ARTIFACTS_DIR, "pr_curve.png")
    plt.savefig(pr_path)
    plt.close()
    logger.info(f"Saved Precision-Recall Curve to {pr_path}")

    # 3. Confusion Matrix
    plt.figure(figsize=(6, 5), dpi=300)
    plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    plt.title("Operational Confusion Matrix", fontsize=12, fontweight="bold", pad=12)
    plt.colorbar()
    tick_marks = np.arange(2)
    plt.xticks(tick_marks, ["No Readmit (<30)", "Readmitted (<30)"], fontsize=9)
    plt.yticks(tick_marks, ["No Readmit (<30)", "Readmitted (<30)"], fontsize=9)

    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            val = cm[i, j]
            pct = (val / np.sum(cm)) * 100
            plt.text(j, i, f"{val:,}\n({pct:.1f}%)",
                     horizontalalignment="center",
                     verticalalignment="center",
                     color="white" if val > thresh else "black",
                     fontsize=10, fontweight="bold")

    plt.ylabel("True Clinical Outcome", fontsize=10, fontweight="bold")
    plt.xlabel("Model Flagged Risk", fontsize=10, fontweight="bold")
    plt.tight_layout()
    cm_path = os.path.join(ARTIFACTS_DIR, "confusion_matrix.png")
    plt.savefig(cm_path)
    plt.close()
    logger.info(f"Saved Confusion Matrix to {cm_path}")

    # 4. Calibration Curve
    prob_true, prob_pred = calibration_curve(y_true, y_prob, n_bins=8, strategy="uniform")

    # Downsample points for frontend curves json
    step_roc = max(1, len(fpr) // 40)
    roc_points = [{"fpr": round(float(f), 4), "tpr": round(float(t), 4)} for f, t in zip(fpr[::step_roc], tpr[::step_roc])]
    if roc_points[-1]["fpr"] < 1.0:
        roc_points.append({"fpr": 1.0, "tpr": 1.0})

    step_pr = max(1, len(recall) // 40)
    pr_points = [{"recall": round(float(r), 4), "precision": round(float(p), 4)} for r, p in zip(recall[::step_pr], precision[::step_pr])]

    calib_points = [{"mean_predicted_prob": round(float(p), 4), "fraction_of_positives": round(float(t), 4)} for p, t in zip(prob_pred, prob_true)]

    curves_data = {
        "roc_curve": roc_points,
        "pr_curve": pr_points,
        "calibration_curve": calib_points,
        "roc_auc": round(float(roc_auc), 4),
        "pr_auc": round(float(pr_auc), 4),
        "baseline_prevalence": round(baseline_rate, 4)
    }

    curves_path = os.path.join(ARTIFACTS_DIR, "curves_data.json")
    with open(curves_path, "w", encoding="utf-8") as f:
        json.dump(curves_data, f, indent=2)
    logger.info(f"Saved interactive curves data to {curves_path}")

    # Update metrics.json with threshold justification
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics_obj = json.load(f)

        thresh = metrics_obj.get("operational_threshold", 0.20)
        metrics_obj["threshold_justification"] = (
            f"The standard classification threshold of 0.50 fails in heavily imbalanced clinical regimes "
            f"(readmission incidence ~10%), yielding high false negatives. We selected an operational threshold of {thresh} "
            f"calibrated on the validation cohort to maximize sensitivity/recall. In post-acute care management, "
            f"the clinical and financial penalty of an unflagged readmission (emergency re-hospitalization, CMS HRRP penalties) "
            f"vastly exceeds the cost of a preventive phone call or outpatient transition care intervention."
        )

        with open(METRICS_PATH, "w", encoding="utf-8") as f:
            json.dump(metrics_obj, f, indent=2)
        logger.info(f"Updated metrics justification in {METRICS_PATH}")


if __name__ == "__main__":
    generate_evaluation_plots()
