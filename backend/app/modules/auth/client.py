import logging
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from app.modules.auth.exceptions import AuthUnavailableError
from app.modules.auth.schemas import TokenExchange, VerifiedIdentity

logger = logging.getLogger(__name__)


class AuthServerClient:
    def __init__(self, http: httpx.Client, service_token: str) -> None:
        self.http = http
        self.service_token = service_token

    def _request(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str] | None = None,
        ticket: str | None = None,
    ) -> Any:
        try:
            response = self.http.request(
                method,
                path,
                headers=headers,
                json={"ticket": ticket} if ticket is not None else None,
            )
            response.raise_for_status()

            payload = response.json()

            if not isinstance(payload, dict):
                raise ValueError("认证服务响应格式不正确")
        except httpx.HTTPError, ValueError:
            logger.warning("认证服务请求失败：接口=%s", path)

            raise AuthUnavailableError from None

        if payload.get("code") != 0:
            raise AuthUnavailableError

        return payload.get("data")

    @staticmethod
    def _parse[T: BaseModel](model: type[T], data: Any) -> T:
        try:
            return model.model_validate(data)
        except ValidationError:
            raise AuthUnavailableError from None

    def exchange(self, ticket: str) -> TokenExchange:
        data = self._request("POST", "/api/user/login/dingtalk/exchange", ticket=ticket)

        return self._parse(TokenExchange, data)

    def verify(self, access_token: str) -> VerifiedIdentity:
        data = self._request(
            "GET",
            "/internal/token/verify",
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Service-Token": self.service_token,
            },
        )

        return self._parse(VerifiedIdentity, data)

    def logout(self, access_token: str) -> None:
        self._request(
            "DELETE",
            "/api/user/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )
