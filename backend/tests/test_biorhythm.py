from datetime import date

from app.services.biorhythm import calculate_biorhythms


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