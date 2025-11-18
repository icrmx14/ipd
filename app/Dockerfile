# Use an official lightweight Python image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# 1. Copy ONLY the requirements file
COPY requirements.txt .

# 2. Install the packages from that file
RUN pip install -r requirements.txt

# 3. NOW copy the rest of your app code
COPY . .

# 4. The command to run when the container starts
CMD ["python", "server.py"]