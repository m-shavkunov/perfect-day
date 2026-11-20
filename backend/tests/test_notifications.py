
from datetime import date, datetime, time

from app.models.user import User
from app.models.task import Task
from app.models.schedule import Schedule
from app.models.schedule_item import ScheduleItem
from app.models.notification import Notification
from app.core.security import hash_password

from app.services import notifications


def create_notification_data(db):
    user = User(
        email="notification@example.com",
        password_hash=hash_password("password123"),
        birth_date=date(2000, 1, 1),
        chronotype="lark"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    task = Task(
        user_id=user.id,
        title="Test notification task",
        type="intellectual",
        duration_min=60,
        priority="high",
        status="planned"
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    schedule = Schedule(
        user_id=user.id,
        date=date(2026, 11, 20)
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    item = ScheduleItem(
        schedule_id=schedule.id,
        task_id=task.id,
        item_type="task",
        start_time=time(10, 0),
        end_time=time(11, 0)
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return user, task, item


def test_notification_sent_only_once(db, monkeypatch):
    user, task, item = create_notification_data(db)

    sent_emails = []

    def fake_send_email(recipient, task_title, start_datetime):
        sent_emails.append(recipient)

    monkeypatch.setattr(
        notifications,
        "send_reminder_email",
        fake_send_email
    )

    start_datetime = datetime(2026, 11, 20, 10, 0)

    notifications.process_notification(
        db, item, task, user, start_datetime
    )

    notifications.process_notification(
        db, item, task, user, start_datetime
    )

    notification = (
        db.query(Notification)
        .filter(Notification.schedule_item_id == item.id)
        .first()
    )

    assert len(sent_emails) == 1
    assert notification.status == "sent"
    assert notification.attempts == 1
    assert notification.sent_at is not None


def test_notification_stops_after_three_attempts(db, monkeypatch):
    user, task, item = create_notification_data(db)

    attempts = []

    def fake_send_email(recipient, task_title, start_datetime):
        attempts.append(recipient)
        raise RuntimeError("Test SMTP error")

    monkeypatch.setattr(
        notifications,
        "send_reminder_email",
        fake_send_email
    )

    start_datetime = datetime(2026, 11, 20, 10, 0)

    for _ in range(4):
        notifications.process_notification(
            db, item, task, user, start_datetime
        )

    notification = (
        db.query(Notification)
        .filter(Notification.schedule_item_id == item.id)
        .first()
    )

    assert len(attempts) == 3
    assert notification.status == "failed"
    assert notification.attempts == 3
    assert notification.last_error == "Test SMTP error"


def test_completed_task_does_not_receive_notification(db, monkeypatch):
    user, task, item = create_notification_data(db)

    task.status = "done"
    db.commit()

    sent_emails = []

    def fake_send_email(recipient, task_title, start_datetime):
        sent_emails.append(recipient)

    monkeypatch.setattr(
        notifications,
        "send_reminder_email",
        fake_send_email
    )

    start_datetime = datetime(2026, 11, 20, 10, 0)

    notifications.process_notification(
        db, item, task, user, start_datetime
    )

    assert len(sent_emails) == 0


def test_check_upcoming_tasks_finds_task_in_notification_window(
    db, monkeypatch
):
    from sqlalchemy.orm import sessionmaker

    user, task, item = create_notification_data(db)

    sent_emails = []

    def fake_send_email(recipient, task_title, start_datetime):
        sent_emails.append(
            (recipient, task_title, start_datetime)
        )

    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 11, 20, 9, 45, tzinfo=tz)

    test_session_factory = sessionmaker(bind=db.get_bind())

    monkeypatch.setattr(
        notifications,
        "datetime",
        FixedDateTime
    )

    monkeypatch.setattr(
        notifications,
        "SessionLocal",
        test_session_factory
    )

    monkeypatch.setattr(
        notifications,
        "send_reminder_email",
        fake_send_email
    )

    notifications.check_upcoming_tasks()

    db.expire_all()

    notification = (
        db.query(Notification)
        .filter(Notification.schedule_item_id == item.id)
        .first()
    )

    assert len(sent_emails) == 1
    assert sent_emails[0][0] == user.email
    assert sent_emails[0][1] == task.title
    assert notification.status == "sent"
    assert notification.attempts == 1


def test_check_upcoming_tasks_skips_completed_tasks(
    db, monkeypatch
):
    from sqlalchemy.orm import sessionmaker

    user, task, item = create_notification_data(db)

    task.status = "done"
    db.commit()

    sent_emails = []

    def fake_send_email(recipient, task_title, start_datetime):
        sent_emails.append(recipient)

    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 11, 20, 9, 45, tzinfo=tz)

    test_session_factory = sessionmaker(bind=db.get_bind())

    monkeypatch.setattr(
        notifications,
        "datetime",
        FixedDateTime
    )

    monkeypatch.setattr(
        notifications,
        "SessionLocal",
        test_session_factory
    )

    monkeypatch.setattr(
        notifications,
        "send_reminder_email",
        fake_send_email
    )

    notifications.check_upcoming_tasks()

    db.expire_all()

    notification = (
        db.query(Notification)
        .filter(Notification.schedule_item_id == item.id)
        .first()
    )

    assert len(sent_emails) == 0
    assert notification is None
