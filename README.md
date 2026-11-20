# Идеальный День

Персональный планировщик задач, который помогает организовать рабочий день с учётом биоритмов, хронотипа пользователя и индивидуального расписания.

## Основные возможности

- Регистрация и авторизация пользователей.
- Управление задачами: создание, просмотр, редактирование и удаление.
- Расчёт биоритмов и определение критических дней.
- Рекомендации по выполнению задач.
- Настройка рабочего дня, обеденного перерыва и коротких пауз.
- Автоматическая генерация расписания с распределением задач.
- Ручная корректировка расписания.
- Email-напоминания о предстоящих задачах.

## Технологии

### Backend
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- APScheduler
- JWT

### Frontend
- Vue 3
- Vue Router
- Vite

### Тестирование
- pytest
- Node.js test runner

## Структура проекта

```text
perfect-day/
├── backend/
│   ├── app/
│   ├── migrations/
│   ├── tests/
│   ├── .env.example
│   ├── requirements.txt
│   ├── API_SETTINGS.md
│   └── API_NOTIFICATIONS.md
├── frontend/
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── .env.example
└── README.md
```

## Установка и запуск

### 1. Клонирование проекта

```bash
git clone <ссылка-на-репозиторий>
cd perfect-day
```

### 2. Настройка Backend

Перейти в папку backend:

```powershell
cd backend
```

Создать виртуальное окружение:

```powershell
python -m venv .venv
```

Активировать его:

```powershell
.\.venv\Scripts\Activate.ps1
```

Установить зависимости:

```powershell
pip install -r requirements.txt
```

Создать файл `.env` на основе примера:

```powershell
Copy-Item .env.example .env
```

Заполнить `.env` параметрами подключения к PostgreSQL, секретным ключом и SMTP-настройками.

Перед запуском необходимо создать базу данных PostgreSQL и указать правильный адрес, порт, имя базы данных и учётные данные в `DATABASE_URL`.

Применить миграции:

```powershell
alembic upgrade head
```

Запустить сервер:

```powershell
python -m uvicorn app.main:app --reload
```

Backend будет доступен по адресу:

`http://127.0.0.1:8000`

### 3. Настройка Frontend

Открыть второй терминал и перейти в папку frontend:

```powershell
cd frontend
```

Установить зависимости:

```powershell
npm install
```

Запустить frontend:

```powershell
npm run dev
```

Адрес локального приложения будет указан в терминале Vite.

## API и документация

После запуска backend доступны:

- Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

Дополнительная документация:

- `backend/API_SETTINGS.md` — API настроек пользователя.
- `backend/API_NOTIFICATIONS.md` — механизм email-уведомлений.

## Тестирование

### Backend

Из папки `backend`:

```powershell
python -m pytest
```

### Frontend

Из папки `frontend`:

```powershell
npm test
```

Сборка frontend:

```powershell
npm run build
```

## Email-уведомления

Для отправки напоминаний используется SMTP-сервер Gmail.

Проверка предстоящих задач выполняется APScheduler каждую минуту. Напоминание отправляется за 15 минут до начала задачи.

Параметры SMTP задаются в `.env`. Секретные данные нельзя публиковать или добавлять в Git.

## Разработчики

Командный учебный проект студентов УрФУ (3 семестр, команда №7).