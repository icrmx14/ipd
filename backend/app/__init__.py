"""
Flask Backend Application — App Factory Pattern
Containerized microservice with REST API endpoints.
"""

from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo

mongo = PyMongo()


def create_app():
    app = Flask(__name__)

    # Configuration
    import os
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-secret")
    app.config["MONGO_URI"] = os.environ.get(
        "MONGO_URI", "mongodb://mongodb:27017/appdb"
    )

    # Extensions
    CORS(app)
    mongo.init_app(app)

    # Blueprints
    from app.routes.api import api_bp
    from app.routes.health import health_bp

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(health_bp, url_prefix="/health")

    # Root route (for HAProxy health checks on /)
    @app.route("/")
    def root():
        from flask import jsonify
        import socket, datetime
        return jsonify({
            "server_id": socket.gethostname(),
            "message": f"Hello from container {socket.gethostname()}!",
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })

    return app
