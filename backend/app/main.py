
from fastapi import FastAPI
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.biorhythms import router as biorhythms_router

app = FastAPI(
    title="Идеальный День",
    description="Backend для персонального планировщика задач",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(biorhythms_router)

@app.get("/")
def root():
    return {"message": "Backend проекта «Идеальный День» работает"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
