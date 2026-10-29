#!/usr/bin/env bash

echo "==============================================================================="
echo "  MediPulse: Instant Live Presentation Tunnel Generator"
echo "==============================================================================="

python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
SERVER_PID=$!

sleep 3

echo "Starting public tunnel for port 8000..."
npx --yes localtunnel --port 8000

kill $SERVER_PID
