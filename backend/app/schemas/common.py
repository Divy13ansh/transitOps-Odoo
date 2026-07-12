from pydantic import BaseModel
from uuid import UUID


class PaginationMeta(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    pages: int
