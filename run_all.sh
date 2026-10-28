#!/usr/bin/env bash
set -e

echo "==============================================================================="
echo "  MediPulse: Hospital Readmission Risk & Population Health Analytics Platform"
echo "  Dual Curriculum: Big Data Analytics & AIML in Healthcare"
echo "==============================================================================="

echo "[Step 1/6] Installing Python dependencies..."
python3 -m pip install -r requirements.txt

echo "[Step 2/6] Preparing UCI Diabetes Dataset..."
python3 data/download_data.py

echo "[Step 3/6] Running Apache PySpark Medallion Pipeline..."
python3 pipeline/ingest.py
python3 pipeline/clean.py
python3 pipeline/features.py
python3 pipeline/analytics.py
python3 pipeline/mllib_model.py
python3 pipeline/benchmark.py

echo "[Step 4/6] Training ML Models & SHAP Explainer..."
python3 ml/train.py
python3 ml/evaluate.py
python3 ml/explain.py

echo "[Step 5/6] Running Unit Tests..."
pytest -v

echo "[Step 6/6] Starting MediPulse Backend and Frontend..."
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ..

echo "MediPulse running!"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://127.0.0.1:8000/docs"

wait $BACKEND_PID $FRONTEND_PID
