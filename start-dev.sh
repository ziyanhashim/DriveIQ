#!/bin/bash
# Start all DriveIQ dev services in one terminal
# Usage: bash start-dev.sh

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "All services stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- Backend ---
echo "Starting backend..."
cd backend
pip install -r requirements.txt -q 2>/dev/null
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

sleep 3

# --- Frontend ---
echo "Starting frontend..."
cd frontend
npx expo start &
FRONTEND_PID=$!
cd ..

echo ""
echo "All services running. Press Ctrl+C to stop everything."
wait
