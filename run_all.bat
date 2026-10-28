@echo off
setlocal enabledelayedexpansion

echo ===============================================================================
echo   MediPulse: Hospital Readmission Risk & Population Health Analytics Platform
echo   Dual Curriculum: Big Data Analytics & AIML in Healthcare
echo ===============================================================================
echo.

:: 1. Environment & Dependencies Check
echo [Step 1/6] Checking Python & Installing Dependencies...
python -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install Python dependencies.
    exit /b 1
)

:: 2. Download / Prepare Data
echo.
echo [Step 2/6] Preparing UCI Diabetes Dataset...
python data/download_data.py
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to download or generate dataset.
    exit /b 1
)

:: 3. Execute Apache PySpark Medallion Pipeline
echo.
echo [Step 3/6] Running Apache PySpark Big Data Pipeline (Bronze - Silver - Gold)...
python pipeline/ingest.py
python pipeline/clean.py
python pipeline/features.py
python pipeline/analytics.py
python pipeline/mllib_model.py
python pipeline/benchmark.py

:: 4. Train Clinical Machine Learning & SHAP Explainer
echo.
echo [Step 4/6] Training Calibrated XGBoost Model, Generating SHAP & Fairness Audits...
python ml/train.py
python ml/evaluate.py
python ml/explain.py

:: 5. Execute Automated Unit Tests
echo.
echo [Step 5/6] Running Unit Test Suite (pytest)...
pytest -v

:: 6. Launch Backend and Frontend
echo.
echo [Step 6/6] Launching MediPulse Application Servers...
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "MediPulse API Backend" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting React Vite Frontend on http://localhost:5173 ...
cd frontend
if not exist node_modules (
    echo Installing npm dependencies...
    call npm install
)
start "MediPulse React Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ===============================================================================
echo   MediPulse is now running!
echo   Frontend UI:  http://localhost:5173
echo   Backend API:  http://127.0.0.1:8000/docs
echo ===============================================================================
