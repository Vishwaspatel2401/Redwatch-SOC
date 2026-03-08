import uuid
from datetime import datetime
from app import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    uploads = db.relationship("LogUpload", backref="user", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
        }


class LogUpload(db.Model):
    __tablename__ = "log_uploads"

    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String, db.ForeignKey("users.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer)
    log_type = db.Column(db.String(50), default="zscaler")
    status = db.Column(db.String(20), default="pending")  # pending | processing | complete | error
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    result = db.relationship("AnalysisResult", backref="upload", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        d = {
            "id": self.id,
            "filename": self.filename,
            "file_size": self.file_size,
            "log_type": self.log_type,
            "status": self.status,
            "uploaded_at": self.uploaded_at.isoformat(),
        }
        # Include result summary so the history list can show threat level + counts
        if self.result:
            d["threat_level"] = self.result.threat_level
            d["total_events"] = self.result.total_events
            d["flagged_events"] = self.result.flagged_events
        return d


class AnalysisResult(db.Model):
    __tablename__ = "analysis_results"

    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_id = db.Column(db.String, db.ForeignKey("log_uploads.id"), nullable=False)
    summary = db.Column(db.Text)
    total_events = db.Column(db.Integer)
    flagged_events = db.Column(db.Integer)
    threat_level = db.Column(db.String(20))  # low | medium | high | critical
    key_findings = db.Column(db.JSON)
    timeline_json = db.Column(db.JSON)
    anomalies_json = db.Column(db.JSON)
    raw_response = db.Column(db.Text)
    events_sample = db.Column(db.JSON)  # first N parsed events for dashboard table
    analyzed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "upload_id": self.upload_id,
            "summary": self.summary,
            "total_events": self.total_events,
            "flagged_events": self.flagged_events,
            "threat_level": self.threat_level,
            "key_findings": self.key_findings or [],
            "timeline": self.timeline_json or [],
            "anomalies": self.anomalies_json or [],
            "events": self.events_sample or [],
            "analyzed_at": self.analyzed_at.isoformat(),
        }
