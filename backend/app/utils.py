from flask import current_app


def allowed_file(filename: str) -> bool:
    """Check if the uploaded file has an allowed extension."""
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", {"txt", "log", "csv"})
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed
