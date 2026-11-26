
from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


Chronotype = Literal["lark", "owl", "dove"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    birth_date: date
    chronotype: Chronotype

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value):
        if value > date.today():
            raise ValueError("Birth date cannot be in the future")
        return value


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    birth_date: date
    chronotype: str

    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class UserUpdate(BaseModel):
    birth_date: date
    chronotype: Chronotype

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value):
        if value > date.today():
            raise ValueError("Birth date cannot be in the future")
        return value
