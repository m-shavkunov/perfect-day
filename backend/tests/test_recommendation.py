from datetime import date

from app.services.recommendation import generate_recommendation


def test_intellectual_recommendation(monkeypatch):
    monkeypatch.setattr(
        "app.services.recommendation.calculate_biorhythms",
        lambda birth_date, target_date: {
            "physical": 0,
            "emotional": 0,
            "intellectual": 80
        }
    )

    result = generate_recommendation(
        "intellectual",
        date(2000, 1, 1),
        date(2026, 11, 7),
        "lark"
    )

    assert result["recommendation"] == "Подходящее время для выполнения задачи"
    assert result["activity_value"] == 80
    assert "жаворонок" in result["reason"]


def test_physical_recommendation(monkeypatch):
    monkeypatch.setattr(
        "app.services.recommendation.calculate_biorhythms",
        lambda birth_date, target_date: {
            "physical": -70,
            "emotional": 0,
            "intellectual": 0
        }
    )

    result = generate_recommendation(
        "physical",
        date(2000, 1, 1),
        date(2026, 11, 7),
        "owl"
    )

    assert result["recommendation"] == "Лучше перенести задачу"
    assert result["activity_value"] == -70
    assert "сова" in result["reason"]


def test_creative_recommendation(monkeypatch):
    monkeypatch.setattr(
        "app.services.recommendation.calculate_biorhythms",
        lambda birth_date, target_date: {
            "physical": 0,
            "emotional": 20,
            "intellectual": 0
        }
    )

    result = generate_recommendation(
        "creative",
        date(2000, 1, 1),
        date(2026, 11, 7),
        "lark"
    )

    assert result["recommendation"] == "Можно выполнить задачу"
    assert result["activity_value"] == 20


def test_routine_recommendation():
    result = generate_recommendation(
        "routine",
        date(2000, 1, 1),
        date(2026, 11, 7),
        "lark"
    )

    assert result["recommendation"] == "Выполнять в удобное время"
    assert "не является основным фактором" in result["reason"]


def test_unknown_task_type():
    result = generate_recommendation(
        "unknown",
        date(2000, 1, 1),
        date(2026, 11, 7),
        "lark"
    )

    assert result["recommendation"] == "Нет рекомендации"
    assert "activity_value" not in result
