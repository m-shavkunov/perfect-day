from app.services.biorhythm import calculate_biorhythms


def generate_recommendation(
    task_type: str,
    birth_date,
    target_date,
    chronotype: str
) -> dict:
    biorhythms = calculate_biorhythms(birth_date, target_date)

    if task_type == "intellectual":
        activity = biorhythms["intellectual"]
        activity_name = "интеллектуальной активности"

    elif task_type == "physical":
        activity = biorhythms["physical"]
        activity_name = "физической активности"

    elif task_type == "creative":
        activity = biorhythms["emotional"]
        activity_name = "эмоциональной активности"

    elif task_type == "routine":
        return {
            "recommendation": "Выполнять в удобное время",
            "reason": "Для рутинных задач уровень биоритмов не является основным фактором"
        }

    else:
        return {
            "recommendation": "Нет рекомендации",
            "reason": "Неизвестный тип задачи"
        }

    if activity >= 50:
        recommendation = "Подходящее время для выполнения задачи"
        reason = f"Высокий уровень {activity_name}"

    elif activity <= -50:
        recommendation = "Лучше перенести задачу"
        reason = f"Низкий уровень {activity_name}"

    else:
        recommendation = "Можно выполнить задачу"
        reason = f"Средний уровень {activity_name}"

    if chronotype == "lark":
        reason += ". Хронотип пользователя — жаворонок"

    elif chronotype == "owl":
        reason += ". Хронотип пользователя — сова"

    return {
        "recommendation": recommendation,
        "reason": reason,
        "activity_value": activity
    }