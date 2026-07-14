from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    """Request body for POST /register."""

    name: str
    email: EmailStr
    password: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("password must be at least 6 characters")
        return v


class UserResponse(BaseModel):
    """Response body returned after successful registration."""

    id: int
    name: str
    email: str
    plan: str = "Free"
    message: str = "User registered successfully"

    class Config:
        from_attributes = True


class UpgradeRequest(BaseModel):
    """Request body for upgrading subscription plan."""

    plan: str


class LoginRequest(BaseModel):
    """Request body for POST /login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response body returned after successful login."""

    access_token: str
    token_type: str = "bearer"


class VerifyEmailRequest(BaseModel):
    """Request body for POST /verify-email."""

    email: EmailStr
    otp: str


class ResendOTPRequest(BaseModel):
    """Request body for POST /resend-otp."""

    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """Request body for POST /forgot-password."""

    email: EmailStr

