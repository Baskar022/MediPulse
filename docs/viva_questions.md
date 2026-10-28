# MediPulse: Top 25 Viva Examination Questions & Model Answers
### Comprehensive Preparation Guide for Big Data Analytics (BDA) & Artificial Intelligence / Machine Learning (AIML)

---

## Part 1: Big Data Analytics & Apache PySpark (Questions 1–13)

### Q1: Why did you choose Apache PySpark over standard Python Pandas for this project?
**Answer:** While Pandas is convenient for in-memory exploratory analysis on small datasets, it operates strictly in single-threaded RAM. When datasets exceed millions of records or cluster scales, Pandas crashes with Out-Of-Memory (OOM) errors. Apache PySpark provides distributed memory computing, disk spill resilience, columnar Parquet I/O, multi-core parallelism, and seamless scaling from a local developer machine to enterprise multi-node cloud clusters (AWS EMR / Databricks).

### Q2: What is the Medallion (Bronze/Silver/Gold) Lakehouse Architecture and how is it used in MediPulse?
**Answer:** The Medallion architecture organizes data into three refinement stages:
- **Bronze (Raw):** Exact copy of source encounters ingested with an explicit `StructType` schema into compressed Parquet (`data/bronze/encounters.parquet`).
- **Silver (Cleaned & Conformed):** Null-imputed, filtered (removing expired/hospice discharges), deduplicated to eliminate patient leakage, and mapped with clinical lookups (`data/silver/encounters.parquet`).
- **Gold (Enriched Feature Store):** ICD-9 categorized diagnoses, polypharmacy counts, prior visit aggregations, and binary targets ready for Spark SQL and ML modeling (`data/gold/encounters.parquet`).

### Q3: Why did you specify an explicit `StructType` schema during ingestion rather than using `inferSchema=True`?
**Answer:** Setting `inferSchema=True` forces PySpark to scan the entire raw CSV twice—once to determine column data types and once to load the records. In production big data environments with gigabytes or terabytes of logs, this causes severe network and I/O bottlenecks. Providing an explicit `StructType` schema enables instant, single-pass zero-inference reading.

### Q4: Why is Apache Parquet preferred over CSV for Big Data storage?
**Answer:** Parquet is a columnar, binary storage format with embedded metadata and dictionary/snappy compression. It supports:
1. **Column Projection:** Reading only requested columns (skipping unused fields without reading them off disk).
2. **Predicate Pushdown:** Using file statistics (min/max values) to skip entire data row groups without scanning.
3. **High Compression:** Achieving ~70% file size reduction compared to raw text CSVs.

### Q5: What is the purpose of `winutils.exe` and `HADOOP_HOME` when running PySpark on Windows?
**Answer:** Apache Spark relies on Apache Hadoop libraries to interface with the local file system (`LocalFileSystem` and `RawLocalFileSystem`). On POSIX systems (Linux/macOS), file permissions are native. On Windows, Hadoop calls `winutils.exe` to simulate POSIX chmod permissions and file lock operations. Setting `HADOOP_HOME` and placing `winutils.exe` in its `bin` folder resolves `java.io.FileNotFoundException` when writing Parquet files.

### Q6: Explain what the Catalyst Optimizer and Tungsten Engine do in Apache Spark.
**Answer:** 
- **Catalyst Optimizer:** Analyzes Spark DataFrame and SQL queries, constructs an Abstract Syntax Tree (AST), applies logical optimizations (predicate pushdown, constant folding, projection pruning), and generates an optimized physical execution plan.
- **Project Tungsten:** Optimizes low-level execution by managing off-heap binary memory (bypassing JVM garbage collection overhead) and generating whole-stage Java bytecode for tight CPU cache locality.

### Q7: What is the difference between Spark Transformations and Actions?
**Answer:** 
- **Transformations (Lazy):** Operations that define a new DataFrame without executing computation immediately (e.g., `filter()`, `withColumn()`, `groupBy()`, `select()`). Spark builds a Directed Acyclic Graph (DAG) of the lineage.
- **Actions (Eager):** Operations that trigger the DAG execution across executor partitions and return results to the driver program or disk (e.g., `count()`, `collect()`, `write.parquet()`, `show()`).

### Q8: What are Narrow vs. Wide dependencies in Spark execution?
**Answer:**
- **Narrow Dependency:** Each partition of the parent RDD/DataFrame is used by at most one partition of the child (e.g., `filter()`, `map()`). No data movement across network nodes (no shuffle).
- **Wide Dependency:** Multiple child partitions depend on data from a single parent partition (e.g., `groupBy()`, `distinct()`, `join()`). Requires a network data shuffle across cluster executors.

### Q9: Why did you use `Window.partitionBy("patient_nbr").orderBy("encounter_id")` during data cleaning?
**Answer:** Some diabetic patients in the dataset had multiple hospitalizations over the 10-year period. If we kept all encounters, later visits from the same patient could appear in the training set while earlier visits were in the test set, creating temporal data leakage. Using a Spark Window with `row_number() == 1` guarantees we strictly retain the index (initial) visit for every unique patient.

### Q10: What did your Pandas vs. PySpark Scalability Benchmark reveal regarding execution time?
**Answer:** The benchmark demonstrated the classic **scaling crossover point**:
- At **100k rows**, Pandas finished faster (1.71s vs 14.98s) because PySpark incurs a fixed JVM boot and driver-executor initialization penalty.
- At **500k rows**, runtime equalized (~7-8s).
- At **1,000,000 rows**, PySpark outperformed Pandas with a **1.68x speedup** (8.40s vs 14.08s), demonstrating PySpark's superior multi-threaded columnar scaling as data volume expands.

### Q11: How does Spark MLlib differ from scikit-learn?
**Answer:** Scikit-learn runs purely in single-machine CPU RAM. Spark MLlib executes distributed machine learning algorithms across cluster worker nodes using distributed resilient datasets (RDDs/DataFrames) and vector assemblers, allowing models to train on terabyte-scale datasets that exceed any single server's physical memory.

### Q12: What Spark SQL queries were executed in `analytics.py`?
**Answer:** Spark SQL executed multi-dimensional aggregations calculating total encounters, 30-day readmission prevalence, and average length of stay across:
1. Patient age brackets (`age`)
2. Primary ICD-9 diagnosis categories (`diag_1_category`)
3. Discharge destinations (`discharge_disposition_desc`)
4. Admission acuity (`admission_type_desc`)
5. Length of stay bins (1-2 days, 3-5 days, etc.)
6. Top 10 multi-variable high-risk clinical segments (having minimum sample size >= 50).

### Q13: What does `spark.sql.shuffle.partitions` control?
**Answer:** It configures the number of partitions created when shuffling data for wide transformations like `groupBy` or `join`. In large clusters the default is 200, but in local execution modes with 4 CPU cores, tuning it to `4` avoids creating hundreds of empty micro-tasks and minimizes scheduling overhead.

---

## Part 2: Artificial Intelligence & Machine Learning (Questions 14–25)

### Q14: Why is a patient-level split strictly required instead of a random train_test_split?
**Answer:** Random train-test splitting assigns rows randomly. If a patient visited the hospital multiple times, their demographic and biological traits would be present in both training and test sets. The model would "memorize" patient identities rather than learning generalizable clinical patterns. Using `GroupShuffleSplit` on `patient_nbr` guarantees zero patient overlap across training, validation, and test cohorts.

### Q15: Why did you exclude patients with discharge disposition IDs 11, 13, 14, 19, 20, and 21?
**Answer:** These IDs correspond to patients who expired in the hospital or were discharged to hospice care. Deceased patients cannot be readmitted to a hospital within 30 days. Including them in the denominator introduces survival bias and clinical target distortion.

### Q16: How did you handle class imbalance, and why must class balancing NOT be applied to test data?
**Answer:** Only ~8.98% of patients are readmitted within 30 days (an imbalance ratio of ~10.19:1). We applied cost-sensitive learning via `class_weight='balanced'` and XGBoost's `scale_pos_weight = 10.19` strictly on the training partition. Balancing techniques (weights or SMOTE) must never be applied to test or validation cohorts because the test set must reflect true real-world clinical prevalence.

### Q17: Why is ROC-AUC alone insufficient for evaluating imbalanced healthcare models, and what role does PR-AUC play?
**Answer:** The Receiver Operating Characteristic (ROC) curve evaluates True Positive Rate vs False Positive Rate. Because False Negatives are compared against a vast majority of True Negatives, the False Positive Rate remains low, making ROC-AUC appear artificially optimistic. The Precision-Recall (PR) curve focuses exclusively on the minority positive class (Readmitted). A model with PR-AUC of 0.1770 on a 8.98% baseline prevalence represents an almost 2x improvement over random guessing.

### Q18: Why did you calibrate model probabilities using `CalibratedClassifierCV`?
**Answer:** Boosting models like XGBoost produce scores that rank-order patients effectively but are distorted by regularization and positive class weighting, meaning raw outputs do not reflect true mathematical probabilities. CalibratedClassifierCV using Platt Scaling (Sigmoid) maps raw scores to true posterior probabilities, ensuring that if the model predicts a 25% risk, approximately 25 out of 100 such patients are actually readmitted.

### Q19: Why was an operational decision threshold of 0.13 selected instead of the default 0.50?
**Answer:** In low-prevalence clinical settings (~9%), a rigid 0.50 threshold predicts almost all patients as negative, yielding near-zero clinical utility. By calibrating the threshold to 0.13 on the validation cohort, we achieve ~53.6% Sensitivity (Recall). In healthcare, the cost of a false positive (a nurse phone call costing ~$15) is negligible compared to the medical and financial cost of an unflagged emergency readmission (costing ~$14,000+ under CMS HRRP penalties).

### Q20: What is SHAP and how does TreeSHAP work?
**Answer:** SHAP (Shapley Additive Explanations) is grounded in cooperative game theory. It calculates each feature's marginal contribution to the prediction across all possible feature subsets. TreeSHAP is an optimized algorithm designed for decision tree ensembles that computes exact Shapley values in polynomial time $O(TLD^2)$ rather than exponential time $O(TL2^M)$, enabling real-time explanation of patient risk during clinical intake.

### Q21: What were the top global clinical drivers identified by SHAP in this dataset?
**Answer:** 
1. **Prior Inpatient Admissions:** Prior hospitalization in the previous 12 months was the single strongest indicator of bounceback risk.
2. **Length of Stay:** Longer stays correlate with acute disease severity and deconditioning.
3. **Total Medications Administered:** Indicated polypharmacy and multi-morbidity complexity.
4. **Patient Age Bracket:** Senior cohorts ([70-80), [80-90)) exhibited elevated vulnerability.
5. **HbA1c Lab Elevation:** Uncontrolled glycated hemoglobin (&gt;8%) significantly elevated readmission probability.

### Q22: What is the difference between global and local interpretability?
**Answer:**
- **Global Interpretability:** Explains the overall internal behavior of the algorithm across the entire population (e.g., our SHAP summary bar chart showing which clinical features matter most across 69,990 encounters).
- **Local Interpretability:** Explains the specific prediction for one individual patient encounter (e.g., our `/api/predict` response showing the top 5 factors that specifically elevated or reduced *that* patient's readmission score).

### Q23: How did you evaluate algorithmic fairness across demographic subgroups?
**Answer:** We performed an audit across Race (Caucasian, African American, Hispanic), Gender (Female, Male), and Age groups, checking:
1. **ROC-AUC equity:** Ensuring the model discriminates risk equally well across demographic groups (all subgroups ranged between 0.641 and 0.651).
2. **Equal Opportunity (Recall parity):** Ensuring high-risk patients receive preventive outreach at equal sensitivity rates (~53-54% across racial cohorts).

### Q24: What are the primary clinical limitations of this model?
**Answer:**
1. **Retrospective EHR Data:** Collected from 1999–2008; does not include recent pharmacological innovations like SGLT2 inhibitors or GLP-1 agonists.
2. **Missing Social Determinants of Health (SDOH):** Clinical claims omit socioeconomic factors like food insecurity, medication copay affordability, and caregiver availability.
3. **Decision-Support Scope:** The software is strictly an assistive advisory prototype and cannot replace clinician diagnosis.

### Q25: How does the FastAPI backend connect the PySpark data artifacts with the React frontend?
**Answer:** The FastAPI application acts as the serving gateway. Precomputed Spark SQL analytics and benchmark results are saved as structured JSON/Parquet artifacts during pipeline execution and cached in memory. Real-time patient prediction requests (`POST /api/predict`) pass through the Pydantic schema validator, are transformed by the fitted scikit-learn preprocessor, scored by the calibrated model, interpreted by the TreeSHAP explainer, and returned in ~15 milliseconds to the React UI.
