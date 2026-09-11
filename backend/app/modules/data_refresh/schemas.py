from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class RefreshSource(StrEnum):
    REGIONAL = "regional"
    RANKINGS = "rankings"
    INFLUENCERS = "influencers"


class RefreshJob(BaseModel):
    job_id: UUID


class RefreshStatus(BaseModel):
    status: Literal["pending", "succeeded", "failed"]


class CurrentRefreshJob(BaseModel):
    job_id: UUID | None = None
    status: Literal["idle", "pending", "succeeded", "failed"] = "idle"
