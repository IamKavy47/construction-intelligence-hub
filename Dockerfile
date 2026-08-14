# Build stage: Create the frontend build output
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files and build
COPY frontend/package*.json frontend/tsconfig.json frontend/vite.config.ts frontend/bunfig.toml frontend/eslint.config.js frontend/components.json ./
COPY frontend/public ./public
COPY frontend/src ./src

RUN npm ci --prefer-offline --no-audit
RUN npm run build

# Final stage: Python backend with frontend files
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python app
COPY app.py .
COPY . .

# Copy the built frontend from the builder stage
COPY --from=frontend-builder /app/frontend/.output ./.output

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]