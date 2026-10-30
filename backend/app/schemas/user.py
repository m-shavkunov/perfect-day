from datetime import date

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    birth_date: date
    chronotype: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    birth_date: date
    chronotype: str

    model_config = {"from_attributes": True}

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    birth_date: date
    chronotype: str