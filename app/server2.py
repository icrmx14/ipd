from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello():
    # Return a simple message identifying this server
    return '<h1>Hello from Server 2!</h1>'

if __name__ == '__main__':
    # Run on port 5002
    app.run(host='0.0.0.0', port=5002)
