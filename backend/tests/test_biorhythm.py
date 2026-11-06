from datetime import date

from app.services.biorhythm import (
    calculate_biorhythms,
    find_critical_days
)


def test_physical_biorhythm():
    result = calculate_biorhythms(
        date(2004, 8, 20),
        date(2004, 9, 12)
    )

    assert result["physical"] == 0.0


def test_emotional_biorhythm():
    result = calculate_biorhythms(
        date(2004, 8, 20),
        date(2004, 9, 17)
    )

    assert result["emotional"] == 0.0


def test_intellectual_biorhythm():
    result = calculate_biorhythms(
        date(2004, 8, 20),
        date(2004, 9, 22)
    )

    assert result["intellectual"] == 0.0


def test_find_critical_days():
    result = find_critical_days(
        date(2004, 8, 20),
        date(2004, 9, 3),
        date(2004, 9, 22)
    )

    assert {
        "date": date(2004, 9, 3),
        "biorhythm": "emotional",
        "direction": "positive_to_negative"
    } in result

    assert {
        "date": date(2004, 9, 12),
        "biorhythm": "physical",
        "direction": "negative_to_positive"
    } in result

    assert {
        "date": date(2004, 9, 17),
        "biorhythm": "emotional",
        "direction": "negative_to_positive"
    } in result

    assert {
        "date": date(2004, 9, 22),
        "biorhythm": "intellectual",
        "direction": "negative_to_positive"
    } in result


def test_find_critical_days_empty_period():
    result = find_critical_days(
        date(2004, 8, 20),
        date(2004, 8, 21),
        date(2004, 8, 22)
    )

    assert result == []