
import os
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.notification import Notification
from app.models.schedule_item import ScheduleItem
from app.models.schedule import Schedule
from app.models.task import Task
from app.models.user import User


TIMEZONE = ZoneInfo("Asia/Yekaterinburg")
MAX_ATTEMPTS = 3


def send_reminder_email(recipient, task_title, start_datetime):
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))

    if not smtp_user or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured")

    message = EmailMessage()
    message["Subject"] = "Напоминание о задаче — Идеальный День"
    message["From"] = smtp_user
    message["To"] = recipient

    message.set_content(
        f"Напоминаем, что через 15 минут начнётся задача:\n\n"
        f"{task_title}\n\n"
        f"Начало: {start_datetime.strftime('%H:%M')}\n"
        f"Дата: {start_datetime.strftime('%d.%m.%Y')}\n\n"
        f"Хорошего дня!\n"
        f"Идеальный День",
        charset="utf-8"
    )

    with smtplib.SMTP_SSL(
        smtp_host,
        smtp_port,
        timeout=15
    ) as server:
        server.login(smtp_user, smtp_password)
        server.send_message(message)


def process_notification(
    db: Session,
    schedule_item: ScheduleItem,
    task: Task,
    user: User,
    start_datetime: datetime
):
    if task.status != "planned":
        return

    notification = (
        db.query(Notification)
        .filter(
            Notification.schedule_item_id == schedule_item.id
        )
        .first()
    )

    if notification and notification.status == "sent":
        return

    if notification and notification.attempts >= MAX_ATTEMPTS:
        return

    if notification is None:
        notification = Notification(
            schedule_item_id=schedule_item.id,
            status="pending",
            attempts=0
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

    notification.attempts += 1
    notification.status = "pending"
    notification.last_error = None
    db.commit()

    try:
        send_reminder_email(
            user.email,
            task.title,
            start_datetime
        )

        notification.status = "sent"
        notification.sent_at = datetime.now(TIMEZONE)

    except Exception as error:
        notification.status = "failed"
        notification.last_error = str(error)

    db.commit()


def check_upcoming_tasks():
    now = datetime.now(TIMEZONE).replace(tzinfo=None)

    window_start = now + timedelta(minutes=14)
    window_end = now + timedelta(minutes=16)

    db = SessionLocal()

    try:
        items = (
            db.query(ScheduleItem, Schedule, Task, User)
            .join(
                Schedule,
                ScheduleItem.schedule_id == Schedule.id
            )
            .join(
                Task,
                ScheduleItem.task_id == Task.id
            )
            .join(
                User,
                Schedule.user_id == User.id
            )
            .filter(
                ScheduleItem.item_type == "task",
                Task.status == "planned",
                Schedule.date >= window_start.date(),
                Schedule.date <= window_end.date()
            )
            .all()
        )

        for item, schedule, task, user in items:
            start_datetime = datetime.combine(
                schedule.date,
                item.start_time
            )

            if not window_start <= start_datetime <= window_end:
                continue

            process_notification(
                db,
                item,
                task,
                user,
                start_datetime
            )

    finally:
        db.close()
