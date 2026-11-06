
import math
from datetime import date, timedelta


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


def calculate_biorhythm_period(
    birth_date: date,
    start_date: date,
    end_date: date
) -> list:
    results = []

    current_date = start_date

    while current_date <= end_date:
        daily_result = calculate_biorhythms(
            birth_date,
            current_date
        )

        results.append({
            "date": current_date,
            **daily_result
        })

        current_date += timedelta(days=1)

    return results


def find_critical_days(
    birth_date: date,
    start_date: date,
    end_date: date
) -> list:
    results = []

    current_date = start_date

    while current_date <= end_date:
        previous_values = calculate_biorhythms(
            birth_date,
            current_date - timedelta(days=1)
        )

        current_values = calculate_biorhythms(
            birth_date,
            current_date
        )

        next_values = calculate_biorhythms(
            birth_date,
            current_date + timedelta(days=1)
        )

        for name in CYCLES:
            previous_value = previous_values[name]
            current_value = current_values[name]
            next_value = next_values[name]

            if current_value == 0 and previous_value * next_value < 0:
                direction = (
                    "positive_to_negative"
                    if previous_value > 0
                    else "negative_to_positive"
                )

                results.append({
                    "date": current_date,
                    "biorhythm": name,
                    "direction": direction
                })

            elif previous_value * current_value < 0:
                direction = (
                    "positive_to_negative"
                    if previous_value > 0
                    else "negative_to_positive"
                )

                results.append({
                    "date": current_date,
                    "biorhythm": name,
                    "direction": direction
                })

        current_date += timedelta(days=1)

    return results