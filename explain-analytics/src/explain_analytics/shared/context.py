from typing import Any

from fastapi import Header, HTTPException


async def require_admin(x_user_role: str | None = Header(default=None)) -> None:
    """Enforce admin role from forwarded NestJS request headers."""
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


async def require_supervisor_or_admin(
    x_user_role: str | None = Header(default=None),
) -> None:
    """Allow supervisor or admin roles from forwarded NestJS request headers."""
    if x_user_role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Insufficient role")


async def get_request_context(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
    x_user_district: str | None = Header(default=None),
    x_request_id: str | None = Header(default=None),
) -> dict[str, Any]:
    """Extract forwarded user/request metadata for logging and traceability."""
    return {
        "user_id": x_user_id,
        "role": x_user_role,
        "district": x_user_district,
        "request_id": x_request_id,
    }
