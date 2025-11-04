# Use an official lightweight Python image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app
#copying only req file
COPY requirements.txt .
# Install Flask
RUN pip install -r requirements.txt 

# Copy EVERYTHING from the 'app' folder into the container
# This includes server1.py and server2.py
COPY . .

# A default command (though docker-compose will override it)
CMD ["python", "server1.py"]