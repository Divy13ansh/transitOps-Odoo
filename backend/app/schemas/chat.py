from pydantic import BaseModel, Field


class ChatAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


class ChatAskResponse(BaseModel):
    answer: str
