from sqlalchemy import Column, Integer, Date, Float, ForeignKey, UniqueConstraint
from app.database import Base

class BiorhythmCache(Base):
    __tablename__ = "biorhythm_cache"
    
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_biorhythm_cache_user_date"),
    )
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    physical = Column(Float, nullable=False)
    emotional = Column(Float, nullable=False)
    intellectual = Column(Float, nullable=False)