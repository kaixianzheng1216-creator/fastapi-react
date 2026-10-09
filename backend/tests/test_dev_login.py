import unittest
from unittest.mock import MagicMock, patch

from pydantic import ValidationError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.core.config import Settings, settings
from app.modules.auth.dev_login import DEV_AUTH_USER_ID, create_dev_session
from app.modules.auth.exceptions import InvalidSessionError
from app.modules.auth.service import get_session_user, logout_session
from app.modules.auth.session import SessionStore
from app.modules.users.models import User


class DevLoginTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        User.__table__.create(self.engine)  # type: ignore[attr-defined]

        data: dict[str, str] = {}
        redis = MagicMock()
        redis.set.side_effect = lambda key, value, ex: data.__setitem__(key, value)
        redis.get.side_effect = lambda key: data.get(key)
        redis.delete.side_effect = lambda key: data.pop(key, None)
        self.store = SessionStore(redis)

    def test_local_user_uses_normal_session_without_remote_verification(self) -> None:
        auth = MagicMock()
        with patch.object(settings, "DEV_LOGIN_ENABLED", True), Session(self.engine) as db:
            user, session_id, ttl = create_dev_session(db, self.store, None)

            self.assertEqual(user.auth_user_id, DEV_AUTH_USER_ID)
            self.assertFalse(user.is_superuser)
            self.assertGreater(ttl, 0)
            self.assertEqual(
                get_session_user(
                    session_id=session_id, session=db, auth=auth, store=self.store
                ).id,
                user.id,
            )
            auth.verify.assert_not_called()

            logout_session(session_id=session_id, auth=auth, store=self.store)
            self.assertIsNone(self.store.read(session_id))
            auth.logout.assert_not_called()

    def test_local_session_is_rejected_when_feature_is_disabled(self) -> None:
        auth = MagicMock()
        with patch.object(settings, "DEV_LOGIN_ENABLED", True), Session(self.engine) as db:
            _, session_id, _ = create_dev_session(db, self.store, None)

            with patch.object(settings, "DEV_LOGIN_ENABLED", False):
                with self.assertRaises(InvalidSessionError):
                    get_session_user(
                        session_id=session_id, session=db, auth=auth, store=self.store
                    )

            self.assertIsNone(self.store.read(session_id))
            auth.verify.assert_not_called()

    def test_dev_login_cannot_be_enabled_in_production(self) -> None:
        with self.assertRaisesRegex(ValidationError, "本地测试登录只能用于 localhost"):
            Settings(
                ENVIRONMENT="production",
                DEV_LOGIN_ENABLED=True,
                APP_ORIGIN="https://example.com",
            )
