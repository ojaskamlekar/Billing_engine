from sqlalchemy import Column, Integer, String, DateTime, BigInteger, ForeignKey, Boolean, Float
from datetime import datetime

# Import the shared Base so that init_db()'s create_all() sees this model.
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    plan = Column(String, default="Free", nullable=False)
    role = Column(String, default="customer", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    otp_hash = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)
    otp_attempts = Column(Integer, default=0, nullable=False)
    last_otp_sent = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_name = Column(String, nullable=True)
    description = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Backward compatibility fields
    filename = Column(String, nullable=True)
    user_email = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=True)


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    original_filename = Column(String, nullable=True)
    storage_filename = Column(String, nullable=True)
    filesize = Column(BigInteger)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    plan = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    sha256_hash = Column(String, nullable=True)       # Computed at upload; enables duplicate detection
    download_count = Column(Integer, default=0, nullable=False)  # Incremented on each download
    last_downloaded_at = Column(DateTime, nullable=True)
    storage_class = Column(String, default="STANDARD", nullable=False)
    mime_type = Column(String, nullable=True)
    integrity_status = Column(String, default="VERIFIED", nullable=False)


class APIRequestLog(Base):
    __tablename__ = "api_request_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    request_type = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    status_code = Column(Integer, nullable=False)
    execution_time_ms = Column(Float, nullable=False)
    ip_address = Column(String, nullable=False)
    request_id = Column(String, nullable=True)


class BandwidthUsage(Base):
    __tablename__ = "bandwidth_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    file_id = Column(Integer, ForeignKey("usage_logs.id"), nullable=True)
    operation = Column(String, nullable=False)  # 'UPLOAD' or 'DOWNLOAD'
    bytes_transferred = Column(BigInteger, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address = Column(String, nullable=True)
    request_id = Column(String, nullable=True)


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    otp = Column(String, nullable=False)
    otp_expiry = Column(DateTime, nullable=False)
    otp_attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)




