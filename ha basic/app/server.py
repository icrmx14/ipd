# app/server.py
from flask import Flask, jsonify
from flask_cors import CORS
import datetime
import socket # Import socket to get the hostname

app = Flask(__name__)
CORS(app)

# Get the container's own unique hostname
HOSTNAME = socket.gethostname()

@app.route('/')
def hello():
    # Return JSON with the server's unique hostname
    return jsonify({
        "server_id": HOSTNAME, # e.g., "habasic-app-1", "habasic-app-2"
        "message": f"Hello from container {HOSTNAME}!",
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

if __name__ == '__main__':
    # Run on a single, standard port 5000
    app.run(host='0.0.0.0', port=5000)