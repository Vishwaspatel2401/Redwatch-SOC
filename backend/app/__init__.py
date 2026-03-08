import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()


def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    # CORS first so preflight OPTIONS and all responses get the right headers
    CORS(
        app,
        origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
        ],
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    Migrate(app, db)

    from app.routes.auth import auth_bp
    from app.routes.logs import logs_bp
    from app.routes.assistant import assistant_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(logs_bp, url_prefix="/api/logs")
    app.register_blueprint(assistant_bp, url_prefix="/api/assistant")

    return app
