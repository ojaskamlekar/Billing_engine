from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "postgresql+psycopg2://postgres:12345678@localhost:5433/billing_engine"

engine = create_engine(DATABASE_URL)

# Shared declarative base – imported by models.py (and any future models)
Base = declarative_base()

# ORM session factory used by FastAPI dependencies
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all ORM-managed tables and run any pending schema migrations.

    Safe to call on every application startup:
    - ``create_all`` is a no-op for tables that already exist.
    - The ``ALTER TABLE`` migration uses ``IF NOT EXISTS`` so it is
      idempotent and will never fail on a database that is already
      up-to-date.
    """
    # Import models here so their classes are registered with Base
    # before create_all() is called.
    from models import User, AuditLog, UsageLog, APIRequestLog, BandwidthUsage  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Migration: add user_id FK to usage_logs (non-destructive, idempotent).
    # Existing rows will have user_id = NULL; new uploads set it explicitly.
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE usage_logs "
            "ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs "
            "ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs "
            "ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0 NOT NULL"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs "
            "ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs "
            "ADD COLUMN IF NOT EXISTS storage_class VARCHAR DEFAULT 'STANDARD'"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs "
            "ADD COLUMN IF NOT EXISTS original_filename VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs "
            "ADD COLUMN IF NOT EXISTS storage_filename VARCHAR"
        ))
        conn.execute(text(
            "UPDATE usage_logs SET original_filename = filename WHERE original_filename IS NULL"
        ))
        conn.execute(text(
            "UPDATE usage_logs SET storage_filename = filename WHERE storage_filename IS NULL"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'Free'"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'customer'"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS otp_hash VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0"
        ))
        conn.execute(text(
            "ALTER TABLE users "
            "ADD COLUMN IF NOT EXISTS last_otp_sent TIMESTAMP"
        ))
        # Migration: add new enterprise fields to audit_logs
        conn.execute(text(
            "ALTER TABLE audit_logs "
            "ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        ))
        conn.execute(text(
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_name VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS mime_type VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS integrity_status VARCHAR DEFAULT 'VERIFIED'"
        ))
        conn.execute(text(
            "ALTER TABLE api_request_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR"
        ))
        conn.commit()