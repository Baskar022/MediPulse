"""
MediPulse Scalability Dataset Generator
Generates scaled clinical encounter datasets (100k, 500k, 1M+ rows)
to benchmark big data scaling performance between PySpark and Pandas.
"""

import os
import sys
import logging
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("generate_large_dataset")

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_CSV = os.path.join(DATA_DIR, "diabetic_data.csv")


def generate_scaled_dataset(target_rows: int, output_path: str, seed: int = 42):
    """Generates a dataset with `target_rows` by replicating and jittering base data."""
    if not os.path.exists(BASE_CSV):
        raise FileNotFoundError(f"Base dataset {BASE_CSV} not found. Run download_data.py first.")

    logger.info(f"Loading base dataset from {BASE_CSV}...")
    base_df = pd.read_csv(BASE_CSV, low_memory=False)
    n_base = len(base_df)

    if target_rows <= n_base:
        scaled_df = base_df.sample(n=target_rows, random_state=seed).copy()
    else:
        reps = int(np.ceil(target_rows / n_base))
        logger.info(f"Replicating base dataset {reps} times to achieve {target_rows:,} rows...")
        dfs = []
        np.random.seed(seed)
        for i in range(reps):
            chunk = base_df.copy()
            # Assign new unique encounter IDs and slight noise to patient numbers
            chunk["encounter_id"] = chunk["encounter_id"] + (i + 1) * 100000000
            chunk["patient_nbr"] = chunk["patient_nbr"] + (i * 5000000)
            dfs.append(chunk)
        scaled_df = pd.concat(dfs, ignore_index=True).iloc[:target_rows]

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    logger.info(f"Saving {len(scaled_df):,} rows to {output_path}...")
    scaled_df.to_csv(output_path, index=False)
    logger.info(f"Successfully generated {output_path} ({os.path.getsize(output_path) / (1024*1024):.2f} MB)")
    return output_path


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate scaled dataset for scalability benchmarks")
    parser.add_argument("--rows", type=int, default=500000, help="Number of rows to generate")
    parser.add_argument("--out", type=str, default="", help="Output CSV path")
    args = parser.parse_args()

    out_path = args.out or os.path.join(DATA_DIR, f"diabetic_data_{args.rows//1000}k.csv")
    generate_scaled_dataset(args.rows, out_path)
