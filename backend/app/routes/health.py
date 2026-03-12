"""
Health Check Routes — used by HAProxy and monitoring.
"""

from flask import Blueprint, jsonify
import socket
import datetime

health_bp = Blueprint("health", __name__)
HOSTNAME = socket.gethostname()


@health_bp.route("/", methods=["GET"])
def health_check():
    """Basic liveness check — always returns 200 if app is running."""
    return jsonify({
        "status": "healthy",
        "server_id": HOSTNAME,
        "timestamp": datetime.datetime.now().isoformat(),
    })


@health_bp.route("/ready", methods=["GET"])
def readiness_check():
    """Readiness check — verifies database connectivity."""
    try:
        from app import mongo
        mongo.db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
        return jsonify({
            "status": "not_ready",
            "database": db_status,
            "server_id": HOSTNAME,
        }), 503

    return jsonify({
        "status": "ready",
        "database": db_status,
        "server_id": HOSTNAME,
    })
