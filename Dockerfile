# Multi-stage Docker build for MediPulse
# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Serving Environment
FROM python:3.11-slim
WORKDIR /app

# Prevent Python from writing .pyc and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install dependencies
COPY requirements_prod.txt ./requirements_prod.txt
RUN pip install --no-cache-dir -r requirements_prod.txt

# Copy application files, trained models, and artifacts
COPY backend/ ./backend/
COPY ml/ ./ml/
COPY artifacts/ ./artifacts/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

# Start unified FastAPI web server
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
