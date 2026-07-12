from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class BriefingResponse(BaseModel):
    content: str
    generated_at: datetime
    cached: bool
