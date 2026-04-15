FROM python:3.11-slim

WORKDIR /repo

# System deps for numpy/scipy/scikit-learn
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps (cached layer)
COPY backend/requirements.txt /repo/backend/requirements.txt
RUN pip install --no-cache-dir -r /repo/backend/requirements.txt

# Copy backend + ml-model (preserves relative import path ../../ml-model/src)
COPY backend/ /repo/backend/
COPY ml-model/ /repo/ml-model/

WORKDIR /repo/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
