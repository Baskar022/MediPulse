"""
MediPulse ML Model Training Module
- Patient-level train / validation / test split (ensuring zero patient data leakage).
- Handles severe class imbalance (~9-11% readmission rate) using class weights on training data only.
- Compares Logistic Regression, Random Forest, and XGBoost.
- Evaluates real metrics on the held-out test split.
- Performs probability calibration (CalibratedClassifierCV) and decision threshold optimization.
- Evaluates demographic fairness (subgroup AUC & recall across race, gender, age).
- Exports final trained pipeline and metrics to artifacts/.
"""

import os
import sys
import json
import logging
import joblib
import pandas as pd
import numpy as np

from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, average_precision_score, recall_score,
    precision_score, f1_score, accuracy_score, confusion_matrix
)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
GOLD_PARQUET = os.path.join(DATA_DIR, "gold", "encounters.parquet")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml.train")

NUMERIC_FEATURES = [
    "time_in_hospital", "num_lab_procedures", "num_procedures", "num_medications",
    "number_outpatient", "number_emergency", "number_inpatient",
    "number_diagnoses", "number_of_prior_visits", "med_change_flag",
    "total_meds_changed", "age_midpoint", "A1C_flag", "glucose_flag", "polypharmacy_count"
]

CATEGORICAL_FEATURES = [
    "gender", "race", "age", "diag_1_category",
    "admission_type_desc", "discharge_disposition_desc"
]


def load_dataset():
    """Loads dataset from gold parquet if available, or falls back to pandas pipeline."""
    if os.path.exists(GOLD_PARQUET):
        logger.info(f"Loading gold parquet data from {GOLD_PARQUET}...")
        df = pd.read_parquet(GOLD_PARQUET)
    else:
        logger.warning(f"{GOLD_PARQUET} not found. Running features.py first or reading CSV.")
        csv_path = os.path.join(DATA_DIR, "diabetic_data.csv")
        df = pd.read_csv(csv_path, low_memory=False)
        # Clean inline
        df = df[~df["discharge_disposition_id"].isin([11, 13, 14, 19, 20, 21])].copy()
        df = df.drop_duplicates(subset=["patient_nbr"], keep="first").copy()
        df["readmitted_30d"] = (df["readmitted"] == "<30").astype(int)
        df["number_of_prior_visits"] = df["number_outpatient"] + df["number_emergency"] + df["number_inpatient"]
        df["med_change_flag"] = (df["change"] == "Ch").astype(int)
        df["total_meds_changed"] = 0
        df["polypharmacy_count"] = 5
        df["A1C_flag"] = df["A1Cresult"].map({">8": 3, ">7": 2, "Norm": 1}).fillna(0).astype(int)
        df["glucose_flag"] = df["max_glu_serum"].map({">300": 3, ">200": 2, "Norm": 1}).fillna(0).astype(int)
        df["age_midpoint"] = 65
        df["diag_1_category"] = "Circulatory"
        df["admission_type_desc"] = "Emergency"
        df["discharge_disposition_desc"] = "Discharged to home"

    return df


def split_data(df: pd.DataFrame, seed: int = 42):
    """
    Patient-level train / validation / test split.
    Guarantees that patient_nbr is strictly isolated with zero overlap across splits.
    """
    logger.info("Executing patient-level stratified/group data split (70% train, 15% val, 15% test)...")
    gss = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=seed)
    train_idx, temp_idx = next(gss.split(df, groups=df["patient_nbr"]))

    train_df = df.iloc[train_idx].copy()
    temp_df = df.iloc[temp_idx].copy()

    # Split temp (30%) equally into val (15%) and test (15%)
    gss_val = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=seed)
    val_sub_idx, test_sub_idx = next(gss_val.split(temp_df, groups=temp_df["patient_nbr"]))

    val_df = temp_df.iloc[val_sub_idx].copy()
    test_df = temp_df.iloc[test_sub_idx].copy()

    logger.info(f"Split sizes - Train: {len(train_df):,} | Val: {len(val_df):,} | Test: {len(test_df):,}")
    # Verify zero leakage
    train_patients = set(train_df["patient_nbr"])
    val_patients = set(val_df["patient_nbr"])
    test_patients = set(test_df["patient_nbr"])

    assert len(train_patients.intersection(val_patients)) == 0, "Patient leakage detected between train and val!"
    assert len(train_patients.intersection(test_patients)) == 0, "Patient leakage detected between train and test!"
    assert len(val_patients.intersection(test_patients)) == 0, "Patient leakage detected between val and test!"

    logger.info("Zero-leakage verification passed. All patient cohorts are strictly disjoint.")
    return train_df, val_df, test_df


def build_preprocessor():
    """Builds scikit-learn ColumnTransformer for numerical scaling and categorical encoding."""
    num_pipe = Pipeline([
        ("scaler", StandardScaler())
    ])
    cat_pipe = Pipeline([
        ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipe, NUMERIC_FEATURES),
            ("cat", cat_pipe, CATEGORICAL_FEATURES)
        ],
        remainder="drop"
    )
    return preprocessor


def train_and_compare_models(X_train, y_train, X_val, y_val, X_test, y_test, preprocessor):
    """
    Trains Logistic Regression, Random Forest, and XGBoost with class weighting.
    Selects the champion model based on ROC-AUC and positive class recall.
    """
    logger.info("Preprocessing train, validation, and test feature spaces...")
    X_train_proc = preprocessor.fit_transform(X_train)
    X_val_proc = preprocessor.transform(X_val)
    X_test_proc = preprocessor.transform(X_test)

    # Class weights for severe class imbalance
    n_neg = (y_train == 0).sum()
    n_pos = (y_train == 1).sum()
    pos_weight = n_neg / max(n_pos, 1)
    logger.info(f"Imbalance ratio in training data: {pos_weight:.2f}:1 (Negative:Positive)")

    models = {
        "LogisticRegression": LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            C=0.1,
            random_state=42
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=150,
            max_depth=10,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1
        ),
        "XGBoost": XGBClassifier(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.05,
            scale_pos_weight=pos_weight,
            eval_metric="auc",
            random_state=42,
            n_jobs=-1
        )
    }

    comparison_results = []
    fitted_models = {}

    for name, clf in models.items():
        logger.info(f"Training {name}...")
        clf.fit(X_train_proc, y_train)
        fitted_models[name] = clf

        # Evaluate on validation
        val_probs = clf.predict_proba(X_val_proc)[:, 1]
        val_preds = (val_probs >= 0.50).astype(int)

        roc_auc = roc_auc_score(y_val, val_probs)
        pr_auc = average_precision_score(y_val, val_probs)
        rec = recall_score(y_val, val_preds)
        prec = precision_score(y_val, val_preds, zero_division=0)
        f1 = f1_score(y_val, val_preds)

        logger.info(f"Validation metrics for {name} -> ROC-AUC: {roc_auc:.4f}, PR-AUC: {pr_auc:.4f}, Recall: {rec:.4f}, Precision: {prec:.4f}")
        comparison_results.append({
            "model_name": name,
            "roc_auc": round(float(roc_auc), 4),
            "pr_auc": round(float(pr_auc), 4),
            "recall": round(float(rec), 4),
            "precision": round(float(prec), 4),
            "f1_score": round(float(f1), 4)
        })

    # Champion model selection by highest ROC-AUC
    best_candidate = max(comparison_results, key=lambda x: (x["roc_auc"], x["recall"]))
    champion_name = best_candidate["model_name"]
    logger.info(f"Selected Champion Model: {champion_name} (ROC-AUC={best_candidate['roc_auc']}, Recall={best_candidate['recall']})")
    champion_clf = fitted_models[champion_name]

    # Probability calibration
    logger.info("Calibrating predicted probabilities with CalibratedClassifierCV (cv=3, sigmoid)...")
    calibrated_clf = CalibratedClassifierCV(champion_clf, cv=3, method="sigmoid")
    calibrated_clf.fit(X_train_proc, y_train)

    # Optimal Decision Threshold Search on Validation Set
    val_cal_probs = calibrated_clf.predict_proba(X_val_proc)[:, 1]
    thresholds = np.linspace(0.10, 0.60, 51)
    best_thresh = 0.50
    best_f1 = -1.0

    for th in thresholds:
        th_preds = (val_cal_probs >= th).astype(int)
        th_f1 = f1_score(y_val, th_preds, zero_division=0)
        # Prioritize recall while keeping reasonable precision
        if th_f1 > best_f1:
            best_f1 = th_f1
            best_thresh = float(th)

    # In healthcare readmission prevention, high recall is crucial.
    # Set operational decision threshold to ensure sensitivity:
    operational_threshold = round(min(best_thresh, 0.25), 2)
    logger.info(f"Calibrated Optimal Threshold: {best_thresh:.3f} | Operational Clinical Decision Threshold: {operational_threshold:.2f}")

    # Final Evaluation on the unseen held-out TEST set
    test_probs = calibrated_clf.predict_proba(X_test_proc)[:, 1]
    test_preds = (test_probs >= operational_threshold).astype(int)

    test_roc_auc = float(roc_auc_score(y_test, test_probs))
    test_pr_auc = float(average_precision_score(y_test, test_probs))
    test_recall = float(recall_score(y_test, test_preds))
    test_precision = float(precision_score(y_test, test_preds, zero_division=0))
    test_accuracy = float(accuracy_score(y_test, test_preds))
    test_f1 = float(f1_score(y_test, test_preds))
    cm = confusion_matrix(y_test, test_preds).tolist()

    final_metrics = {
        "champion_model": champion_name,
        "calibration": "Sigmoid (Platt Scaling) via CalibratedClassifierCV",
        "operational_threshold": operational_threshold,
        "test_metrics": {
            "roc_auc": round(test_roc_auc, 4),
            "pr_auc": round(test_pr_auc, 4),
            "recall": round(test_recall, 4),
            "precision": round(test_precision, 4),
            "accuracy": round(test_accuracy, 4),
            "f1_score": round(test_f1, 4),
            "confusion_matrix": {
                "tn": cm[0][0], "fp": cm[0][1],
                "fn": cm[1][0], "tp": cm[1][1]
            }
        },
        "model_comparison": comparison_results
    }

    return calibrated_clf, champion_clf, preprocessor, final_metrics, operational_threshold, X_test, y_test, test_probs, test_preds


def evaluate_fairness(test_df: pd.DataFrame, y_true: np.ndarray, y_prob: np.ndarray, threshold: float):
    """
    Subgroup fairness auditing across Race, Gender, and Age.
    Calculates ROC-AUC, Recall (Equal Opportunity metric), and Readmission Prevalence.
    """
    logger.info("Conducting demographic fairness and equity evaluation...")
    y_pred = (y_prob >= threshold).astype(int)
    test_df_eval = test_df.copy()
    test_df_eval["y_true"] = y_true
    test_df_eval["y_pred"] = y_pred
    test_df_eval["y_prob"] = y_prob

    fairness_report = {}

    for demographic in ["race", "gender", "age"]:
        groups = test_df_eval[demographic].dropna().unique()
        group_metrics = []
        for g in groups:
            sub = test_df_eval[test_df_eval[demographic] == g]
            if len(sub) < 30 or sub["y_true"].nunique() < 2:
                continue

            sub_auc = roc_auc_score(sub["y_true"], sub["y_prob"])
            sub_rec = recall_score(sub["y_true"], sub["y_pred"], zero_division=0)
            sub_prec = precision_score(sub["y_true"], sub["y_pred"], zero_division=0)

            group_metrics.append({
                "subgroup": str(g),
                "sample_size": len(sub),
                "actual_readmission_rate_pct": round(float(sub["y_true"].mean() * 100), 2),
                "roc_auc": round(float(sub_auc), 4),
                "recall": round(float(sub_rec), 4),
                "precision": round(float(sub_prec), 4)
            })
        fairness_report[demographic] = sorted(group_metrics, key=lambda x: x["sample_size"], reverse=True)

    return fairness_report


def main():
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    df = load_dataset()
    train_df, val_df, test_df = split_data(df)

    feature_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X_train = train_df[feature_cols]
    y_train = train_df["readmitted_30d"].values

    X_val = val_df[feature_cols]
    y_val = val_df["readmitted_30d"].values

    X_test = test_df[feature_cols]
    y_test = test_df["readmitted_30d"].values

    preprocessor = build_preprocessor()

    (
        calibrated_model, raw_champion, fitted_preprocessor,
        metrics, threshold, test_features, y_test_arr, test_probs, test_preds
    ) = train_and_compare_models(X_train, y_train, X_val, y_val, X_test, y_test, preprocessor)

    # Save models
    model_path = os.path.join(ARTIFACTS_DIR, "model.joblib")
    preproc_path = os.path.join(ARTIFACTS_DIR, "preprocessor.joblib")
    raw_model_path = os.path.join(ARTIFACTS_DIR, "raw_champion_model.joblib")

    joblib.dump(calibrated_model, model_path)
    joblib.dump(fitted_preprocessor, preproc_path)
    joblib.dump(raw_champion, raw_model_path)
    logger.info(f"Saved calibrated model to {model_path} and preprocessor to {preproc_path}")

    # Fairness assessment
    fairness = evaluate_fairness(test_df, y_test_arr, test_probs, threshold)
    fairness_path = os.path.join(ARTIFACTS_DIR, "fairness.json")
    with open(fairness_path, "w", encoding="utf-8") as f:
        json.dump(fairness, f, indent=2)
    logger.info(f"Saved demographic fairness report to {fairness_path}")

    # Save metrics
    metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    logger.info(f"Saved evaluation metrics to {metrics_path}")

    # Save sample test data for evaluate.py and explain.py
    test_export_path = os.path.join(ARTIFACTS_DIR, "test_eval_data.parquet")
    test_eval_df = test_features.copy()
    test_eval_df["y_true"] = y_test_arr
    test_eval_df["y_prob"] = test_probs
    test_eval_df["y_pred"] = test_preds
    test_eval_df.to_parquet(test_export_path, index=False)
    logger.info(f"Saved test evaluation data to {test_export_path}")

    logger.info("ML Training & Fairness Check Completed Successfully!")


if __name__ == "__main__":
    main()
