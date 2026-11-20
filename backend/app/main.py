
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler

from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.biorhythms import router as biorhythms_router
from app.routers.tasks import router as tasks_router
from app.routers.recommendations import router as recommendations_router
from app.routers.settings import router as settings_router
from app.routers.schedules import router as schedules_router

from app.services.notifications import check_upcoming_tasks


scheduler = BackgroundScheduler(
    timezone=ZoneInfo("Asia/Yekaterinburg")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        check_upcoming_tasks,
        trigger="interval",
        minutes=1,
        id="task_reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )

    scheduler.start()

    yield

    scheduler.shutdown(wait=True)


app = FastAPI(
    title="Идеальный День",
    description="Backend для персонального планировщика задач",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(biorhythms_router)
app.include_router(tasks_router)
app.include_router(recommendations_router)
app.include_router(settings_router)
app.include_router(schedules_router)


@app.get("/")
def root():
    return {"message": "Backend проекта «Идеальный День» работает"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
