"""将本地管理员绑定到已核实的统一身份；管理员不存在时创建。"""

import argparse
import logging

from sqlmodel import Session, select

from app.db import models  # noqa: F401
from app.db.session import engine
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def bind_admin(session: Session, username: str, auth_user_id: str) -> None:
    user = session.exec(select(User).where(User.username == username)).one_or_none()

    existing = session.exec(
        select(User).where(User.auth_user_id == auth_user_id)
    ).one_or_none()

    if existing is not None and (user is None or existing.id != user.id):
        raise ValueError("统一身份已绑定其他本地用户，拒绝自动合并")

    if user is None:
        user = User(username=username, is_superuser=True)
    elif not user.is_superuser or not user.is_active or user.deleted_at is not None:
        raise ValueError("目标必须是启用中的本地超级管理员")
    elif user.auth_user_id not in (None, auth_user_id):
        raise ValueError("管理员已绑定其他统一身份，拒绝覆盖")

    user.auth_user_id = auth_user_id

    session.add(user)

    session.commit()

    logger.info("管理员统一身份绑定完成")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument("--username", default="admin", help="本地管理员用户名，默认为 admin")

    parser.add_argument("--auth-user-id", required=True, help="已核实的统一用户 ID")

    args = parser.parse_args()

    if not args.auth_user_id.strip() or len(args.auth_user_id) > 255:
        parser.error("统一用户 ID 不能为空，且不能超过 255 个字符")

    with Session(engine) as session:
        bind_admin(session, args.username, args.auth_user_id)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
