# Use an official lightweight Python image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# 1. Copy ONLY the requirements file
COPY requirements.txt .

# 2. Install ALL packages (Flask + AI dependencies)
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy ALL app code (server.py AND healer.py)
COPY . .

# 4. Default command (runs the web server by default)
# This can be overridden in docker-compose for the healer
CMD ["python", "server.py"]