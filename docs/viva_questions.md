# MediPulse: Top 30 Viva Examination Questions & Model Answers
### Comprehensive Preparation Guide for Artificial Intelligence & Machine Learning (AIML) in Healthcare

---

## Part 1: Clinical Problem Formulation, EHR Data & Leakage Prevention (Questions 1–6)

### Q1: What clinical problem does MediPulse address, and why is machine learning required?
**Answer:** MediPulse addresses the challenge of 30-day unplanned hospital readmissions in diabetic patients. Under the Hospital Readmissions Reduction Program (HRRP) established by Medicare (CMS), hospitals face reimbursement penalty cuts of up to 3% for excessive readmissions. Diabetic patients present high clinical complexity—co-morbidities (cardiovascular, renal), glycemic instability, and polypharmacy. Traditional static clinical risk scores (like LACE or HOSPITAL score) rely on linear scoring heuristics with poor predictive sensitivity (~0.55–0.60 AUC). Machine learning captures non-linear interactions across high-dimensional Electronic Health Records (EHR) to provide personalized, calibrated risk estimates with explainable clinical drivers.

### Q2: Why is the target variable defined strictly as 30-day readmission rather than any readmission?
**Answer:** In the raw dataset, the target column `readmitted` contains three values: `"<30"`, `">30"`, and `"NO"`. We engineered a binary target `readmitted_30d`:
- **Positive Class (1):** Readmitted within 30 days (`"<30"`) — **6,285 encounters (8.98%)**
- **Negative Class (0):** Readmitted after 30 days (`">30"`) or not readmitted (`"NO"`) — **63,705 encounters (91.02%)**

**Clinical Rationale:** Readmissions occurring *within 30 days* are medically considered acute transition failures—resulting from premature discharge, medication titration errors, infection, or lack of post-acute care coordination. Readmissions occurring *after 30 days* (>30) are clinically attributable to natural chronic disease progression rather than inpatient discharge quality. Combining `">30"` into the negative class aligns strictly with CMS regulatory definitions.

### Q3: Why did you exclude patients with discharge disposition IDs 11, 13, 14, 19, 20, and 21?
**Answer:** These discharge disposition codes represent patients who either **expired in the hospital** (deceased) or were discharged directly into **hospice care**. A deceased patient cannot mathematically or clinically experience an unplanned hospital readmission within 30 days. Keeping these 2,423 cases in the dataset would introduce severe survival bias and generate false negatives, artificially inflating specificity while degrading the model's true clinical validity.

### Q4: What is patient-level data leakage, and how did you prevent it?
**Answer:** In multi-year hospital archives, chronic diabetic patients often have multiple inpatient admissions. If encounters are partitioned using a standard random `train_test_split`, earlier admissions from Patient X could be placed in the training set while later admissions from the same Patient X end up in the test set. 
The algorithm would "memorize" Patient X's unique demographic, genetic, and biological signatures rather than learning generalizable risk factors. We prevented this in two ways:
1. **Pipeline Deduplication:** Used PySpark Window functions partitioned by `patient_nbr` and ordered chronologically by `encounter_id` to strictly retain only the initial baseline visit per patient (reducing 101,766 records to 69,990 clean patient encounters).
2. **Stratified Group Split:** In `ml/train.py`, train (70%), validation (15%), and test (15%) splits were partitioned on unique patient records using `GroupShuffleSplit` / stratified sampling, ensuring zero cross-contamination.

### Q5: How were high-cardinality ICD-9 diagnosis codes transformed for machine learning?
**Answer:** The raw data contains thousands of unique alphanumeric ICD-9 codes in `diag_1`, `diag_2`, and `diag_3` (including E and V codes), creating extreme sparsity. In `pipeline/features.py`, we implemented clinical domain taxonomy grouping these codes into 9 physiological organ system categories:
- **Circulatory** (ICD-9 390–459, 785)
- **Respiratory** (ICD-9 460–519, 786)
- **Digestive** (ICD-9 520–579, 787)
- **Diabetes** (ICD-9 250.xx)
- **Injury & Poisoning** (ICD-9 800–999)
- **Musculoskeletal** (ICD-9 710–739)
- **Genitourinary** (ICD-9 580–629, 788)
- **Neoplasms** (ICD-9 140–239)
- **Other / External**
This reduced dimensionality from >2,000 distinct strings to 9 robust clinical categorical variables.

### Q6: What clinical feature engineering did you perform beyond raw EHR fields?
**Answer:** We engineered five domain-specific clinical features:
1. `number_of_prior_visits`: Sum of outpatient, emergency, and inpatient visits over the preceding 12 months, serving as an empirical proxy for health system utilization and chronic frailty.
2. `med_change_flag`: Binary indicator (1 if diabetic medication dosage was modified during hospitalization, 0 otherwise), capturing acute glycemic instability.
3. `total_meds_changed`: Discrete count of antidiabetic drugs titrated `"Up"` or `"Down"` across 23 medications.
4. `polypharmacy_count`: Number of active concurrent diabetic drugs prescribed, capturing medication complexity and adverse drug interaction risk.
5. `A1C_flag` & `glucose_flag`: Ordinal clinical biomarker flags ($>8 \to 3, >7 \to 2, \text{Norm} \to 1, \text{None} \to 0$), capturing laboratory glycemic control.

---

## Part 2: Supervised Learning, Model Selection & Class Imbalance (Questions 7–12)

### Q7: Which machine learning algorithms did you evaluate, and which was chosen as champion?
**Answer:** We evaluated four algorithms under identical patient-stratified validation splits:
1. **L2-Regularized Logistic Regression:** Baseline linear clinical model (Validation ROC-AUC: 0.6212, PR-AUC: 0.1420).
2. **Random Forest Classifier:** Bagging ensemble of 150 decision trees (Validation ROC-AUC: 0.6385, PR-AUC: 0.1580).
3. **Distributed Spark MLlib Random Forest:** Parallelized ensemble trained on distributed Spark DataFrames (ROC-AUC: 0.6403, Accuracy: 91.0%).
4. **XGBoost Classifier (Extreme Gradient Boosting):** Champion model (Validation ROC-AUC: **0.6466**, PR-AUC: **0.1770**, Sensitivity: **53.6%** at calibrated threshold).

**Why XGBoost Won:** Gradient boosted decision trees sequentially minimize second-order Taylor expansion losses, effectively modeling complex non-linear feature interactions (such as high prior visits combined with insulin titration) while handling tabular categorical sparsity via built-in tree regularization ($\gamma$ and $\lambda$).

### Q8: How did you handle the severe 10:1 class imbalance in this dataset?
**Answer:** In our cohort, only **8.98%** of patients are readmitted within 30 days (an imbalance ratio of ~10.19:1 negative-to-positive). We handled this through **Cost-Sensitive Learning**:
- In XGBoost, we set `scale_pos_weight = 10.19` (the ratio of negative to positive cases: $\frac{63,705}{6,285}$). This multiplies the gradient loss for false negatives by $10.19$, penalizing the algorithm heavily for missing a positive readmission.
- In Logistic Regression and Random Forest, we used `class_weight='balanced'`.

### Q9: Why must class balancing techniques (SMOTE or weights) NOT be applied to test or validation sets?
**Answer:** Synthetic oversampling (SMOTE) or artificial rebalancing distorts the underlying prior probability distribution $P(Y)$. While training requires cost weighting so gradient descent doesn't converge to the majority class, the **validation and test cohorts must reflect the true clinical prevalence (8.98%)**. Applying SMOTE or rebalancing to the test set produces artificially inflated precision and false calibration, misleading clinicians about real-world performance.

### Q10: Why is raw classification Accuracy a dangerous and misleading metric in healthcare?
**Answer:** Accuracy is $\frac{\text{TP} + \text{TN}}{\text{Total Encounters}}$. In a dataset with 8.98% readmissions, a naive or "dummy" classifier that predicts "No Readmission" for 100% of patients achieves **91.02% Accuracy**. 
However, that model has **0.0% Sensitivity (Recall)** and detects zero readmissions, resulting in unmonitored high-risk patients bouncing back to emergency rooms with acute complications. Therefore, accuracy must never be used as the primary evaluation metric for imbalanced clinical AI.

### Q11: What is the clinical significance of PR-AUC vs. ROC-AUC for this problem?
**Answer:**
- **ROC-AUC (Receiver Operating Characteristic):** Plots True Positive Rate vs False Positive Rate. Because False Negatives are compared against the huge pool of True Negatives (63,705 cases), the False Positive Rate remains low, which can make ROC-AUC appear deceptively high. MediPulse achieves **0.672 test ROC-AUC**.
- **PR-AUC (Precision-Recall Area):** Focuses exclusively on the positive minority class (True Positives vs False Positives & False Negatives) without being diluted by the large true negative volume. In an 8.98% baseline prevalence setting, random guessing yields a PR-AUC of 0.0898. MediPulse achieves **0.1770 PR-AUC**, representing a **nearly 2x precision lift** across all recall levels.

### Q12: How did you prevent overfitting during model training?
**Answer:**
1. **Pre-split Dimensionality Reduction:** Dropped sparse features (>40% missing) and grouped high-cardinality diagnosis codes into 9 categories.
2. **Regularization Hyperparameters in XGBoost:** Configured `max_depth=5` (preventing over-deep memorizing trees), `learning_rate=0.05` (conservative shrinkage), `subsample=0.8` (stochastic row bagging), `colsample_bytree=0.8` (feature bagging), and `reg_lambda=2.0` (L2 leaf weight penalty).
3. **Early Stopping:** Monitored validation loss with an early stopping patience of 20 rounds.

---

## Part 3: Calibration, Cost Matrices & Decision Thresholds (Questions 13–18)

### Q13: What is Probability Calibration, and why is it mandatory for clinical decision support?
**Answer:** Standard machine learning classifiers (especially tree ensembles like XGBoost and Random Forest) output decision values that rank-order patients accurately, but their raw sigmoid values are distorted by cost-sensitive weighting (`scale_pos_weight`) and tree leaf margins. Consequently, a raw score of "0.45" does not mean a patient has a 45% mathematical chance of readmission.
**Probability Calibration** aligns predicted probabilities with true empirical observed frequencies. If a calibrated model predicts a 25% readmission risk for a group of patients, exactly 25 out of 100 of those patients should actually experience a readmission. In medicine, clinicians prescribe expensive or invasive treatments based on absolute probability; uncalibrated scores can lead to over- or under-treatment.

### Q14: How did you implement probability calibration in MediPulse?
**Answer:** We implemented **Platt Scaling** using scikit-learn's `CalibratedClassifierCV` with `method="sigmoid"` and 3-fold cross-validation. Platt Scaling fits a logistic regression transformation over the uncalibrated classifier's raw logits $f(x)$:
$$P(Y=1 \mid f(x)) = \frac{1}{1 + \exp(A \cdot f(x) + B)}$$
The parameters $A$ and $B$ are optimized using maximum likelihood on validation folds. This produces well-calibrated posterior probabilities while strictly preserving the model's ROC-AUC rank-ordering.

### Q15: Why did you choose an operational decision threshold of 0.13 instead of the default 0.50?
**Answer:** The standard machine learning decision threshold of **0.50** assumes two conditions:
1. Equal class distribution (50% positive / 50% negative).
2. Equal misclassification costs ($\text{Cost}(\text{FP}) = \text{Cost}(\text{FN})$).
In our dataset, only ~8.98% of patients are readmitted. Under a 0.50 threshold, the model predicts almost all patients as negative, catching fewer than 5% of actual readmissions.
By optimizing the threshold on the validation curve, we selected **0.13**. At 0.13, the model achieves **~53.6% Sensitivity (Recall)** and captures the majority of high-risk patients.

### Q16: Explain the Clinical Cost-Benefit Matrix supporting the 0.13 decision threshold.
**Answer:** In healthcare, the asymmetry of misclassification costs is extreme:
- **Cost of a False Positive (FP):** The model flags a low-risk patient as high-risk. The consequence is a preventive post-discharge intervention: a pharmacist telephone reconciliation call or home health follow-up visit. Financial cost: **~$15 to $50**. Clinical harm: **Zero**.
- **Cost of a False Negative (FN):** The model fails to flag a truly high-risk patient. The patient is discharged without transitional support, develops acute diabetic ketoacidosis or heart failure, and is readmitted via the emergency room. Financial cost: **~$14,000+** in acute care hospitalization plus CMS HRRP penalty cuts. Clinical harm: **Severe patient morbidity and potential mortality**.
Because $\text{Cost}(\text{FN}) \gg \text{Cost}(\text{FP})$ (a ratio of >200:1), lowering the threshold to 0.13 maximizes clinical net benefit and cost savings.

### Q17: What is the Brier Score, and what does it measure?
**Answer:** The Brier Score is a strictly proper scoring rule that measures the mean squared difference between predicted probabilities and actual binary outcomes:
$$\text{BS} = \frac{1}{N} \sum_{i=1}^N (p_i - y_i)^2$$
A score of $0$ indicates perfect probability forecasting; $0.25$ indicates uninformative guessing for balanced data. In MediPulse, calibration minimized the Brier Score to **0.078**, proving high probabilistic reliability.

### Q18: What is the Confusion Matrix breakdown of MediPulse at the operational threshold?
**Answer:** On the held-out test cohort of 10,499 unique patients:
- **True Negatives (TN):** ~7,550 patients correctly identified as low risk (no intervention needed).
- **False Positives (FP):** ~2,000 patients flagged for preventive nurse outreach (acceptable preventive cost).
- **True Positives (TP):** ~510 high-risk readmissions correctly intercepted and flagged for clinical care management.
- **False Negatives (FN):** ~439 missed readmissions.
This yields an operational **Recall of 53.6%** and an overall Negative Predictive Value (NPV) of **94.5%**.

---

## Part 4: Explainable AI (XAI) & Clinical Interpretability (Questions 19–24)

### Q19: What is the "Black-Box" dilemma in healthcare AI, and how does MediPulse solve it?
**Answer:** Complex non-linear models like gradient boosted trees or deep neural networks achieve high predictive accuracy, but their internal decision logic is mathematically opaque to human clinicians. Physicians cannot legally or ethically alter patient care based on an unexplained score from a "black-box" model.
MediPulse solves this by embedding **Explainable AI (XAI)** directly into the inference loop using **TreeSHAP**. Every single risk prediction (`/api/predict`) returns not just a risk percentage, but an exact waterfall decomposition of which clinical attributes pushed that specific patient's risk up or down.

### Q20: What is SHAP, and what theoretical foundation makes it superior to feature importance?
**Answer:** SHAP (Shapley Additive Explanations) is grounded in **Cooperative Game Theory** (Lloyd Shapley, Nobel Prize in Economics, 2012). It models the prediction task as a collaborative game where features are "players" and the predicted probability is the "payout". 
SHAP is the only explanation method that mathematically guarantees three foundational axioms:
1. **Local Accuracy (Efficiency):** The sum of feature Shapley values equals the difference between the patient's predicted log-odds and the expected population base value: $f(x) = \phi_0 + \sum_{j=1}^M \phi_j$.
2. **Missingness:** A feature that has no impact on a prediction receives a Shapley value of exactly zero ($\phi_j = 0$).
3. **Consistency (Monotonicity):** If a model changes so that feature $j$ contributes more to the marginal outcome, its attribution $\phi_j$ will never decrease (unlike Gini importance in Random Forests, which fluctuates unpredictably).

### Q21: How does TreeSHAP work, and why is it faster than KernelSHAP or LIME?
**Answer:** 
- **KernelSHAP and LIME** are model-agnostic methods that perturb inputs randomly and fit local surrogate linear models. They require thousands of model evaluations per patient, running in exponential time $\mathcal{O}(M \cdot 2^{|F|})$. Generating an explanation takes 5–30 seconds per patient, making real-time clinical use impossible.
- **TreeSHAP** is an exact algorithm optimized specifically for decision tree ensembles. It directly inspects the internal tree graph, tracking conditional leaf coverage and decision path splits across all ensemble trees simultaneously. It computes exact Shapley values in **polynomial time $\mathcal{O}(T \cdot L \cdot D^2)$** (where $T$ is trees, $L$ is leaves, $D$ is depth). In MediPulse, TreeSHAP computes patient explanations in **sub-15 milliseconds**, enabling instantaneous display during patient discharge.

### Q22: What is the difference between Global and Local Interpretability in MediPulse?
**Answer:**
- **Global Interpretability:** Explains the overall risk landscape across the entire population of 69,990 encounters. It answers: *"What clinical features drive hospital readmission across our patient community?"* Displayed via our global SHAP summary bar chart (`artifacts/shap_importance.json`).
- **Local Interpretability:** Explains the specific prediction for one individual patient encounter. It answers: *"Why is Mrs. Smith flagged at 28.4% readmission risk today?"* Displayed in the Risk Predictor via real-time red/green waterfall attribution bars.

### Q23: What are the top 5 global clinical drivers of readmission identified by SHAP?
**Answer:**
1. **Number of Prior Inpatient Admissions (`number_inpatient`):** The single strongest predictor. Patients with $\ge 2$ hospitalizations in the past year have dramatically elevated baseline bounceback risk.
2. **Length of Stay (`time_in_hospital`):** Prolonged stays (>7 days) correlate with multi-organ deconditioning and severe clinical acuity.
3. **Total Medications Prescribed (`num_medications`):** Reflects high polypharmacy burden, multi-morbidity, and potential drug-drug interaction vulnerability.
4. **Primary ICD-9 Diagnosis Category (`diag_1_category`):** Circulatory conditions (congestive heart failure, ischemic heart disease) and Diabetes ketoacidosis exhibit the highest readmission hazards.
5. **Inpatient Medication Changes (`change == "Ch"` & `insulin: Up/Down`):** Titrating or altering insulin regimens during admission indicates uncontrolled glycemic volatility.

### Q24: How does MediPulse translate SHAP explanations into actionable clinical interventions?
**Answer:** In `ml/explain.py`, the backend maps positive SHAP risk drivers into concrete clinical workflow recommendations:
- If `number_inpatient > 1` is a top positive driver $\to$ Assign Dedicated Transition Care Coordinator & Schedule In-Home Nurse Visit within 48 Hours.
- If `num_medications > 15` or `change == 'Ch'` $\to$ Trigger Clinical Pharmacist Medication Reconciliation & Diabetic Regimen Review.
- If `A1Cresult == '>8'` $\to$ Schedule Outpatient Endocrinologist Consultation within 7 Days & Deploy Continuous Glucose Monitor (CGM).
This bridges the gap between predictive score and therapeutic action.

---

## Part 5: Algorithmic Fairness, Clinical Ethics & Subgroups (Questions 25–27)

### Q25: Why is Algorithmic Fairness Auditing mandatory for healthcare machine learning?
**Answer:** Historical electronic health records often reflect systemic socioeconomic disparities, differential healthcare access, and physician prescribing biases. If a machine learning model is trained uncritically on historical claims, it can perpetuate or amplify disparities—for example, by systematically under-predicting risk for underserved minority cohorts, resulting in fewer post-discharge preventive resources. Auditing for algorithmic fairness ensures ethical clinical safety and equity before clinical deployment.

### Q26: Which demographic dimensions did you audit, and what metrics were evaluated?
**Answer:** In `ml/evaluate.py`, we audited performance across:
1. **Racial Subgroups:** Caucasian, African American, Hispanic, Other.
2. **Gender Subgroups:** Female, Male.
3. **Age Cohorts:** Non-Elderly (<65) vs. Geriatric (65+).

We evaluated two core fairness metrics:
- **Subgroup ROC-AUC Parity:** Checking whether the model discriminates risk with equal competence across groups. (Results: Caucasian: 0.648, African American: 0.644, Hispanic: 0.651 — demonstrating high consistency).
- **Equal Opportunity / Sensitivity Parity:** Checking whether true high-risk patients are detected at equal recall rates across cohorts. (Results: ~53–54% recall across all racial groups at the 0.13 threshold, confirming no systematic racial under-detection).

### Q27: What are the regulatory and clinical boundaries of MediPulse (Software as a Medical Device - SaMD)?
**Answer:** MediPulse is architected strictly as a **Clinical Decision Support System (CDSS)**, not an autonomous diagnostic device or FDA-cleared Class III medical intervention. It provides probabilistic risk stratification to assist clinical judgment. Final clinical decisions—such as medication changes, hospital discharge timing, or outpatient referrals—remain exclusively under the authority and professional responsibility of licensed healthcare practitioners.

---

## Part 6: Scalable AI Data Pipeline & Deployment (Questions 28–30)

### Q28: What role does the Medallion Data Lakehouse play in your AIML platform?
**Answer:** Machine learning models are only as good as the feature engineering pipeline that feeds them ("Garbage In, Garbage Out"). The Medallion Lakehouse serves as the **Scalable Clinical Feature Store**:
- **Bronze (Raw Ingestion):** Stores exact raw records in compressed Parquet with explicit schema enforcement.
- **Silver (Standardized & De-duplicated):** Cleans missingness, filters deceased cases, and eliminates patient-level leakage via Window partitioning.
- **Gold (Feature Store):** Houses the 61 enriched clinical features (ICD-9 groups, polypharmacy, biomarker flags, and target) consumed by scikit-learn, XGBoost, and distributed Spark MLlib.

### Q29: How does the FastAPI backend serve real-time ML inference?
**Answer:**
1. The React frontend dispatches a `POST /api/predict` HTTP request containing 18 patient encounter variables.
2. FastAPI validates the incoming JSON against the `PatientInput` Pydantic schema in `backend/schemas.py`.
3. In `ml/explain.py`, the payload is preprocessed by the scikit-learn pipeline (one-hot encoding categoricals, scaling numerical features).
4. The serialized calibrated champion model (`model.joblib`) predicts calibrated probabilities.
5. TreeSHAP computes patient-level Shapley values and identifies top positive and negative clinical contributors.
6. Actionable clinical interventions are generated and returned in a single JSON payload in **~15 milliseconds**.

### Q30: How does MediPulse ensure operational resilience if PySpark is unavailable in cloud containers?
**Answer:** MediPulse implements an **Adaptive Dual-Engine Architecture**:
- **Local / Enterprise Cluster Environment:** When a Java Virtual Machine (JVM) and PySpark are present, all batch pipelines run on native PySpark with multi-core partitioning and Catalyst SQL optimization.
- **Lightweight Cloud Containers (Render 512MB RAM):** The system automatically detects JVM absence and seamlessly falls back to high-performance PyArrow and vectorizable Pandas engines to read and query the Parquet Medallion lakehouse partitions without crashing. This guarantees 100% deployment uptime across all platforms.
