from flask import current_app


def allowed_file(filename: str) -> bool:
    """Check if the uploaded file has an allowed extension.
    Allowed set comes from config.ALLOWED_EXTENSIONS (txt, log, csv, json, gz, ndjson)."""
    allowed = current_app.config.get(
        "ALLOWED_EXTENSIONS",
        {"txt", "log", "csv", "json", "gz", "ndjson"},
    )
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed
