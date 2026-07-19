from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import select

from scripts.prestart import wait_for_database


def test_wait_for_database_checks_connection() -> None:
    engine = MagicMock()
    session = MagicMock()
    session.__enter__.return_value = session
    statement = select(1)

    with (
        patch("scripts.prestart.Session", return_value=session),
        patch("scripts.prestart.select", return_value=statement),
    ):
        wait_for_database.__wrapped__(engine)

    session.exec.assert_called_once_with(statement)


def test_wait_for_database_propagates_connection_error() -> None:
    engine = MagicMock()

    with (
        patch("scripts.prestart.Session", side_effect=RuntimeError("unavailable")),
        pytest.raises(RuntimeError, match="unavailable"),
    ):
        wait_for_database.__wrapped__(engine)
