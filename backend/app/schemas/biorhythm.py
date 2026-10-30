from pydantic import BaseModel


class BiorhythmResponse(BaseModel):
    physical: float
    emotional: float
    intellectual: float