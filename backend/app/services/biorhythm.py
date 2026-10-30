import math
from datetime import date


CYCLES = {
    "physical": 23,
    "emotional": 28,
    "intellectual": 33
}


def calculate_biorhythms(birth_date: date, target_date: date) -> dict:
    elapsed_days = (target_date - birth_date).days

    results = {}

    for name, cycle in CYCLES.items():
        value = math.sin(2 * math.pi * elapsed_days / cycle) * 100
        results[name] = round(value, 2)

    return results