from sqlalchemy import Column, Integer, Date, Float, ForeignKey
from app.database import Base 

class BiorythmCache(Base):
    __tablename__ = "biorythm_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    physical = Column(Float, nullable=False)
    emotional = Column(Float, nullable=False)
    intellectual = Column(Float, nullable=False)