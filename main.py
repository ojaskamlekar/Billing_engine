from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, Request
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from database import engine, init_db, get_db
from fastapi import Form
from predictor import predict_storage
from auth import create_access_token, hash_password, verify_password, get_current_user
import shutil
import os
import io
import hashlib
from datetime import datetime, timedelta
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from schemas import UserCreate, UserResponse, LoginRequest, TokenResponse, UpgradeRequest, VerifyEmailRequest, ResendOTPRequest, ForgotPasswordRequest
from models import User, AuditLog, UsageLog
import redis_client
import secrets
from EmailService import send_otp_email
from rate_limiter import RateLimitException, check_rate_limit

app = FastAPI()

import time
import asyncio
import queue
import threading

log_queue = queue.Queue()

def log_worker():
    from database import SessionLocal
    from models import APIRequestLog, User
    from redis_client import _get_client
    
    while True:
        try:
            log_data = log_queue.get()
            if log_data is None:
                break
                
            method, path, status_code, execution_time_ms, ip_address, auth_header, request_id = log_data
            
            # Categorize Request Type
            request_type = "OTHER"
            if path == "/upload" and method == "POST":
                request_type = "UPLOAD"
            elif (path.startswith("/files/") and path.endswith("/download")) or (path == "/download"):
                request_type = "DOWNLOAD"
            elif path.startswith("/files/") and method == "DELETE":
                request_type = "DELETE"
            elif path == "/files" and method == "GET":
                request_type = "LIST FILES"
            elif path == "/login" and method == "POST":
                request_type = "LOGIN"
            elif path == "/register" and method == "POST":
                request_type = "REGISTER"
            elif path == "/verify-email" and method == "POST":
                request_type = "EMAIL VERIFICATION"
            elif path == "/resend-otp" and method == "POST":
                request_type = "OTP RESEND"
            elif path.startswith("/admin/"):
                request_type = "ADMIN ACTIONS"
                
            user_id = None
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header[7:]
                try:
                    from auth import decode_access_token
                    payload = decode_access_token(token)
                    email = payload.get("sub")
                    if email:
                        r_client = _get_client()
                        if r_client:
                            try:
                                cached_id = r_client.get(f"wecloud:user_id:{email}")
                                if cached_id:
                                    user_id = int(cached_id)
                            except Exception:
                                pass
                        
                        if user_id is None:
                            db = SessionLocal()
                            try:
                                user = db.query(User).filter(User.email == email).first()
                                if user:
                                    user_id = user.id
                                    if r_client:
                                        try:
                                            r_client.set(f"wecloud:user_id:{email}", user_id, ex=3600)
                                        except Exception:
                                            pass
                            finally:
                                db.close()
                except Exception:
                    pass
            
            db = SessionLocal()
            try:
                log_entry = APIRequestLog(
                    user_id=user_id,
                    endpoint=path,
                    method=method,
                    request_type=request_type,
                    status_code=status_code,
                    execution_time_ms=execution_time_ms,
                    ip_address=ip_address,
                    request_id=request_id
                )
                db.add(log_entry)
                db.commit()
            except Exception as e:
                print(f"Error logging request in worker: {e}")
            finally:
                db.close()
                
        except Exception as e:
            print(f"Error in log worker loop: {e}")
        finally:
            log_queue.task_done()

# Start background worker thread
worker_thread = threading.Thread(target=log_worker, daemon=True)
worker_thread.start()


@app.middleware("http")
async def log_api_requests(request: Request, call_next):
    path = request.url.path
    if path.startswith("/static") or path.startswith("/docs") or path.startswith("/openapi.json") or path == "/favicon.ico":
        return await call_next(request)
        
    import uuid
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    response = await call_next(request)
    execution_time_ms = (time.time() - start_time) * 1000.0
    
    ip_address = request.client.host if request.client else "unknown"
    auth_header = request.headers.get("Authorization")
    
    log_queue.put((
        request.method,
        path,
        response.status_code,
        execution_time_ms,
        ip_address,
        auth_header,
        request_id
    ))
    
    return response


@app.exception_handler(RateLimitException)
def rate_limit_exception_handler(request: Request, exc: RateLimitException):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": exc.detail,
            "retry_after": exc.retry_after
        },
        headers={"Retry-After": str(exc.retry_after)}
    )

# ---------------------------------------------------------------------------
# CORS — must be registered before any routes
# ---------------------------------------------------------------------------
# allow_origins must be explicit (not "*") when allow_credentials=True,
# otherwise browsers reject the preflight response.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def format_bytes_py(bytes_size):
    if bytes_size is None:
        return "0 B"
    val = float(bytes_size)
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if val < 1024.0:
            return f"{val:.2f} {unit}" if unit != 'B' else f"{int(val)} {unit}"
        val /= 1024.0
    return f"{val:.2f} PB"


def log_audit_event(
    user: User | None,
    action: str,
    resource_type: str | None,
    resource_name: str | None,
    description: str | None,
    request: Request | None = None
):
    ip_address = None
    user_agent = None
    if request:
        ip_address = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
        user_agent = request.headers.get("user-agent")

    user_id = user.id if user else None
    user_email = user.email if user else "Anonymous"

    try:
        from database import SessionLocal
        with SessionLocal() as db_session:
            log_entry = AuditLog(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_name=resource_name,
                description=description,
                ip_address=ip_address,
                user_agent=user_agent,
                user_email=user_email,
                filename=resource_name or "N/A",
                timestamp=datetime.utcnow()
            )
            db_session.add(log_entry)
            db_session.commit()
    except Exception as e:
        logger.error(f"Failed to log audit event: {e}")


@app.on_event("startup")
def on_startup():
    """Create ORM-managed tables (e.g. users) on application start and backfill fields."""
    init_db()
    try:
        import mimetypes
        with engine.connect() as conn:
            # Backfill mime_type
            rows = conn.execute(text("SELECT id, filename FROM usage_logs WHERE mime_type IS NULL")).fetchall()
            for r in rows:
                row_id = r[0]
                fn = r[1] or ""
                mtype, _ = mimetypes.guess_type(fn)
                mtype = mtype or "application/octet-stream"
                conn.execute(
                    text("UPDATE usage_logs SET mime_type = :mtype WHERE id = :id"),
                    {"mtype": mtype, "id": row_id}
                )
            # Backfill integrity_status
            conn.execute(text("UPDATE usage_logs SET integrity_status = 'VERIFIED' WHERE integrity_status IS NULL"))
            conn.commit()
    except Exception as e:
        print(f"Error backfilling metadata columns: {e}")

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Register a new user in an unverified state, generating and sending an OTP."""
    ip = request.client.host if request.client else "unknown"
    check_rate_limit(
        key=f"rate:register:{ip}",
        limit=3,
        period=600,  # 10 minutes
        request=request,
        endpoint="/register",
        user_email=payload.email
    )
    # Check email uniqueness
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists."
        )

    # Hash password — plain text is never stored
    hashed_password = hash_password(payload.password)

    # Generate random 6-digit OTP
    otp = "".join(secrets.choice("0123456789") for _ in range(6))

    # Send OTP email first to verify config and API availability
    success = send_otp_email(payload.email, payload.name, otp)
    if not success:
        print(f"\n=======================================================")
        print(f"  [DEVELOPMENT ONLY] BREVO EMAIL DELIVERY FAILED.")
        print(f"  VERIFICATION OTP FOR {payload.email} IS: {otp}")
        print(f"=======================================================\n")

    # Save user to DB in unverified state
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hashed_password,
        email_verified=False,
        otp_hash=hash_password(otp),
        otp_expiry=datetime.utcnow() + timedelta(minutes=10),
        otp_attempts=0,
        last_otp_sent=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Log registration action
    log_audit_event(
        user=user,
        action="User Registration",
        resource_type="User",
        resource_name=user.email,
        description=f"User registered in unverified state: {user.email}",
        request=request
    )

    return {
        "message": "Verification code sent successfully.",
        "email": user.email
    }


@app.post("/login", response_model=TokenResponse)
def login_user(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT access token.

    - Looks up the user by email.
    - Verifies the submitted password against the stored bcrypt hash.
    - On success, returns a signed JWT valid for 24 hours.
    - Returns 401 Unauthorized for any credential mismatch (generic message
      to avoid leaking whether the email exists).
    """
    ip = request.client.host if request.client else "unknown"
    check_rate_limit(
        key=f"rate:login:{ip}",
        limit=5,
        period=60,
        request=request,
        endpoint="/login",
        user_email=payload.email,
        custom_message="Too many login attempts. Please try again in {retry_after} seconds."
    )
    user = db.query(User).filter(User.email == payload.email).first()

    # Constant-time comparison via auth.verify_password prevents timing attacks.
    if not user or not verify_password(payload.password, user.password_hash):
        log_audit_event(
            user=user,
            action="Failed Login Attempt",
            resource_type="User Session",
            resource_name=payload.email,
            description=f"Failed login attempt for email: {payload.email}",
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not getattr(user, "email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in."
        )

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. Your account has been suspended."
        )

    access_token = create_access_token(data={"sub": user.email, "name": user.name, "plan": user.plan, "role": user.role, "is_active": user.is_active})

    # Log successful login action
    log_audit_event(
        user=user,
        action="User Login",
        resource_type="User Session",
        resource_name=user.email,
        description="User logged in successfully.",
        request=request
    )

    return TokenResponse(access_token=access_token, token_type="bearer")


@app.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)):
    """Verify unverified user's email using OTP."""
    check_rate_limit(
        key=f"rate:otp:{payload.email}",
        limit=10,
        period=600,
        request=request,
        endpoint="/verify-email",
        user_email=payload.email
    )
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if user.email_verified:
        return {"message": "Email is already verified."}

    if not user.otp_hash or not user.otp_expiry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code has been requested."
        )

    # Check if OTP has expired (10 minutes lifetime)
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    # Verify OTP
    if not verify_password(payload.otp, user.otp_hash):
        user.otp_attempts += 1
        db.add(user)
        db.commit()

        if user.otp_attempts >= 5:
            # Generate and send a new OTP after 5 failures
            otp = "".join(secrets.choice("0123456789") for _ in range(6))
            user.otp_hash = hash_password(otp)
            user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
            user.otp_attempts = 0
            user.last_otp_sent = datetime.utcnow()
            db.add(user)
            db.commit()

            # Send OTP email
            success = send_otp_email(user.email, user.name, otp)
            if not success:
                print(f"\n=======================================================")
                print(f"  [DEVELOPMENT ONLY] BREVO EMAIL DELIVERY FAILED.")
                print(f"  NEW VERIFICATION OTP FOR {user.email} IS: {otp}")
                print(f"=======================================================\n")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum verification attempts exceeded. A new verification code has been sent to your email."
            )
        else:
            remaining = 5 - user.otp_attempts
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incorrect verification code. {remaining} attempts remaining."
            )

    # Success! Clear OTP fields and verify
    user.email_verified = True
    user.otp_hash = None
    user.otp_expiry = None
    user.otp_attempts = 0
    db.add(user)
    db.commit()

    # Log verify action in audit log
    log_audit_event(
        user=user,
        action="Email Verification Success",
        resource_type="User Profile",
        resource_name=user.email,
        description=f"User {user.email} successfully verified their email.",
        request=None
    )

    return {"message": "Email verified successfully. You can now log in."}


@app.post("/resend-otp")
def resend_otp(payload: ResendOTPRequest, request: Request, db: Session = Depends(get_db)):
    """Resend a new OTP if within limits and cooldown."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if user.email_verified:
        return {"message": "Email is already verified."}

    # Dual Rate limiting checks
    check_rate_limit(
        key=f"rate:otp:{payload.email}:minute",
        limit=1,
        period=60,
        request=request,
        endpoint="/resend-otp",
        user_email=payload.email,
        custom_message="Please wait {retry_after} seconds before requesting a new code."
    )
    check_rate_limit(
        key=f"rate:otp:{payload.email}:hour",
        limit=5,
        period=3600,
        request=request,
        endpoint="/resend-otp",
        user_email=payload.email,
        custom_message="Maximum verification requests exceeded. Please try again in {retry_after} seconds."
    )

    # Generate and save new OTP
    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    user.otp_hash = hash_password(otp)
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    user.otp_attempts = 0
    user.last_otp_sent = datetime.utcnow()
    db.add(user)
    db.commit()

    # Send OTP email
    success = send_otp_email(user.email, user.name, otp)
    if not success:
        print(f"\n=======================================================")
        print(f"  [DEVELOPMENT ONLY] BREVO EMAIL DELIVERY FAILED.")
        print(f"  RESENT VERIFICATION OTP FOR {user.email} IS: {otp}")
        print(f"=======================================================\n")

    return {"message": "Verification code sent successfully."}


@app.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Mock forgot password endpoint with rate limit of 3 requests per 15 minutes."""
    check_rate_limit(
        key=f"rate:forgot:{payload.email}",
        limit=3,
        period=900,  # 15 minutes
        request=request,
        endpoint="/forgot-password",
        user_email=payload.email
    )
    # Check if user exists (generic response regardless to prevent user enumeration)
    user = db.query(User).filter(User.email == payload.email).first()
    return {"detail": "If the email is registered, a password reset link will be sent."}


@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current user's profile details including their active plan."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "plan": current_user.plan
    }


@app.post("/subscription/upgrade")
def upgrade_subscription(
    payload: UpgradeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the authenticated user's active subscription plan."""
    if payload.plan not in ["Free", "Pro", "Enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan name. Choose Free, Pro, or Enterprise."
        )
    
    old_plan = current_user.plan
    current_user.plan = payload.plan
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    invalidate_user_cache(current_user.id)

    # Log subscription change action
    log_audit_event(
        user=current_user,
        action="Subscription Change",
        resource_type="User Profile",
        resource_name=current_user.email,
        description=f"Subscription plan updated from {old_plan} to {payload.plan}.",
        request=request
    )

    return {
        "message": f"Plan updated successfully to {payload.plan}",
        "plan": current_user.plan
    }


UPLOAD_FOLDER = "uploads"

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

from storage_provider import get_storage_provider
storage_provider = get_storage_provider()

def sanitize_filename(filename: str) -> str:
    import re
    # Extract only the base name (prevents path traversal)
    base = os.path.basename(filename)
    # Replace whitespace/tabs with underscores
    base = re.sub(r'\s+', '_', base)
    # Keep only alphanumeric, dots, hyphens, and underscores
    base = re.sub(r'[^a-zA-Z0-9._-]', '', base)
    # Avoid empty or dots-only names
    if not base or base in ('.', '..'):
        base = "file"
    return base


@app.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    plan: str = Form(None),  # Keep parameter for backward compatibility
    current_user: User = Depends(get_current_user),
):
    # Determine user plan
    user_plan = current_user.plan

    check_rate_limit(
        key=f"rate:upload:{current_user.id}",
        limit=20,
        period=60,
        request=request,
        endpoint="/upload",
        user_email=current_user.email
    )

    import uuid
    import tempfile
    
    safe_original = sanitize_filename(file.filename)
    unique_id = str(uuid.uuid4())
    storage_fn = f"{current_user.id}_{unique_id}_{safe_original}"

    sha256 = hashlib.sha256()
    temp_fd, temp_path = tempfile.mkstemp()
    try:
        with os.fdopen(temp_fd, "wb") as buffer:
            while True:
                chunk = file.file.read(8192)
                if not chunk:
                    break
                buffer.write(chunk)
                sha256.update(chunk)
        file_hash = sha256.hexdigest()
        file_size = os.path.getsize(temp_path)

        # 1. Validate max upload size for current plan
        max_upload_sizes = {
            "Free": 25 * 1024 * 1024,
            "Pro": 500 * 1024 * 1024,
            "Enterprise": 5 * 1024 * 1024 * 1024
        }
        max_allowed = max_upload_sizes.get(user_plan, 25 * 1024 * 1024)
        if file_size > max_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Upload size exceeds the limit for your plan. Maximum upload size for {user_plan} is {max_allowed // (1024 * 1024)} MB."
            )

        # 2. Validate current total storage limit
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT SUM(filesize) FROM usage_logs WHERE user_id = :user_id"),
                {"user_id": current_user.id}
            )
            total_size = int(result.scalar() or 0)

        projected_total = total_size + file_size

        storage_limits = {
            "Free": 5 * 1024 * 1024 * 1024,
            "Pro": 100 * 1024 * 1024 * 1024,
            "Enterprise": 5 * 1024 * 1024 * 1024 * 1024
        }
        limit_allowed = storage_limits.get(user_plan, 5 * 1024 * 1024 * 1024)
        if projected_total > limit_allowed:
            if user_plan == "Free":
                message = "Storage limit exceeded. Upgrade to Pro."
            elif user_plan == "Pro":
                message = "Storage limit exceeded. Upgrade to Enterprise."
            else:
                message = "Storage limit exceeded."
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=message
            )

        # Upload to active storage provider
        with open(temp_path, "rb") as f:
            storage_provider.upload_file(f, storage_fn)

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

    # 3. Calculate cost using correct rate per plan
    rates = {
        "Free": 0.0,
        "Pro": 2.0,
        "Enterprise": 1.5
    }
    rate = rates.get(user_plan, 2.0)
    cost = (file_size / (1024 * 1024)) * rate

    # Determine MIME type
    import mimetypes
    mime_type, _ = mimetypes.guess_type(safe_original)
    mime_type = mime_type or "application/octet-stream"

    # Increment Redis hashes generated count
    try:
        redis_client._get_client().incr("wecloud:integrity:hashes_generated")
    except Exception:
        pass

    with engine.connect() as conn:
        conn.execute(
            text(
                "INSERT INTO usage_logs (filename, original_filename, storage_filename, filesize, plan, user_id, sha256_hash, download_count, mime_type, integrity_status) "
                "VALUES (:filename, :original_filename, :storage_filename, :filesize, :plan, :user_id, :sha256_hash, 0, :mime_type, 'VERIFIED')"
            ),
            {
                "filename": safe_original,
                "original_filename": safe_original,
                "storage_filename": storage_fn,
                "filesize": file_size,
                "plan": user_plan,
                "user_id": current_user.id,
                "sha256_hash": file_hash,
                "mime_type": mime_type,
            }
        )
        conn.commit()

        # Retrieve file ID and log upload bandwidth
        res_id = conn.execute(
            text("SELECT id FROM usage_logs WHERE storage_filename = :storage_fn"),
            {"storage_fn": storage_fn}
        )
        file_id = res_id.scalar()

    try:
        request_id = getattr(request.state, "request_id", None)
        ip_address = request.client.host if request.client else "unknown"
        from bandwidth_service import BandwidthService
        BandwidthService.log_bandwidth_async(
            user_id=current_user.id,
            file_id=file_id,
            operation="UPLOAD",
            bytes_transferred=file_size,
            ip_address=ip_address,
            request_id=request_id
        )
    except Exception as e:
        print(f"Failed to log upload bandwidth: {e}")

    invalidate_user_cache(current_user.id)

    # Log File Upload audit action
    log_audit_event(
        user=current_user,
        action="File Upload",
        resource_type="File",
        resource_name=safe_original,
        description=f"Uploaded file: {safe_original} ({format_bytes_py(file_size)})",
        request=request
    )

    return {
        "message": "File uploaded successfully",
        "filename": safe_original,
        "size": file_size,
        "estimated_cost": round(cost, 2)
    }
@app.get("/usage")
def get_usage(current_user: User = Depends(get_current_user)):

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT id, filename, filesize, plan, uploaded_at, original_filename, storage_filename, sha256_hash, mime_type, integrity_status FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        )

        rows = result.fetchall()

    data = []

    for row in rows:
        data.append({
            "id": row.id,
            "filename": row.original_filename or row.filename,
            "filesize": row.filesize,
            "plan": row.plan,
            "uploaded_at": str(row.uploaded_at),
            "storage_filename": row.storage_filename or row.filename,
            "sha256_hash": row.sha256_hash or "",
            "mime_type": row.mime_type or "application/octet-stream",
            "integrity_status": row.integrity_status or "VERIFIED"
        })

    return data
@app.get("/summary")
@redis_client.cache_response(ttl=300)
def get_summary(current_user: User = Depends(get_current_user)):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT SUM(filesize) FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        )
        total_size = int(result.scalar() or 0)

    rates = {
        "Free": 0.0,
        "Pro": 2.0,
        "Enterprise": 1.5
    }
    rate = rates.get(current_user.plan, 2.0)
    total_cost = (total_size / (1024 * 1024)) * rate

    return {
        "total_storage_bytes": total_size,
        "total_cost": round(total_cost, 2)
    }
    
    
@app.get("/api-metering/summary")
def get_api_metering_summary(
    timeframe: str = "Last 30 Days",
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import APIRequestLog
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    query = db.query(APIRequestLog).filter(APIRequestLog.user_id == current_user.id)

    if timeframe == "Today":
        start = datetime(now.year, now.month, now.day)
        query = query.filter(APIRequestLog.timestamp >= start)
    elif timeframe == "Last 7 Days":
        start = now - timedelta(days=7)
        query = query.filter(APIRequestLog.timestamp >= start)
    elif timeframe == "Last 30 Days":
        start = now - timedelta(days=30)
        query = query.filter(APIRequestLog.timestamp >= start)
    elif timeframe == "Custom" and start_date and end_date:
        try:
            start = datetime.fromisoformat(start_date)
            end = datetime.fromisoformat(end_date)
            query = query.filter(APIRequestLog.timestamp.between(start, end))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")

    logs = query.all()

    total_requests = len(logs)
    failed_requests = sum(1 for l in logs if l.status_code >= 400)
    success_rate = round(((total_requests - failed_requests) / total_requests * 100), 2) if total_requests > 0 else 100.0
    avg_response_time = round(sum(l.execution_time_ms for l in logs) / total_requests, 2) if total_requests > 0 else 0.0

    breakdown = {
        "UPLOAD": 0,
        "DOWNLOAD": 0,
        "DELETE": 0,
        "LIST FILES": 0,
        "LOGIN": 0,
        "REGISTER": 0,
        "EMAIL VERIFICATION": 0,
        "OTP RESEND": 0,
        "ADMIN ACTIONS": 0,
        "OTHER": 0
    }
    for l in logs:
        breakdown[l.request_type] = breakdown.get(l.request_type, 0) + 1

    cost_per_request = 0.02
    estimated_billable = total_requests
    estimated_cost = round(estimated_billable * cost_per_request, 4)

    return {
        "summary": {
            "total_requests": total_requests,
            "failed_requests": failed_requests,
            "success_rate": success_rate,
            "avg_response_time": avg_response_time,
            "estimated_billable_requests": estimated_billable,
            "estimated_request_cost": estimated_cost,
            "cost_per_request": cost_per_request
        },
        "breakdown": breakdown
    }


@app.get("/api-metering/charts")
def get_api_metering_charts(
    timeframe: str = "Last 30 Days",
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import APIRequestLog
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    query = db.query(APIRequestLog).filter(APIRequestLog.user_id == current_user.id)

    if timeframe == "Today":
        start = datetime(now.year, now.month, now.day)
        query = query.filter(APIRequestLog.timestamp >= start)
    elif timeframe == "Last 7 Days":
        start = now - timedelta(days=7)
        query = query.filter(APIRequestLog.timestamp >= start)
    elif timeframe == "Last 30 Days":
        start = now - timedelta(days=30)
        query = query.filter(APIRequestLog.timestamp >= start)
    elif timeframe == "Custom" and start_date and end_date:
        try:
            start = datetime.fromisoformat(start_date)
            end = datetime.fromisoformat(end_date)
            query = query.filter(APIRequestLog.timestamp.between(start, end))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")

    logs = query.all()

    daily_volume = {}
    for l in logs:
        date_str = l.timestamp.strftime("%Y-%m-%d")
        if date_str not in daily_volume:
            daily_volume[date_str] = {"date": date_str, "requests": 0, "success": 0, "failed": 0}
        daily_volume[date_str]["requests"] += 1
        if l.status_code < 400:
            daily_volume[date_str]["success"] += 1
        else:
            daily_volume[date_str]["failed"] += 1

    sorted_daily = sorted(daily_volume.values(), key=lambda x: x["date"])

    type_counts = {}
    for l in logs:
        type_counts[l.request_type] = type_counts.get(l.request_type, 0) + 1
    pie_data = [{"name": k, "value": v} for k, v in type_counts.items()]

    success_count = sum(1 for l in logs if l.status_code < 400)
    failed_count = len(logs) - success_count
    success_vs_failed = [
        {"name": "Success", "value": success_count},
        {"name": "Failed", "value": failed_count}
    ]

    endpoint_counts = {}
    for l in logs:
        key = f"{l.method} {l.endpoint}"
        endpoint_counts[key] = endpoint_counts.get(key, 0) + 1
    top_endpoints = sorted(
        [{"endpoint": k, "count": v} for k, v in endpoint_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]

    hourly_counts = {h: 0 for h in range(24)}
    for l in logs:
        hour = l.timestamp.hour
        hourly_counts[hour] += 1
    hourly_data = [{"hour": f"{h:02d}:00", "requests": count} for h, count in hourly_counts.items()]

    return {
        "daily_volume": sorted_daily,
        "type_distribution": pie_data,
        "success_vs_failed": success_vs_failed,
        "top_endpoints": top_endpoints,
        "peak_hours": hourly_data
    }


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if getattr(current_user, "role", "customer").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. Admin access required."
        )
    return current_user


@app.get("/admin/api-metering/summary")
def get_admin_api_metering_summary(
    user_id: int = None,
    endpoint: str = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from models import APIRequestLog, User
    from sqlalchemy import func

    query = db.query(
        User.id,
        User.name,
        User.email,
        func.count(APIRequestLog.id).label("total_requests"),
        func.avg(APIRequestLog.execution_time_ms).label("avg_latency"),
        func.sum(
            func.case(
                (APIRequestLog.status_code >= 400, 1),
                else_=0
            )
        ).label("failed_requests")
    ).join(APIRequestLog, APIRequestLog.user_id == User.id, isouter=True)

    if user_id:
        query = query.filter(User.id == user_id)
    if endpoint:
        query = query.filter(APIRequestLog.endpoint.like(f"%{endpoint}%"))

    results = query.group_by(User.id, User.name, User.email).all()

    user_usage = []
    for r in results:
        total_req = r.total_requests or 0
        failed_req = int(r.failed_requests) if r.failed_requests is not None else 0
        success_rate = round(((total_req - failed_req) / total_req * 100), 2) if total_req > 0 else 100.0
        
        user_usage.append({
            "user_id": r.id,
            "name": r.name,
            "email": r.email,
            "total_requests": total_req,
            "avg_latency": round(float(r.avg_latency), 2) if r.avg_latency is not None else 0.0,
            "failed_requests": failed_req,
            "success_rate": success_rate
        })

    user_usage = sorted(user_usage, key=lambda x: x["total_requests"], reverse=True)

    return {
        "user_usage": user_usage
    }


@app.get("/admin/api-metering/logs")
def get_admin_api_metering_logs(
    user_id: int = None,
    endpoint: str = None,
    limit: int = 100,
    offset: int = 0,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from models import APIRequestLog, User
    
    query = db.query(
        APIRequestLog.id,
        APIRequestLog.endpoint,
        APIRequestLog.method,
        APIRequestLog.request_type,
        APIRequestLog.status_code,
        APIRequestLog.execution_time_ms,
        APIRequestLog.ip_address,
        APIRequestLog.timestamp,
        User.email.label("user_email")
    ).join(User, User.id == APIRequestLog.user_id, isouter=True)

    if user_id:
        query = query.filter(APIRequestLog.user_id == user_id)
    if endpoint:
        query = query.filter(APIRequestLog.endpoint.like(f"%{endpoint}%"))

    total_count = query.count()
    logs = query.order_by(APIRequestLog.timestamp.desc()).offset(offset).limit(limit).all()

    return {
        "total": total_count,
        "logs": [
            {
                "id": l.id,
                "endpoint": l.endpoint,
                "method": l.method,
                "request_type": l.request_type,
                "status_code": l.status_code,
                "execution_time_ms": round(l.execution_time_ms, 2),
                "ip_address": l.ip_address,
                "timestamp": str(l.timestamp),
                "user_email": l.user_email or "Anonymous"
            }
            for l in logs
        ]
    }


@app.get("/admin/api-metering/export")
def export_admin_api_metering_logs(
    user_id: int = None,
    endpoint: str = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from models import APIRequestLog, User
    import csv
    import io

    query = db.query(
        APIRequestLog.id,
        APIRequestLog.endpoint,
        APIRequestLog.method,
        APIRequestLog.request_type,
        APIRequestLog.status_code,
        APIRequestLog.execution_time_ms,
        APIRequestLog.ip_address,
        APIRequestLog.timestamp,
        User.email.label("user_email")
    ).join(User, User.id == APIRequestLog.user_id, isouter=True)

    if user_id:
        query = query.filter(APIRequestLog.user_id == user_id)
    if endpoint:
        query = query.filter(APIRequestLog.endpoint.like(f"%{endpoint}%"))

    logs = query.order_by(APIRequestLog.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Log ID", "User Email", "Endpoint", "Method", 
        "Request Type", "Status Code", "Execution Time (ms)", 
        "IP Address", "Timestamp"
    ])
    
    for l in logs:
        writer.writerow([
            l.id,
            l.user_email or "Anonymous",
            l.endpoint,
            l.method,
            l.request_type,
            l.status_code,
            round(l.execution_time_ms, 2),
            l.ip_address,
            str(l.timestamp)
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=api_request_logs.csv"}
    )


@app.get("/recommend-tier")
@redis_client.cache_response(ttl=300)
def recommend_tier(current_user: User = Depends(get_current_user)):
    if current_user.plan == "Free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Upgrade to Pro to access tier recommendations."
        )

    print("RECOMMEND ENDPOINT HIT")

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT SUM(filesize) FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        )
        total_bytes = int(result.scalar() or 0)

    total_mb = total_bytes / (1024 * 1024)

    if total_mb < 100:
        recommendation = "Free"
        reason = "Current storage usage fits within Free plan limits."
    elif total_mb < 500:
        recommendation = "Pro"
        reason = "Current storage usage fits within Pro plan limits."
    else:
        recommendation = "Enterprise"
        reason = "Storage usage is approaching enterprise scale."

    return {
        "current_storage_mb": round(total_mb, 2),
        "recommended_plan": recommendation,
        "reason": reason
    }


@app.get("/analytics")
@redis_client.cache_response(ttl=300)
def get_analytics(current_user: User = Depends(get_current_user)):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT filesize, plan, uploaded_at FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        )
        rows = result.fetchall()

    return {
        "total_files": len(rows),
        "total_bytes": sum(row[0] for row in rows),
        "history": [{"filesize": row[0], "plan": row[1], "uploaded_at": str(row[2])} for row in rows]
    }


@app.get("/alerts")
def get_alerts(current_user: User = Depends(get_current_user)):
    if current_user.plan == "Free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Upgrade to Pro to access billing alerts."
        )
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT plan FROM usage_logs "
                "WHERE user_id = :user_id ORDER BY uploaded_at DESC LIMIT 1"
            ),
            {"user_id": current_user.id}
        )
        row = result.fetchone()
        current_plan = row[0] if row else "Free"

        result = conn.execute(
            text(
                "SELECT filesize FROM usage_logs "
                "WHERE user_id = :user_id ORDER BY uploaded_at"
            ),
            {"user_id": current_user.id}
        )
        rows = result.fetchall()

    storage_history = []
    running_total = 0
    for row in rows:
        mb = row[0] / (1024 * 1024)
        running_total += mb
        storage_history.append(running_total)

    if len(storage_history) < 2:
        forecasted_storage_mb = storage_history[0] if storage_history else 0.0
    else:
        forecasted_storage_mb = predict_storage(storage_history)

    forecasted_storage_mb = round(forecasted_storage_mb, 2)

    plan_limits = {
        "Free": 5 * 1024.0,
        "Pro": 100 * 1024.0,
        "Enterprise": 5 * 1024 * 1024.0
    }
    limit_mb = plan_limits.get(current_plan, 5 * 1024.0)

    if forecasted_storage_mb > limit_mb:
        alert = True
        severity = "critical"
        message = "Forecasted usage is expected to exceed the current plan limit."
    elif forecasted_storage_mb >= 0.8 * limit_mb:
        alert = True
        severity = "warning"
        message = "Forecasted usage is expected to approach the current plan limit."
    else:
        alert = False
        severity = "none"
        message = "Usage is within safe limits."

    if alert:
        if forecasted_storage_mb < 100:
            recommended_plan = "Free"
        elif forecasted_storage_mb < 500:
            recommended_plan = "Pro"
        else:
            recommended_plan = "Enterprise"

        return {
            "alert": True,
            "severity": severity,
            "current_plan": current_plan,
            "plan_limit_mb": int(limit_mb),
            "forecasted_storage_mb": forecasted_storage_mb,
            "recommended_plan": recommended_plan,
            "message": message
        }
    else:
        return {
            "alert": False,
            "severity": "none",
            "message": message
        }


def _compute_invoice_data(user_id: int) -> dict:
    """Build and return the invoice data dict for a given user.

    Extracted so both ``/invoice`` and ``/invoice/download`` can share the
    same logic without duplicating queries.

    Args:
        user_id: The authenticated user's database ID.

    Returns:
        A dict with invoice_id, billing_period, plan, totals, etc.
    """
    from database import SessionLocal
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        plan = user.plan if user else "Free"

    with engine.connect() as conn:
        # Total active files
        result = conn.execute(
            text("SELECT COUNT(*) FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        total_files = result.scalar() or 0

        # Total storage size
        result = conn.execute(
            text("SELECT SUM(filesize) FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        total_bytes = int(result.scalar() or 0)

        # API Request Count
        result_api = conn.execute(
            text("SELECT COUNT(*) FROM api_request_logs WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        api_requests_count = result_api.scalar() or 0

        # Bandwidth Bytes
        result_bw = conn.execute(
            text("SELECT SUM(bytes_transferred) FROM bandwidth_usage WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        bandwidth_bytes = int(result_bw.scalar() or 0)

    # Costs math
    storage_used_mb = round(total_bytes / (1024 * 1024), 2)
    plan_rates = {
        "Free": 0.0,
        "Pro": 2.0,
        "Enterprise": 1.5
    }
    rate_per_mb = plan_rates.get(plan, 2.0)
    storage_cost = round(storage_used_mb * rate_per_mb, 2)

    api_request_cost = round(api_requests_count * 0.02, 2)

    from bandwidth_service import get_bandwidth_price_per_gb
    price_per_gb = get_bandwidth_price_per_gb()
    bandwidth_gb = bandwidth_bytes / (1024 * 1024 * 1024)
    bandwidth_cost = round(bandwidth_gb * price_per_gb, 2)

    subtotal = round(storage_cost + api_request_cost + bandwidth_cost, 2)
    taxes = round(subtotal * 0.18, 2) # 18% GST/Taxes
    total_amount = round(subtotal + taxes, 2)

    from datetime import datetime
    now = datetime.now()
    billing_period = now.strftime("%B %Y")
    generated_at = now.strftime("%Y-%m-%d")
    invoice_id = f"INV-{now.strftime('%Y')}-{total_files:04d}"

    return {
        "invoice_id": invoice_id,
        "billing_period": billing_period,
        "plan": plan,
        "total_files": total_files,
        "storage_used_mb": storage_used_mb,
        "rate_per_mb": rate_per_mb,
        "storage_cost": storage_cost,
        "api_requests_count": api_requests_count,
        "api_request_cost": api_request_cost,
        "bandwidth_bytes": bandwidth_bytes,
        "bandwidth_cost": bandwidth_cost,
        "bandwidth_price_per_gb": price_per_gb,
        "subtotal": subtotal,
        "taxes": taxes,
        "total_amount": total_amount,
        "generated_at": generated_at
    }


@app.get("/invoice")
@redis_client.cache_response(ttl=300)
def get_invoice(current_user: User = Depends(get_current_user)):
    if current_user.plan == "Free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invoice generation is available only for Pro and Enterprise users."
        )
    return _compute_invoice_data(current_user.id)


def generate_pdf_invoice(invoice_data: dict) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'InvoiceSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=25
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#4f46e5'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569')
    )
    
    value_style = ParagraphStyle(
        'ValueStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1e293b')
    )
    
    total_label_style = ParagraphStyle(
        'TotalLabelStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e293b')
    )
    
    total_val_style = ParagraphStyle(
        'TotalValStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#4f46e5')
    )

    elements = []
    
    # Title & Header Banner
    elements.append(Paragraph("SaaS Storage Billing Invoice", title_style))
    elements.append(Paragraph(f"Invoice Statement for your cloud storage consumption.", subtitle_style))
    
    # General Info Table
    info_data = [
        [Paragraph("Invoice ID:", label_style), Paragraph(invoice_data["invoice_id"], value_style),
         Paragraph("Billing Period:", label_style), Paragraph(invoice_data["billing_period"], value_style)],
        [Paragraph("Generated Date:", label_style), Paragraph(invoice_data["generated_at"], value_style),
         Paragraph("Customer Plan:", label_style), Paragraph(invoice_data["plan"], value_style)]
    ]
    
    t_info = Table(info_data, colWidths=[110, 150, 110, 150])
    t_info.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 20))
    
    # Line Items Section
    elements.append(Paragraph("Usage Summary Details", section_heading))
    
    # Details Grid Table
    details_data = [
        [Paragraph("Usage Metric", label_style), Paragraph("Quantity / Details", label_style), Paragraph("Unit Cost / Rate", label_style)],
        [Paragraph("Storage Consumed", value_style), Paragraph(f"{invoice_data['storage_used_mb']} MB", value_style), Paragraph(f"₹{invoice_data['rate_per_mb']} / MB", value_style)],
        [Paragraph("Total Metered Files", value_style), Paragraph(f"{invoice_data['total_files']} files", value_style), Paragraph("Included in plan", value_style)]
    ]
    
    t_details = Table(details_data, colWidths=[200, 160, 160])
    t_details.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('LINEBELOW', (0,0), (-1,0), 1.5, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor('#f1f5f9')),
    ]))
    elements.append(t_details)
    elements.append(Spacer(1, 25))
    
    # Total Due Box (Amount Due Banner)
    elements.append(Paragraph("Payment Summary", section_heading))
    total_data = [
        [Paragraph("Total Subtotal:", label_style), Paragraph(f"₹{invoice_data['total_amount']}", value_style)],
        [Paragraph("Tax / GST (0%):", label_style), Paragraph("₹0.00", value_style)],
        [Paragraph("Amount Due:", total_label_style), Paragraph(f"₹{invoice_data['total_amount']}", total_val_style)]
    ]
    
    t_total = Table(total_data, colWidths=[150, 150])
    t_total.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (1,1), 0.5, colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (0,2), (1,2), colors.HexColor('#f0f9ff')),
        ('BOX', (0,2), (1,2), 1, colors.HexColor('#bae6fd')),
        ('TOPPADDING', (0,2), (1,2), 12),
        ('BOTTOMPADDING', (0,2), (1,2), 12),
    ]))
    
    # Position total block on the right-ish side by padding left
    t_total_container = Table([[Spacer(1,1), t_total]], colWidths=[220, 300])
    t_total_container.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT')
    ]))
    
    elements.append(t_total_container)
    elements.append(Spacer(1, 40))
    
    # Footer Notice
    footer_text = ParagraphStyle(
        'FooterNotice',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=12,
        textColor=colors.HexColor('#94a3b8'),
        alignment=1 # Centered
    )
    elements.append(Paragraph("Thank you for using our Object Storage SaaS service. If you have any questions, please contact billing-support@saasbox.com.", footer_text))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


@app.get("/invoice/download")
def download_invoice(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    if current_user.plan == "Free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invoice generation is available only for Pro and Enterprise users."
        )
    invoice_data = _compute_invoice_data(current_user.id)
    pdf_buffer = generate_pdf_invoice(invoice_data)
    filename = f"invoice_{invoice_data['invoice_id']}.pdf"

    # Log invoice download action
    log_audit_event(
        user=current_user,
        action="Invoice Download",
        resource_type="Invoice",
        resource_name=filename,
        description=f"Downloaded invoice: {filename}",
        request=request
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("billing_engine")


def create_audit_log(action: str, filename: str, user_email: str):
    """Write an entry to console logger, local file, and database audit_logs table."""
    timestamp = datetime.utcnow()
    # 1. Console log
    logger.info(f"AUDIT LOG: Action: {action}, Filename: {filename}, User: {user_email}, Timestamp: {timestamp}")
    
    # 2. File log (audit.log in app root)
    try:
        with open("audit.log", "a", encoding="utf-8") as f:
            f.write(f"Timestamp: {timestamp} | Action: {action} | Filename: {filename} | User: {user_email}\n")
    except Exception as e:
        logger.error(f"Failed to write to audit.log file: {e}")
        
    # 3. Database log
    try:
        from database import SessionLocal
        with SessionLocal() as db:
            log_entry = AuditLog(
                action=action,
                filename=filename,
                user_email=user_email,
                timestamp=timestamp
            )
            db.add(log_entry)
            db.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log to database: {e}")


def invalidate_user_cache(user_id: int):
    """Scan and invalidate cached entries in Redis for the user if Redis is available."""
    keys_to_delete = [
        f"summary:{user_id}",
        f"forecast:{user_id}",
        f"analytics:{user_id}",
        f"invoice:{user_id}",
        f"recommend:{user_id}",
    ]
    for key in keys_to_delete:
        redis_client.delete_cache(key)


def get_file_stream_and_size(filename: str):
    """Retrieve a file stream and its size. Abstraction layer for GCS/Local switch."""
    if not storage_provider.file_exists(filename):
        return None, 0
    try:
        size = storage_provider.get_file_size(filename)
        stream = storage_provider.download_file(filename)
        return stream, size
    except Exception as e:
        logger.error(f"Error streaming file {filename}: {e}")
        return None, 0


@app.get("/download/{file_id}")
@app.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Securely download/stream an uploaded file by ID, abstracted for future S3 integration."""
    check_rate_limit(
        key=f"rate:download:{current_user.id}",
        limit=60,
        period=60,
        request=request,
        endpoint="/download",
        user_email=current_user.email
    )
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT filename, filesize, user_id, original_filename, storage_filename FROM usage_logs WHERE id = :id"),
            {"id": file_id}
        )
        file_row = result.fetchone()

    if not file_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found."
        )

    filename = file_row[0]
    owner_id = file_row[2]
    original_filename = file_row[3] or filename
    storage_filename = file_row[4] or filename

    # Check authorization: owner ONLY (Admin must NEVER download customer files)
    if current_user.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. Only the owner can download this file."
        )

    stream, size = get_file_stream_and_size(storage_filename)
    if not stream:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical file not found on storage."
        )

    # Increment download counter for usage analytics / optimization tracking
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE usage_logs SET download_count = COALESCE(download_count, 0) + 1, last_downloaded_at = :now WHERE id = :id"),
            {"id": file_id, "now": datetime.utcnow()}
        )
        conn.commit()

    try:
        request_id = getattr(request.state, "request_id", None)
        ip_address = request.client.host if request.client else "unknown"
        from bandwidth_service import BandwidthService
        BandwidthService.log_bandwidth_async(
            user_id=current_user.id,
            file_id=file_id,
            operation="DOWNLOAD",
            bytes_transferred=size,
            ip_address=ip_address,
            request_id=request_id
        )
    except Exception as e:
        print(f"Failed to log download bandwidth: {e}")

    return StreamingResponse(
        stream,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{original_filename}"',
            "Content-Length": str(size)
        }
    )


@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Securely delete a file and associated records, and recalculate usage limits."""
    # 1. Fetch file record from usage_logs database table
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT filename, filesize, user_id, original_filename, storage_filename FROM usage_logs WHERE id = :id"),
            {"id": file_id}
        )
        file_row = result.fetchone()

    # 2. Check if file exists in the database
    if not file_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found."
        )

    filename = file_row[0]
    filesize = file_row[1]
    owner_id = file_row[2]
    original_filename = file_row[3] or filename
    storage_filename = file_row[4] or filename

    # 3. Check authorization: owner or Admin
    is_admin = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "role", "").lower() == "admin"
        or current_user.plan == "Admin"
        or "admin" in current_user.email.lower()
    )
    if not is_admin and current_user.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. You do not own this file."
        )

    # 4. Remove file from storage provider
    try:
        if storage_provider.file_exists(storage_filename):
            storage_provider.delete_file(storage_filename)
    except Exception as e:
        logger.error(f"Failed to delete stored file {storage_filename}: {e}")

    # 5. Delete its database record
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM usage_logs WHERE id = :id"),
            {"id": file_id}
        )
        conn.commit()

    # 6. Recalculate Total Storage Used and Total Cost
    with engine.connect() as conn:
        res = conn.execute(
            text("SELECT SUM(filesize) FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": owner_id}
        )
        updated_storage = int(res.scalar() or 0)

    # Get owner's plan for rate calculation
    from database import SessionLocal
    with SessionLocal() as db_session:
        owner = db_session.query(User).filter(User.id == owner_id).first()
        owner_plan = owner.plan if owner else "Free"

    rates = {
        "Free": 0.0,
        "Pro": 2.0,
        "Enterprise": 1.5
    }
    rate = rates.get(owner_plan, 2.0)
    updated_cost = (updated_storage / (1024 * 1024)) * rate
    updated_cost = round(updated_cost, 2)

    # 7. Invalidate Redis Cache (if Redis exists and works)
    invalidate_user_cache(owner_id)

    # 8. Create Audit Log entries
    create_audit_log(
        action="DELETE_FILE",
        filename=original_filename,
        user_email=current_user.email
    )
    log_audit_event(
        user=current_user,
        action="File Delete",
        resource_type="File",
        resource_name=original_filename,
        description=f"Deleted file: {original_filename}",
        request=request
    )

    return {
        "message": "File deleted successfully.",
        "updated_storage": updated_storage,
        "updated_cost": updated_cost
    }


@app.post("/files/{file_id}/compress")
def compress_file(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """ZIP compress a file, create a new record in usage_logs, and keep original intact."""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT filename, filesize, user_id, original_filename, storage_filename FROM usage_logs WHERE id = :id"),
            {"id": file_id}
        )
        file_row = result.fetchone()

    if not file_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found."
        )

    filename = file_row[0]
    filesize = file_row[1]
    owner_id = file_row[2]
    original_filename = file_row[3] or filename
    storage_filename = file_row[4] or filename

    if current_user.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. You do not own this file."
        )

    if not storage_provider.file_exists(storage_filename):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical file not found on storage."
        )

    import zipfile
    import tempfile
    import uuid
    import shutil

    zip_original_filename = original_filename + ".zip"
    safe_zip_original = sanitize_filename(zip_original_filename)
    unique_id = str(uuid.uuid4())
    zip_storage_filename = f"{current_user.id}_{unique_id}_{safe_zip_original}"
    
    base, ext = os.path.splitext(zip_storage_filename)
    orig_base, orig_ext = os.path.splitext(zip_original_filename)
    counter = 1
    while storage_provider.file_exists(zip_storage_filename):
        zip_storage_filename = f"{base}_{counter}{ext}"
        zip_original_filename = f"{orig_base}_{counter}{orig_ext}"
        counter += 1

    temp_orig_fd, temp_orig_path = tempfile.mkstemp()
    temp_zip_fd, temp_zip_path = tempfile.mkstemp()
    try:
        # Download original to temp file
        with os.fdopen(temp_orig_fd, "wb") as f_orig:
            stream = storage_provider.download_file(storage_filename)
            shutil.copyfileobj(stream, f_orig)

        # Create zip at temp zip path
        with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(temp_orig_path, arcname=original_filename)

        zip_size = os.path.getsize(temp_zip_path)

        # Calculate zip SHA-256
        sha256 = hashlib.sha256()
        with open(temp_zip_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        zip_hash = sha256.hexdigest()

        # Upload zip to active storage provider
        with open(temp_zip_path, "rb") as f_upload:
            storage_provider.upload_file(f_upload, zip_storage_filename)

    except Exception as e:
        logger.error(f"Failed to compress file {original_filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compress file."
        )
    finally:
        for path in (temp_orig_path, temp_zip_path):
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass

    user_plan = current_user.plan
    # Increment Redis hashes generated count
    try:
        redis_client._get_client().incr("wecloud:integrity:hashes_generated")
    except Exception:
        pass

    with engine.connect() as conn:
        conn.execute(
            text(
                "INSERT INTO usage_logs (filename, original_filename, storage_filename, filesize, plan, user_id, sha256_hash, download_count, storage_class, mime_type, integrity_status) "
                "VALUES (:filename, :original_filename, :storage_filename, :filesize, :plan, :user_id, :sha256_hash, 0, 'STANDARD', 'application/zip', 'VERIFIED')"
            ),
            {
                "filename": zip_original_filename,
                "original_filename": zip_original_filename,
                "storage_filename": zip_storage_filename,
                "filesize": zip_size,
                "plan": user_plan,
                "user_id": current_user.id,
                "sha256_hash": zip_hash,
            }
        )
        conn.commit()

    invalidate_user_cache(current_user.id)

    log_audit_event(
        user=current_user,
        action="File Compression",
        resource_type="File",
        resource_name=zip_original_filename,
        description=f"Compressed file {original_filename} ({format_bytes_py(filesize)}) to {zip_original_filename} ({format_bytes_py(zip_size)})",
        request=request
    )

    return {
        "message": "File compressed successfully",
        "original_filename": original_filename,
        "compressed_filename": zip_original_filename,
        "compressed_size": zip_size,
    }


@app.post("/files/{file_id}/archive")
def archive_file(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Archiving mock action: updates database storage class to GLACIER."""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT filename, user_id, original_filename FROM usage_logs WHERE id = :id"),
            {"id": file_id}
        )
        file_row = result.fetchone()

    if not file_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found."
        )

    filename = file_row[0]
    owner_id = file_row[1]
    original_filename = file_row[2] or filename

    if current_user.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. You do not own this file."
        )

    with engine.connect() as conn:
        conn.execute(
            text("UPDATE usage_logs SET storage_class = 'GLACIER' WHERE id = :id"),
            {"id": file_id}
        )
        conn.commit()

    invalidate_user_cache(current_user.id)

    log_audit_event(
        user=current_user,
        action="File Archiving",
        resource_type="File",
        resource_name=original_filename,
        description=f"Archived file {original_filename} to AWS S3 Glacier",
        request=request
    )

    return {
        "message": f"File {original_filename} has been archived successfully to S3 Glacier.",
        "storage_class": "GLACIER"
    }


@app.post("/logout")
def logout(current_user: User = Depends(get_current_user), request: Request = None):
    log_audit_event(
        user=current_user,
        action="Logout",
        resource_type="User Session",
        resource_name=current_user.email,
        description="User logged out successfully.",
        request=request
    )
    return {"message": "Logged out successfully."}


@app.get("/audit-logs")
def get_audit_logs(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    action: str = None,
    start_date: str = None,
    end_date: str = None,
    sort_by: str = "Newest",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve the current user's audit logs, sorted newest first by default."""
    query = db.query(AuditLog).filter(AuditLog.user_id == current_user.id)

    # Search: partial matches on resource_name, description, or action
    if search:
        search_pat = f"%{search}%"
        query = query.filter(
            (AuditLog.resource_name.ilike(search_pat)) |
            (AuditLog.description.ilike(search_pat)) |
            (AuditLog.action.ilike(search_pat))
        )

    # Action filter
    if action and action != "All":
        query = query.filter(AuditLog.action == action)

    # Date range filters
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(AuditLog.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            # If date only, make it end of day
            if len(end_date) == 10:
                end_dt = datetime.fromisoformat(end_date + "T23:59:59.999999")
            query = query.filter(AuditLog.created_at <= end_dt)
        except ValueError:
            pass

    # Sort
    if sort_by == "Oldest":
        query = query.order_by(AuditLog.created_at.asc())
    else:
        query = query.order_by(AuditLog.created_at.desc())

    # Pagination
    total_items = query.count()
    total_pages = (total_items + limit - 1) // limit if total_items > 0 else 1
    
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    return {
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_name": log.resource_name,
                "description": log.description,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at.isoformat() if log.created_at else None
            } for log in items
        ],
        "page": page,
        "limit": limit,
        "total_items": total_items,
        "total_pages": total_pages
    }


# ---------------------------------------------------------------------------
# Storage Optimization Endpoints
# ---------------------------------------------------------------------------

def _compute_optimization_report(files: list, plan: str, total_limit_bytes: int) -> dict:
    """
    Pure metadata analysis — never reads file contents.
    Works on a list of dicts with keys: id, filename, filesize, uploaded_at, sha256_hash, download_count, last_downloaded_at, storage_class.
    """
    from collections import defaultdict

    now = datetime.utcnow()
    total_used = sum(f["filesize"] for f in files)
    usage_pct = (total_used / total_limit_bytes * 100) if total_limit_bytes > 0 else 0

    # --- Large files (> 100 MB) ---
    LARGE_THRESHOLD = 100 * 1024 * 1024
    large_files = sorted(
        [f for f in files if f["filesize"] >= LARGE_THRESHOLD],
        key=lambda x: x["filesize"], reverse=True
    )

    # --- Inactive files (days since last download, or since upload if never downloaded) ---
    def days_inactive(f):
        last_dl = f.get("last_downloaded_at")
        if last_dl:
            if isinstance(last_dl, str):
                last_dl = datetime.fromisoformat(last_dl)
            return (now - last_dl).days
        else:
            uploaded = f["uploaded_at"]
            if isinstance(uploaded, str):
                uploaded = datetime.fromisoformat(uploaded)
            return (now - uploaded).days

    # Filter out files already archived to S3 Glacier
    active_files = [f for f in files if f.get("storage_class") != "GLACIER"]

    inactive_30  = [f for f in active_files if days_inactive(f) >= 30]
    inactive_90  = [f for f in active_files if days_inactive(f) >= 90]
    inactive_180 = [f for f in active_files if days_inactive(f) >= 180]

    # --- Duplicates by SHA-256 ---
    hash_groups = defaultdict(list)
    for f in files:
        h = f.get("sha256_hash")
        if h:
            hash_groups[h].append(f)
    duplicate_groups = [
        {
            "hash": h,
            "files": grp,
            "wasted_bytes": sum(x["filesize"] for x in grp) - max(x["filesize"] for x in grp),
        }
        for h, grp in hash_groups.items() if len(grp) > 1
    ]
    duplicate_savings = sum(g["wasted_bytes"] for g in duplicate_groups)
    total_dup_files = sum(len(g["files"]) for g in duplicate_groups) - len(duplicate_groups)

    # --- Compressible Files ---
    COMPRESSIBLE_EXTS = {".txt", ".csv", ".json", ".xml", ".log", ".md"}
    compressible_files = []
    compressible_savings = 0

    for f in files:
        ext = os.path.splitext(f["filename"].lower())[1]
        size = f["filesize"]
        # Skip if already compressed or archived
        if f.get("storage_class") == "GLACIER":
            continue
        if ext in {".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz"}:
            continue
        
        is_compressible = False
        ratio = 0.0
        if ext in COMPRESSIBLE_EXTS:
            is_compressible = True
            ratio = 0.25 if ext in {".txt", ".csv", ".log", ".md"} else 0.30
        elif ext == ".pdf" and size >= 10 * 1024 * 1024:
            is_compressible = True
            ratio = 0.65 # 35% savings

        if is_compressible:
            est_comp_size = int(size * ratio)
            est_savings = size - est_comp_size
            compressible_files.append({
                "id": f["id"],
                "filename": f["filename"],
                "filesize": size,
                "uploaded_at": f["uploaded_at"],
                "last_downloaded_at": f.get("last_downloaded_at"),
                "storage_class": f.get("storage_class") or "STANDARD",
                "est_compressed_size": est_comp_size,
                "est_space_saving": est_savings,
            })
            compressible_savings += est_savings

    # --- File type distribution ---
    IMAGE_EXT  = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".ico"}
    VIDEO_EXT  = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v"}
    DOC_EXT    = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".odt"}
    ARCHIVE_EXT= {".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz"}

    dist = {"Images": 0, "Videos": 0, "Documents": 0, "Archives": 0, "Other": 0}
    for f in files:
        ext = os.path.splitext(f["filename"].lower())[1]
        if ext in IMAGE_EXT:
            dist["Images"] += f["filesize"]
        elif ext in VIDEO_EXT:
            dist["Videos"] += f["filesize"]
        elif ext in DOC_EXT:
            dist["Documents"] += f["filesize"]
        elif ext in ARCHIVE_EXT:
            dist["Archives"] += f["filesize"]
        else:
            dist["Other"] += f["filesize"]

    # --- Unused files ---
    unused_files = [f for f in files if (f.get("download_count") or 0) == 0]

    # --- Health score calculation ---
    util_penalty = 0
    if usage_pct > 90:
        util_penalty = 30
    elif usage_pct > 75:
        util_penalty = 15

    dup_penalty = min(20, total_dup_files * 4)
    inactive_penalty = min(15, len(inactive_180) * 3 + len(inactive_90) * 1.5)
    large_penalty = min(15, len(large_files) * 3)
    compressible_penalty = min(20, len(compressible_files) * 2)

    health_score = max(0, min(100, 100 - (util_penalty + dup_penalty + inactive_penalty + large_penalty + compressible_penalty)))

    # --- Smart recommendations ---
    recs = []

    if usage_pct >= 90:
        recs.append({
            "id": "storage_critical",
            "icon": "alert-circle",
            "severity": "critical",
            "title": f"Storage critically full ({usage_pct:.0f}% used)",
            "description": f"Your storage utilization exceeds 90% of your plan quota. Upgrade or delete files immediately.",
            "savings_bytes": 0,
            "action": "upgrade",
            "action_label": "Upgrade Plan",
        })
    elif usage_pct >= 75:
        recs.append({
            "id": "storage_warning",
            "icon": "alert-triangle",
            "severity": "warning",
            "title": f"Storage usage at {usage_pct:.0f}%",
            "description": f"You are using {usage_pct:.1f}% of your storage quota. Consider clean-up recommendations.",
            "savings_bytes": 0,
            "action": "view_files",
            "action_label": "View Files",
        })

    if total_dup_files > 0:
        recs.append({
            "id": "duplicates",
            "icon": "copy",
            "severity": "warning",
            "title": f"You have {total_dup_files} duplicate files",
            "description": f"You can save {format_bytes_py(duplicate_savings)} by deleting duplicates.",
            "savings_bytes": duplicate_savings,
            "action": "view_duplicates",
            "action_label": "Review Duplicates",
        })

    if len(compressible_files) > 0:
        recs.append({
            "id": "compressible",
            "icon": "hard-drive",
            "severity": "info",
            "title": f"{len(compressible_files)} compressible text files",
            "description": f"Compressing these text files could save approximately {format_bytes_py(compressible_savings)}.",
            "savings_bytes": compressible_savings,
            "action": "view_compressible",
            "action_label": "Review Compressible",
        })

    if len(inactive_180) > 0:
        recs.append({
            "id": "old_180",
            "icon": "clock",
            "severity": "info",
            "title": f"{len(inactive_180)} inactive files (>180 days)",
            "description": f"These inactive files have not been accessed for over 180 days. Transitioning them to Glacier saves space.",
            "savings_bytes": sum(f["filesize"] for f in inactive_180),
            "action": "view_old",
            "action_label": "Review Inactive Files",
        })

    total_potential_savings = duplicate_savings + compressible_savings

    def fmt_file(f):
        uploaded = f["uploaded_at"]
        if hasattr(uploaded, "isoformat"):
            uploaded = uploaded.isoformat()
        last_dl = f.get("last_downloaded_at")
        if hasattr(last_dl, "isoformat"):
            last_dl = last_dl.isoformat()
        return {
            "id": f["id"],
            "filename": f["filename"],
            "filesize": f["filesize"],
            "uploaded_at": uploaded,
            "sha256_hash": f.get("sha256_hash"),
            "download_count": f.get("download_count") or 0,
            "last_downloaded_at": last_dl,
            "storage_class": f.get("storage_class") or "STANDARD",
            "days_inactive": days_inactive(f),
            "storage_filename": f.get("storage_filename"),
            "mime_type": f.get("mime_type") or "application/octet-stream",
            "integrity_status": f.get("integrity_status") or "VERIFIED"
        }

    return {
        "health_score": health_score,
        "total_files": len(files),
        "total_used_bytes": total_used,
        "total_limit_bytes": total_limit_bytes,
        "usage_pct": round(usage_pct, 1),
        "potential_savings_bytes": total_potential_savings,
        "large_files": [fmt_file(f) for f in large_files],
        "old_files": {
            "days_30": [fmt_file(f) for f in inactive_30],
            "days_90": [fmt_file(f) for f in inactive_90],
            "days_180": [fmt_file(f) for f in inactive_180],
        },
        "duplicate_groups": [
            {
                "hash": g["hash"],
                "wasted_bytes": g["wasted_bytes"],
                "files": [fmt_file(f) for f in g["files"]],
            }
            for g in duplicate_groups
        ],
        "compressible_files": [
            {
                **fmt_file(c),
                "est_compressed_size": c["est_compressed_size"],
                "est_space_saving": c["est_space_saving"],
            }
            for c in compressible_files
        ],
        "file_type_distribution": dist,
        "unused_files": [fmt_file(f) for f in unused_files],
        "recommendations": recs,
    }


@app.get("/storage-optimization")
def get_storage_optimization(current_user: User = Depends(get_current_user)):
    """Return full storage optimization analysis for the current user based on stored metadata."""
    storage_limits = {
        "Free": 5 * 1024 * 1024 * 1024,
        "Pro": 100 * 1024 * 1024 * 1024,
        "Enterprise": 5 * 1024 * 1024 * 1024 * 1024,
    }
    limit = storage_limits.get(current_user.plan, 5 * 1024 * 1024 * 1024)

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, filename, filesize, uploaded_at, sha256_hash, download_count, last_downloaded_at, storage_class, original_filename, storage_filename, mime_type, integrity_status FROM usage_logs WHERE user_id = :uid"),
            {"uid": current_user.id}
        )
        rows = result.fetchall()

    files = [
        {
            "id": r[0], "filename": r[8] or r[1], "filesize": r[2],
            "uploaded_at": r[3], "sha256_hash": r[4], "download_count": r[5],
            "last_downloaded_at": r[6], "storage_class": r[7], "storage_filename": r[9] or r[1],
            "mime_type": r[10], "integrity_status": r[11]
        }
        for r in rows
    ]
    return _compute_optimization_report(files, current_user.plan, limit)


# ---------------------------------------------------------------------------
# Admin Dashboard & User / File Management RBAC Endpoints
# ---------------------------------------------------------------------------

# get_current_admin is defined above for route registration order


@app.get("/admin/dashboard-cards")
def get_admin_dashboard_cards(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Retrieve key stats for the Admin Dashboard overview."""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    
    with engine.connect() as conn:
        usage_stats = conn.execute(
            text("SELECT SUM(filesize), COUNT(id) FROM usage_logs")
        ).fetchone()
        
    storage_used = usage_stats[0] or 0
    files_uploaded = usage_stats[1] or 0
    
    # Calculate revenue
    with engine.connect() as conn:
        res = conn.execute(text("SELECT filesize, plan FROM usage_logs"))
        rows = res.fetchall()
        
    revenue = 0.0
    rates = {"Free": 0.0, "Pro": 2.0, "Enterprise": 1.5}
    for row in rows:
        filesize = row[0] or 0
        plan = row[1] or "Free"
        rate = rates.get(plan, 2.0)
        revenue += (filesize / (1024 * 1024)) * rate

    free_users = db.query(User).filter(User.plan == "Free").count()
    pro_users = db.query(User).filter(User.plan == "Pro").count()
    enterprise_users = db.query(User).filter(User.plan == "Enterprise").count()
    
    verified_users = db.query(User).filter(User.email_verified == True).count()
    pending_verification = db.query(User).filter(User.email_verified == False).count()
    
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_uploads = db.query(UsageLog).filter(UsageLog.uploaded_at >= today_start).count()
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "storage_used": storage_used,
        "files_uploaded": files_uploaded,
        "revenue": round(revenue, 2),
        "free_users": free_users,
        "pro_users": pro_users,
        "enterprise_users": enterprise_users,
        "verified_users": verified_users,
        "pending_verification": pending_verification,
        "today_uploads": today_uploads
    }


@app.get("/admin/security-stats")
def get_security_stats(
    current_admin: User = Depends(get_current_admin)
):
    """Retrieve security rate limit stats from Redis."""
    client = redis_client._get_client()
    if not client:
        return {
            "blocked_requests_today": 0,
            "rate_limited_requests": 0,
            "most_targeted_endpoint": "N/A",
            "top_blocked_ips": []
        }

    try:
        import time
        # Get blocked today
        today_str = time.strftime("%Y-%m-%d")
        blocked_today = int(client.get(f"rate:stats:blocked_today:{today_str}") or 0)
        
        # Get total blocked requests
        total_blocked = int(client.get("rate:stats:blocked_requests") or 0)
        
        # Get most targeted endpoint
        endpoints = client.hgetall("rate:stats:endpoints")
        most_targeted = "N/A"
        if endpoints:
            most_targeted = max(endpoints, key=lambda k: int(endpoints[k]))
            
        # Get top blocked IPs
        blocked_ips_raw = client.zrevrange("rate:stats:blocked_ips", 0, 4, withscores=True)
        top_ips = [{"ip": ip, "count": int(score)} for ip, score in blocked_ips_raw]

        return {
            "blocked_requests_today": blocked_today,
            "rate_limited_requests": total_blocked,
            "most_targeted_endpoint": most_targeted,
            "top_blocked_ips": top_ips
        }
    except Exception as exc:
        return {
            "blocked_requests_today": 0,
            "rate_limited_requests": 0,
            "most_targeted_endpoint": "Error",
            "top_blocked_ips": []
        }



@app.get("/admin/storage-optimization")
def get_admin_storage_optimization(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Aggregated storage optimization statistics across all users for admin view."""
    storage_limits = {
        "Free": 5 * 1024 * 1024 * 1024,
        "Pro": 100 * 1024 * 1024 * 1024,
        "Enterprise": 5 * 1024 * 1024 * 1024 * 1024,
    }

    all_users_db = db.query(User).filter(User.is_active == True).all()
    all_users = {u.id: u.plan for u in all_users_db}
    all_users_meta = {u.id: {"name": u.name, "email": u.email} for u in all_users_db}

    with engine.connect() as conn:
        files_res = conn.execute(
            text("SELECT id, user_id, filename, filesize, uploaded_at, sha256_hash, download_count, last_downloaded_at, storage_class, original_filename, storage_filename, mime_type, integrity_status FROM usage_logs")
        )
        all_rows = files_res.fetchall()

    from collections import defaultdict

    user_files: dict = defaultdict(list)
    for r in all_rows:
        user_files[r[1]].append({
            "id": r[0], "filename": r[9] or r[2], "filesize": r[3],
            "uploaded_at": r[4], "sha256_hash": r[5], "download_count": r[6],
            "last_downloaded_at": r[7], "storage_class": r[8], "storage_filename": r[10] or r[2],
            "mime_type": r[11], "integrity_status": r[12]
        })

    total_potential_savings = 0
    total_large_files = 0
    total_dup_groups = 0
    total_dup_files = 0
    total_unused = 0
    plan_health: dict = {}
    largest_users = []

    for uid, plan in all_users.items():
        files = user_files.get(uid, [])
        limit = storage_limits.get(plan, storage_limits["Free"])
        report = _compute_optimization_report(files, plan, limit)
        
        total_potential_savings += report["potential_savings_bytes"]
        total_large_files += len(report["large_files"])
        total_dup_groups += len(report["duplicate_groups"])
        
        # Count all duplicate files (each group has N files, meaning N - 1 duplicates)
        dup_in_user = sum(len(g["files"]) for g in report["duplicate_groups"])
        total_dup_files += dup_in_user

        total_unused += len(report["unused_files"])
        plan_health.setdefault(plan, []).append(report["health_score"])

        user_storage = sum(f["filesize"] for f in files)
        largest_users.append({
            "id": uid,
            "name": all_users_meta.get(uid, {}).get("name", "Unknown"),
            "email": all_users_meta.get(uid, {}).get("email", "Unknown"),
            "plan": plan,
            "storage_used": user_storage,
            "health_score": report["health_score"]
        })

    largest_users = sorted(largest_users, key=lambda x: x["storage_used"], reverse=True)[:10]

    avg_health_by_plan = {
        p: round(sum(scores) / len(scores)) for p, scores in plan_health.items() if scores
    }

    all_scores = [s for scores in plan_health.values() for s in scores]
    platform_health = round(sum(all_scores) / len(all_scores)) if all_scores else 100

    IMAGE_EXT   = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".ico"}
    VIDEO_EXT   = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v"}
    DOC_EXT     = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".odt"}
    ARCHIVE_EXT = {".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz"}
    dist = {"Images": 0, "Videos": 0, "Documents": 0, "Archives": 0, "Other": 0}
    for r in all_rows:
        ext = os.path.splitext(r[2].lower())[1]
        size = r[3]
        if ext in IMAGE_EXT: dist["Images"] += size
        elif ext in VIDEO_EXT: dist["Videos"] += size
        elif ext in DOC_EXT: dist["Documents"] += size
        elif ext in ARCHIVE_EXT: dist["Archives"] += size
        else: dist["Other"] += size

    return {
        "platform_health_score": platform_health,
        "avg_health_by_plan": avg_health_by_plan,
        "total_potential_savings_bytes": total_potential_savings,
        "total_large_files": total_large_files,
        "total_duplicate_groups": total_dup_groups,
        "total_duplicate_files": total_dup_files,
        "total_unused_files": total_unused,
        "total_files": len(all_rows),
        "file_type_distribution": dist,
        "largest_users": largest_users,
    }


@app.get("/admin/users")
def get_admin_users(
    verified: bool = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """List all registered users with their plan and storage statistics, supporting verification filter."""
    query = db.query(User)
    if verified is not None:
        query = query.filter(User.email_verified == verified)
    users = query.order_by(User.created_at.desc()).all()
    
    result = []
    for u in users:
        with engine.connect() as conn:
            stats = conn.execute(
                text("SELECT SUM(filesize), COUNT(id) FROM usage_logs WHERE user_id = :user_id"),
                {"user_id": u.id}
            ).fetchone()
        storage_used = stats[0] or 0
        files_uploaded = stats[1] or 0
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "plan": u.plan,
            "role": u.role,
            "is_active": u.is_active,
            "email_verified": u.email_verified,
            "created_at": u.created_at.isoformat(),
            "storage_used": storage_used,
            "files_uploaded": files_uploaded
        })
    return result


@app.post("/admin/users/{user_id}/suspend")
def suspend_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Suspend or unsuspend a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot suspend yourself.")
        
    user.is_active = not user.is_active
    db.add(user)
    db.commit()
    
    # Invalidate their Redis caching session
    invalidate_user_cache(user.id)
    
    # Audit log
    log_audit_event(
        user=current_admin,
        action="User Suspension Toggle",
        resource_type="User Account",
        resource_name=user.email,
        description=f"User {user.email} active status toggled to {user.is_active}",
        request=None
    )
    
    return {"message": f"User active status toggled to {user.is_active}", "is_active": user.is_active}


@app.post("/admin/users/{user_id}/change-plan")
def admin_change_plan(
    user_id: int,
    payload: UpgradeRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Administratively change a user's subscription plan."""
    if payload.plan not in ["Free", "Pro", "Enterprise"]:
        raise HTTPException(status_code=400, detail="Invalid plan name.")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    old_plan = user.plan
    user.plan = payload.plan
    db.add(user)
    db.commit()
    
    # Invalidate their Redis caching session
    invalidate_user_cache(user.id)
    
    # Audit log
    log_audit_event(
        user=current_admin,
        action="Admin Plan Override",
        resource_type="User Profile",
        resource_name=user.email,
        description=f"User plan updated from {old_plan} to {payload.plan} by Admin.",
        request=None
    )
    
    return {"message": f"User plan changed to {user.plan}", "plan": user.plan}


@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a user along with all their uploads and logs."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself.")

    # Remove files from storage provider
    with engine.connect() as conn:
        res = conn.execute(
            text("SELECT COALESCE(storage_filename, filename) FROM usage_logs WHERE user_id = :user_id"),
            {"user_id": user.id}
        )
        filenames = [r[0] for r in res.fetchall()]
        
    for fname in filenames:
        try:
            if storage_provider.file_exists(fname):
                storage_provider.delete_file(fname)
        except Exception:
            pass

    # Clear records
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM usage_logs WHERE user_id = :user_id"), {"user_id": user.id})
        conn.execute(text("DELETE FROM audit_logs WHERE user_id = :user_id"), {"user_id": user.id})
        conn.commit()

    db.delete(user)
    db.commit()
    invalidate_user_cache(user.id)
    
    # Audit log
    log_audit_event(
        user=current_admin,
        action="Admin User Delete",
        resource_type="User Account",
        resource_name=user.email,
        description=f"User account for {user.email} and all data purged from system.",
        request=None
    )
    
    return {"message": "User deleted successfully."}


@app.post("/admin/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Administratively reset a user's password to a secure temporary one."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot reset your own password.")

    # Generate a secure 12-character temporary password
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    temp_password = "".join(secrets.choice(alphabet) for _ in range(12))

    # Hash and update password
    user.password_hash = hash_password(temp_password)
    db.add(user)
    db.commit()

    # Invalidate cache
    invalidate_user_cache(user.id)

    # Audit log
    log_audit_event(
        user=current_admin,
        action="Admin Password Reset",
        resource_type="User Account",
        resource_name=user.email,
        description=f"Admin reset password for user {user.email}.",
        request=None
    )

    return {
        "message": f"Password reset successfully for {user.email}",
        "temp_password": temp_password
    }


@app.get("/admin/files")
def get_admin_files(
    current_admin: User = Depends(get_current_admin)
):
    """Retrieve metadata of all files uploaded by customers. NEVER returns raw file contents."""
    with engine.connect() as conn:
        res = conn.execute(text(
            "SELECT ul.id, COALESCE(ul.original_filename, ul.filename) AS filename, ul.filesize, ul.uploaded_at, ul.plan, u.email "
            "FROM usage_logs ul "
            "LEFT JOIN users u ON ul.user_id = u.id "
            "ORDER BY ul.uploaded_at DESC"
        ))
        rows = res.fetchall()
        
    return [
        {
            "id": r[0],
            "filename": r[1],
            "filesize": r[2],
            "uploaded_at": r[3].isoformat() if r[3] else None,
            "plan": r[4],
            "owner_email": r[5] or "N/A"
        } for r in rows
    ]


@app.get("/admin/audit-logs")
def get_admin_audit_logs(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    action: str = None,
    start_date: str = None,
    end_date: str = None,
    sort_by: str = "Newest",
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Retrieve audit logs across the entire platform."""
    query = db.query(AuditLog)
    
    if search:
        search_pat = f"%{search}%"
        query = query.filter(
            (AuditLog.resource_name.ilike(search_pat)) |
            (AuditLog.description.ilike(search_pat)) |
            (AuditLog.action.ilike(search_pat)) |
            (AuditLog.user_email.ilike(search_pat))
        )
        
    if action and action != "All":
        query = query.filter(AuditLog.action == action)
        
    if start_date:
        try:
            query = query.filter(AuditLog.created_at >= datetime.fromisoformat(start_date))
        except ValueError:
            pass
            
    if end_date:
        try:
            dt = datetime.fromisoformat(end_date)
            if len(end_date) == 10:
                dt = datetime.fromisoformat(end_date + "T23:59:59.999999")
            query = query.filter(AuditLog.created_at <= dt)
        except ValueError:
            pass

    if sort_by == "Oldest":
        query = query.order_by(AuditLog.created_at.asc())
    else:
        query = query.order_by(AuditLog.created_at.desc())

    total_items = query.count()
    total_pages = (total_items + limit - 1) // limit if total_items > 0 else 1
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    return {
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_email": log.user_email,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_name": log.resource_name,
                "description": log.description,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at.isoformat() if log.created_at else None
            } for log in items
        ],
        "page": page,
        "limit": limit,
        "total_items": total_items,
        "total_pages": total_pages
    }


@app.get("/admin/system-health")
def get_system_health(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Audit system dependencies health (Database, Redis, Local Storage, Forecasting)."""
    db_status = "Healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "Offline"

    redis_metrics = redis_client.get_redis_stats()
    redis_status = "Healthy" if redis_metrics["status"] == "Online" else "Offline"

    storage_status = "Healthy" if storage_provider.check_health() else "Degraded"

    forecast_status = "Healthy"
    try:
        res = predict_storage([10.0, 20.0, 30.0])
        if not res:
            forecast_status = "Degraded"
    except Exception:
        forecast_status = "Offline"

    return {
        "database": db_status,
        "redis": redis_status,
        "storage": storage_status,
        "forecast_engine": forecast_status,
        "redis_metrics": redis_metrics
    }


@app.post("/files/{file_id}/verify-integrity")
def verify_file_integrity(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT filename, storage_filename, sha256_hash, user_id, original_filename FROM usage_logs WHERE id = :id"),
            {"id": file_id}
        )
        row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="File not found")

    filename = row[0]
    storage_filename = row[1] or filename
    stored_hash = row[2]
    owner_id = row[3]
    original_filename = row[4] or filename

    # Check ownership or admin status
    is_admin = getattr(current_user, "role", "").lower() == "admin"
    if not is_admin and current_user.id != owner_id:
        raise HTTPException(status_code=403, detail="Forbidden. You do not own this file.")

    # Read file and compute hash
    status_res = "CORRUPTED"

    # Increment total hashes count in Redis
    try:
        r_client = redis_client._get_client()
        if r_client:
            r_client.incr("wecloud:integrity:hashes_generated")
    except Exception:
        pass

    if storage_provider.file_exists(storage_filename):
        sha256 = hashlib.sha256()
        try:
            stream = storage_provider.download_file(storage_filename)
            for chunk in iter(lambda: stream.read(8192), b""):
                sha256.update(chunk)
            computed_hash = sha256.hexdigest()
            if computed_hash == stored_hash:
                status_res = "VERIFIED"
        except Exception as e:
            logger.error(f"Error reading file for integrity check: {e}")

    # Update DB
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE usage_logs SET integrity_status = :status WHERE id = :id"),
            {"status": status_res, "id": file_id}
        )
        conn.commit()

    # Log audit event
    log_audit_event(
        user=current_user,
        action="Integrity Verification",
        resource_type="File",
        resource_name=original_filename,
        description=f"Verified integrity of {original_filename}. Status: {status_res}",
        request=request
    )

    return {"status": status_res}


@app.get("/admin/integrity-stats")
def get_admin_integrity_stats(
    current_admin: User = Depends(get_current_admin)
):
    with engine.connect() as conn:
        verified = conn.execute(text("SELECT COUNT(*) FROM usage_logs WHERE integrity_status = 'VERIFIED'")).scalar() or 0
        corrupted = conn.execute(text("SELECT COUNT(*) FROM usage_logs WHERE integrity_status = 'CORRUPTED'")).scalar() or 0

        # Duplicate count: find all files that share a hash with another file
        dups = conn.execute(text(
            "SELECT COUNT(id) FROM usage_logs "
            "WHERE sha256_hash IN ("
            "  SELECT sha256_hash FROM usage_logs "
            "  WHERE sha256_hash IS NOT NULL AND sha256_hash != '' "
            "  GROUP BY sha256_hash HAVING COUNT(*) > 1"
            ")"
        )).scalar() or 0

        total_files = conn.execute(text("SELECT COUNT(*) FROM usage_logs")).scalar() or 0

        # Retrieve corrupted list
        corrupted_list_res = conn.execute(text(
            "SELECT id, filename, original_filename, filesize, uploaded_at, plan, integrity_status "
            "FROM usage_logs WHERE integrity_status = 'CORRUPTED' ORDER BY uploaded_at DESC"
        )).fetchall()

    corrupted_list = [
        {
            "id": r[0],
            "filename": r[2] or r[1],
            "filesize": r[3],
            "uploaded_at": r[4].isoformat() if r[4] else None,
            "plan": r[5],
            "integrity_status": r[6]
        }
        for r in corrupted_list_res
    ]

    # Retrieve Redis count
    redis_hashes = 0
    try:
        r_client = redis_client._get_client()
        if r_client:
            redis_hashes = int(r_client.get("wecloud:integrity:hashes_generated") or 0)
    except Exception:
        pass

    total_hashes = max(total_files + redis_hashes, total_files)

    return {
        "verified_files": verified,
        "corrupted_files": corrupted,
        "duplicate_files": dups,
        "total_hashes_generated": total_hashes,
        "corrupted_list": corrupted_list
    }




