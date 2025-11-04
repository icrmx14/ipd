# from flask import Flask
# app = Flask(__name__)

# @app.route('/')
# def hello():
#     # Return a simple message identifying this server
#     return '<h1>Hello from Server 1!</h1>'

# if __name__ == '__main__':
#     # Run on port 5001
#     app.run(host='0.0.0.0', port=5001)

#new :
from flask import Flask, jsonify # Import jsonify
from flask_cors import CORS
import datetime # Import datetime

app = Flask(__name__)
CORS(app)

@app.route('/')
def hello():
    # Return JSON with server ID and a timestamp
    return jsonify({
        "server_id": "Server 1",
        "message": "Hello from Server 1!",
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)