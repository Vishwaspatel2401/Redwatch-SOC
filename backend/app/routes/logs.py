import os
import threading
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app import db
from app.models import LogUpload, AnalysisResult
from app.services.log_parser import parse_log_file
from app.services.ai_analyzer import analyze_with_openai
from app.services.virustotal import enrich_with_virustotal

logs_bp = Blueprint("logs", __name__)


def allowed_file(filename):
    allowed = current_app.config["ALLOWED_EXTENSIONS"]
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


@logs_bp.route("/upload", methods=["OPTIONS"])
def upload_log_options():
    return "", 200


@logs_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_log():
    user_id = get_jwt_identity()

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Allowed: .txt, .log, .csv, .json, .gz"}), 400

    filename = secure_filename(file.filename)
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    filepath = os.path.join(upload_folder, filename)
    file.save(filepath)

    file_size = os.path.getsize(filepath)

    # Create DB record
    upload = LogUpload(
        user_id=user_id,
        filename=filename,
        file_size=file_size,
        status="processing",
    )
    db.session.add(upload)
    db.session.commit()

    try:
        # Auto-detect format and parse
        parsed_logs, log_type = parse_log_file(filepath)

        # Persist detected log_type back onto the upload record
        upload.log_type = log_type
        db.session.commit()

        # Analyze with OpenAI immediately — don't block on VirusTotal
        result = analyze_with_openai(parsed_logs)

        # Run VirusTotal enrichment in background (free tier = 15s/hash, too slow to block).
        # It's a no-op for logs without sha256 fields (Apache, most JSON).
        # daemon=True so it won't prevent process shutdown.
        vt_thread = threading.Thread(
            target=enrich_with_virustotal,
            args=(parsed_logs,),
            daemon=True,
        )
        vt_thread.start()

        # Sample events for dashboard "Recent Log Events" table (timestamp, ip, path, status)
        events_sample = [
            {
                "timestamp": e.get("timestamp") or "",
                "src_ip": e.get("src_ip") or "",
                "url": (e.get("url") or e.get("path") or "").strip() or "/",
                "status_code": e.get("status_code") or 0,
            }
            for e in parsed_logs[:300]
        ]

        # Persist results
        analysis = AnalysisResult(
            upload_id=upload.id,
            summary=result.get("summary"),
            total_events=result.get("total_events", len(parsed_logs)),
            flagged_events=len(result.get("anomalies", [])),
            threat_level=result.get("threat_level", "low"),
            key_findings=result.get("key_findings", []),
            timeline_json=result.get("timeline", []),
            anomalies_json=result.get("anomalies", []),
            raw_response=str(result),
            events_sample=events_sample,
        )
        upload.status = "complete"
        db.session.add(analysis)
        db.session.commit()

        return jsonify({
            "upload_id": upload.id,
            "result": {**upload.to_dict(), **analysis.to_dict()},
        }), 201

    except Exception as e:
        upload.status = "error"
        db.session.commit()
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@logs_bp.route("/", methods=["GET"])
@jwt_required()
def list_uploads():
    user_id = get_jwt_identity()
    uploads = LogUpload.query.filter_by(user_id=user_id).order_by(LogUpload.uploaded_at.desc()).all()
    return jsonify({"uploads": [u.to_dict() for u in uploads]})


@logs_bp.route("/<string:upload_id>", methods=["GET"])
@jwt_required()
def get_result(upload_id):
    user_id = get_jwt_identity()
    upload = LogUpload.query.filter_by(id=upload_id, user_id=user_id).first()

    if not upload:
        return jsonify({"error": "Upload not found"}), 404

    result = upload.result
    if not result:
        return jsonify({"error": "Analysis not ready yet", "status": upload.status}), 202

    return jsonify({**upload.to_dict(), **result.to_dict()})


@logs_bp.route("/<string:upload_id>", methods=["DELETE"])
@jwt_required()
def delete_upload(upload_id):
    user_id = get_jwt_identity()
    upload = LogUpload.query.filter_by(id=upload_id, user_id=user_id).first()

    if not upload:
        return jsonify({"error": "Upload not found"}), 404

    db.session.delete(upload)
    db.session.commit()
    return jsonify({"message": "Upload deleted successfully"})
