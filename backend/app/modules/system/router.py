from fastapi import APIRouter, Depends
from pydantic.networks import EmailStr

from app.common.schemas import Message
from app.integrations.email.service import generate_test_email, send_email
from app.modules.auth.dependencies import get_current_active_superuser

router = APIRouter(prefix="/utils", tags=["utils"])


@router.post(
    "/test-email/",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=201,
)
def test_email(email_to: EmailStr) -> Message:
    """测试邮件发送。"""
    email_data = generate_test_email(email_to=email_to)
    send_email(
        email_to=email_to,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Test email sent")


@router.get("/health-check/")
async def health_check() -> bool:
    return True
