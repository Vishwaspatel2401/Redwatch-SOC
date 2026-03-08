import json
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from openai import OpenAI
from app.models import LogUpload, AnalysisResult

assistant_bp = Blueprint("assistant", __name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _get_upload(upload_id: str, user_id: str):
    """Return the most recent complete upload for user, or the specified one."""
    if upload_id:
        return LogUpload.query.filter_by(id=upload_id, user_id=user_id).first()
    return (
        LogUpload.query
        .filter_by(user_id=user_id, status="complete")
        .order_by(LogUpload.uploaded_at.desc())
        .first()
    )


def _build_context(upload: LogUpload, result: AnalysisResult) -> str:
    """Build a concise context string from the stored analysis for OpenAI."""
    findings = "\n".join(f"  - {f}" for f in (result.key_findings or []))
    anomalies = []
    for a in (result.anomalies_json or []):
        anomalies.append(
            f"  [{a.get('severity','?').upper()}] {a.get('type','?')}: {a.get('description','')}"
        )
    anomaly_text = "\n".join(anomalies) if anomalies else "  None"

    return f"""
LOG FILE: {upload.filename}  |  TYPE: {upload.log_type}  |  UPLOADED: {upload.uploaded_at}

ANALYSIS SUMMARY:
{result.summary}

THREAT LEVEL: {result.threat_level.upper()}
TOTAL EVENTS: {result.total_events}
FLAGGED EVENTS: {result.flagged_events}

KEY FINDINGS:
{findings or '  None'}

DETECTED ANOMALIES:
{anomaly_text}
""".strip()


@assistant_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    user_id = get_jwt_identity()
    body = request.get_json(silent=True) or {}

    question = (body.get("question") or "").strip()
    upload_id = body.get("upload_id") or ""
    history = body.get("history") or []  # list of {role, content}

    if not question:
        return jsonify({"error": "Question is required"}), 400

    upload = _get_upload(upload_id, user_id)
    if not upload or not upload.result:
        return jsonify({"error": "No analysis found. Please upload and analyse a log file first."}), 404

    context = _build_context(upload, upload.result)

    system_prompt = f"""You are RedWatch, an expert AI SOC (Security Operations Centre) analyst assistant.
You have been given the results of an automated log analysis. Answer the analyst's questions
concisely and accurately based on that context. If something is not covered by the context,
say so clearly — do not make up data.

ANALYSIS CONTEXT:
{context}

Guidelines:
- Be direct and specific; avoid filler phrases.
- Use bullet points for lists.
- If asked for a recommendation, give one with a clear rationale.
- Keep answers under 300 words unless the question requires more detail.
"""

    messages = [{"role": "system", "content": system_prompt}]
    # Include prior turns so the assistant has conversation memory
    for turn in history[-10:]:  # last 10 turns max
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": question})

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=600,
        )
        answer = response.choices[0].message.content.strip()
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": f"AI request failed: {str(e)}"}), 500


@assistant_bp.route("/narrative", methods=["POST"])
@jwt_required()
def narrative():
    user_id = get_jwt_identity()
    body = request.get_json(silent=True) or {}
    upload_id = body.get("upload_id") or ""

    upload = _get_upload(upload_id, user_id)
    if not upload or not upload.result:
        return jsonify({"error": "No analysis found."}), 404

    context = _build_context(upload, upload.result)

    prompt = f"""Write a professional SOC incident report narrative based on the following log analysis.

{context}

The report should include:
1. Executive Summary (2-3 sentences)
2. Timeline of Events
3. Affected Systems / IPs
4. Attack Techniques Observed
5. Recommended Immediate Actions
6. Recommended Long-term Mitigations

Write in clear, professional language suitable for both technical and non-technical stakeholders.
Use plain text with section headings — no markdown symbols like ** or ##.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert SOC analyst writing a formal incident report."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=1200,
        )
        text = response.choices[0].message.content.strip()
        return jsonify({"narrative": text})
    except Exception as e:
        return jsonify({"error": f"AI request failed: {str(e)}"}), 500
