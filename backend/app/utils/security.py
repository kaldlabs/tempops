"""
Security utilities for password hashing and JWT management.
Uses argon2-cffi for hashing and custom secure HS256 base64url implementation.
"""
import base64
import hashlib
import hmac
import json
import time
import logging
from typing import Optional, Dict, Any
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

logger = logging.getLogger(__name__)
ph = PasswordHasher()

def hash_password(password: str) -> str:
    """Hash password using Argon2."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    return ph.hash(password)

def verify_password(hashed: str, password: str) -> bool:
    """Verify password against Argon2 hash."""
    try:
        return ph.verify(hashed, password)
    except VerifyMismatchError:
        return False
    except Exception as e:
        logger.error("Error verifying password hash: %s", str(e))
        return False

def base64url_encode(data: bytes) -> str:
    """Base64url encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

def base64url_decode(data: str) -> bytes:
    """Base64url decode with automatic padding recovery."""
    padding = "=" * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def create_jwt_token(payload: Dict[str, Any], secret: str, expires_in_seconds: int = 3600) -> str:
    """
    Generate HS256 JWT token.
    Enforces algorithm HS256, sets and validates expiration.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    payload_copy = payload.copy()
    payload_copy["exp"] = int(time.time()) + expires_in_seconds

    header_b64 = base64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = base64url_encode(json.dumps(payload_copy).encode("utf-8"))

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(
        secret.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    signature_b64 = base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_jwt_token(token: str, secret: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode HS256 JWT token.
    Rejects 'none' algorithm and validates expiration.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts

        # Verify signature using compare_digest to prevent timing attacks
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_signature = hmac.new(
            secret.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        expected_signature_b64 = base64url_encode(expected_signature)

        if not hmac.compare_digest(
            signature_b64.encode("utf-8"), expected_signature_b64.encode("utf-8")
        ):
            logger.warning("JWT signature verification failed.")
            return None

        # Parse header to strictly enforce HS256
        header_json = base64url_decode(header_b64).decode("utf-8")
        header = json.loads(header_json)
        if header.get("alg") != "HS256":
            logger.warning("JWT algorithm is not HS256: %s", header.get("alg"))
            return None

        # Parse and verify payload expiration
        payload_json = base64url_decode(payload_b64).decode("utf-8")
        payload = json.loads(payload_json)
        
        # Verify exp claim exists and is not expired
        if "exp" not in payload:
            logger.warning("JWT is missing expiration claim.")
            return None
            
        if payload["exp"] < time.time():
            logger.warning("JWT token is expired.")
            return None

        return payload
    except Exception as e:
        logger.error("JWT verification encountered an exception: %s", str(e))
        return None
