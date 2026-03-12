"""
REST API Routes
"""

from flask import Blueprint, jsonify, request
from app import mongo
import socket
import datetime

api_bp = Blueprint("api", __name__)
HOSTNAME = socket.gethostname()


@api_bp.route("/", methods=["GET"])
def index():
    """Root API endpoint — shows server identity."""
    return jsonify({
        "server_id": HOSTNAME,
        "message": f"Hello from container {HOSTNAME}!",
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })


@api_bp.route("/items", methods=["GET"])
def get_items():
    """Retrieve all items from the database."""
    try:
        items = list(mongo.db.items.find({}, {"_id": 0}))
        return jsonify({
            "items": items,
            "count": len(items),
            "server_id": HOSTNAME,
        })
    except Exception as e:
        return jsonify({"error": str(e), "server_id": HOSTNAME}), 500


@api_bp.route("/items", methods=["POST"])
def create_item():
    """Create a new item in the database."""
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Name is required"}), 400

    item = {
        "name": data["name"],
        "description": data.get("description", ""),
        "created_at": datetime.datetime.now().isoformat(),
        "server_id": HOSTNAME,
    }
    mongo.db.items.insert_one(item)
    item.pop("_id", None)

    return jsonify({"status": "created", "item": item}), 201


@api_bp.route("/info", methods=["GET"])
def server_info():
    """Detailed server information for debugging."""
    return jsonify({
        "server_id": HOSTNAME,
        "hostname": HOSTNAME,
        "timestamp": datetime.datetime.now().isoformat(),
        "endpoints": ["/api/", "/api/items", "/api/info", "/health/", "/health/ready"],
    })
