FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Ensure upload directory exists
RUN mkdir -p /tmp/uploads

EXPOSE 8000

ENV FLASK_APP=main.py

# Start gunicorn (db.create_all() runs automatically on app startup)
# --timeout 120 allows time for large log analysis (OpenAI call can take ~20s)
CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
