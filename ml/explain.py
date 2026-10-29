"""
MediPulse Explainability Module (SHAP)
Provides local and global clinical interpretability:
- Computes global SHAP values and exports summary plot (artifacts/shap_summary.png).
- Exports global importance rankings (artifacts/shap_importance.json).
- Implements explain_single_patient(patient_dict) returning the top 5 risk contributors
  and targeted clinical recommendations for the FastAPI backend and React frontend.
"""

import os
import sys
import json
import logging
import joblib
import pandas as pd
import numpy as np
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:
    matplotlib = None
    plt = None
import shap

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "model.joblib")
RAW_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "raw_champion_model.joblib")
PREPROC_PATH = os.path.join(ARTIFACTS_DIR, "preprocessor.joblib")
TEST_DATA_PATH = os.path.join(ARTIFACTS_DIR, "test_eval_data.parquet")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml.explain")

_EXPLAINER = None
_FEATURE_NAMES = None
_MODEL = None
_PREPROCESSOR = None


def get_feature_names(preprocessor):
    """Extracts transformed feature names from ColumnTransformer."""
    feature_names = []
    for name, trans, cols in preprocessor.transformers_:
        if name == "num":
            feature_names.extend(cols)
        elif name == "cat":
            ohe = trans.named_steps["ohe"]
            cat_names = ohe.get_feature_names_out(cols).tolist()
            feature_names.extend(cat_names)
    return feature_names


def load_artifacts():
    global _MODEL, _PREPROCESSOR, _EXPLAINER, _FEATURE_NAMES

    if _MODEL is None:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(PREPROC_PATH):
            raise FileNotFoundError("Model or Preprocessor artifact missing. Run ml/train.py first.")
        _MODEL = joblib.load(MODEL_PATH)
        _PREPROCESSOR = joblib.load(PREPROC_PATH)
        _FEATURE_NAMES = get_feature_names(_PREPROCESSOR)

        # For SHAP, use the raw tree model or base estimator
        if os.path.exists(RAW_MODEL_PATH):
            raw_clf = joblib.load(RAW_MODEL_PATH)
        else:
            # CalibratedClassifierCV
            raw_clf = getattr(_MODEL, "calibrated_classifiers_", [None])[0].estimator

        try:
            _EXPLAINER = shap.TreeExplainer(raw_clf)
        except Exception:
            # Fallback for linear or generalized models
            logger.info("Using shap.LinearExplainer or generic Explainer...")
            _EXPLAINER = shap.Explainer(raw_clf)

    return _MODEL, _PREPROCESSOR, _EXPLAINER, _FEATURE_NAMES


def generate_global_shap_artifacts(sample_size: int = 500):
    """Computes global SHAP summary plot and feature rankings."""
    model, preproc, explainer, feature_names = load_artifacts()

    if not os.path.exists(TEST_DATA_PATH):
        logger.warning("Test data not found for SHAP evaluation.")
        return

    logger.info("Computing global SHAP values on background test cohort...")
    df = pd.read_parquet(TEST_DATA_PATH)
    sample_df = df.sample(min(sample_size, len(df)), random_state=42)

    X_proc = preproc.transform(sample_df)
    shap_values = explainer.shap_values(X_proc)

    # In binary classification, check shape
    if isinstance(shap_values, list):
        # Class 1 (readmission)
        shap_vals_class1 = shap_values[1]
    elif len(shap_values.shape) == 3:
        shap_vals_class1 = shap_values[:, :, 1]
    else:
        shap_vals_class1 = shap_values

    # Mean absolute SHAP per feature
    mean_abs = np.mean(np.abs(shap_vals_class1), axis=0)
    top_indices = np.argsort(mean_abs)[::-1][:15]

    top_features = [
        {
            "rank": int(i + 1),
            "feature": feature_names[idx],
            "importance": round(float(mean_abs[idx]), 4)
        }
        for i, idx in enumerate(top_indices)
    ]

    # Save JSON importance
    shap_json_path = os.path.join(ARTIFACTS_DIR, "shap_importance.json")
    with open(shap_json_path, "w", encoding="utf-8") as f:
        json.dump(top_features, f, indent=2)
    logger.info(f"Saved global SHAP importance to {shap_json_path}")

    # Plot summary bar chart
    plt.figure(figsize=(8, 6), dpi=300)
    plot_names = [feature_names[i] for i in reversed(top_indices)]
    plot_vals = [mean_abs[i] for i in reversed(top_indices)]

    y_pos = np.arange(len(plot_names))
    plt.barh(y_pos, plot_vals, color="#0284c7", align="center", edgecolor="#0369a1")
    plt.yticks(y_pos, plot_names, fontsize=9)
    plt.xlabel("Mean |SHAP Value| (Average Impact on Readmission Model Output)", fontsize=10, fontweight="bold")
    plt.title("Global Clinical Feature Importance (SHAP)", fontsize=12, fontweight="bold", pad=12)
    plt.tight_layout()

    summary_png_path = os.path.join(ARTIFACTS_DIR, "shap_summary.png")
    plt.savefig(summary_png_path)
    plt.close()
    logger.info(f"Saved SHAP summary plot to {summary_png_path}")


def explain_single_patient(patient_dict: dict):
    """
    Returns risk probability, risk level, top 5 SHAP factors, and recommendations
    for an individual patient encounter. Used directly by the FastAPI backend.
    """
    model, preproc, explainer, feature_names = load_artifacts()

    # Create 1-row DataFrame
    pdf = pd.DataFrame([patient_dict])

    # Preprocess
    X_proc = preproc.transform(pdf)
    prob = float(model.predict_proba(X_proc)[0, 1])

    # Compute SHAP values
    shap_vals = explainer.shap_values(X_proc)
    if isinstance(shap_vals, list):
        patient_shap = shap_vals[1][0]
    elif len(shap_vals.shape) == 3:
        patient_shap = shap_vals[0, :, 1]
    else:
        patient_shap = shap_vals[0]

    # Thresholds for risk categorization
    if prob < 0.20:
        risk_level = "Low"
    elif prob < 0.45:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # Identify top 5 absolute contributors
    abs_shap = np.abs(patient_shap)
    top_5_idx = np.argsort(abs_shap)[::-1][:5]

    top_factors = []
    for idx in top_5_idx:
        raw_name = feature_names[idx]
        val = patient_shap[idx]
        direction = "increases_risk" if val > 0 else "reduces_risk"

        # Friendly display label
        clean_name = (
            raw_name.replace("cat__", "")
            .replace("num__", "")
            .replace("_desc_", " ")
            .replace("_", " ")
            .title()
        )

        top_factors.append({
            "feature": clean_name,
            "raw_feature": raw_name,
            "impact": round(float(abs(val)), 4),
            "signed_impact": round(float(val), 4),
            "direction": direction,
            "description": f"{clean_name} {'elevates' if val > 0 else 'mitigates'} 30-day readmission likelihood."
        })

    # Plain language clinical recommendations
    recommendations = []
    if patient_dict.get("number_inpatient", 0) > 0 or patient_dict.get("number_of_prior_visits", 0) >= 2:
        recommendations.append("High Prior Acute Utilization: Schedule transitional care nurse home visit or phone call within 48 hours.")
    if patient_dict.get("A1C_flag", 0) >= 2 or patient_dict.get("A1Cresult") in [">8", ">7"]:
        recommendations.append("Elevated Glycated Hemoglobin (HbA1c): Arrange outpatient endocrinology follow-up and diabetes self-management education within 7-10 days.")
    if patient_dict.get("polypharmacy_count", 0) >= 5 or patient_dict.get("num_medications", 0) >= 15:
        recommendations.append("Polypharmacy Risk: Clinical pharmacist medication therapy management (MTM) reconciliation prior to discharge.")
    if patient_dict.get("time_in_hospital", 0) >= 6:
        recommendations.append("Prolonged Inpatient Stay: Assess for functional deconditioning; evaluate home health physical therapy readiness.")
    if not recommendations:
        recommendations.append("Standard Discharge Protocol: Schedule routine primary care clinic follow-up within 14-21 days with medication adherence review.")

    return {
        "risk_probability": round(prob, 4),
        "risk_percentage": round(prob * 100, 1),
        "risk_level": risk_level,
        "operational_threshold": 0.20,
        "top_factors": top_factors,
        "recommendations": recommendations
    }


if __name__ == "__main__":
    generate_global_shap_artifacts()
