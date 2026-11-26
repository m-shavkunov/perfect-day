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

## Предварительные требования

Перед установкой проекта необходимо установить:

- Python 3.13 или совместимую версию.
- PostgreSQL.
- Node.js и npm.
- Git.

Для работы email-напоминаний также потребуется доступ к SMTP-серверу Gmail.

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

Для настройки JWT необходимо сгенерировать случайный секретный ключ:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Полученное значение следует указать в параметре `SECRET_KEY` файла `.env`. Секретный ключ не должен публиковаться или добавляться в Git.

Перед применением миграций необходимо запустить сервер PostgreSQL и убедиться, что создана база данных `perfect_day`. Порт и учётные данные в `DATABASE_URL` должны соответствовать локальной конфигурации PostgreSQL.

Пример строки подключения:

```text
DATABASE_URL=postgresql://user:password@localhost:5432/perfect_day
```

Применить миграции:

```powershell
alembic -c ..\alembic.ini upgrade head
```

Запустить сервер:

```powershell
python -m uvicorn app.main:app --reload
```

Backend будет доступен по адресу:

`http://127.0.0.1:8000`

### 3. Настройка Frontend

Не останавливая backend, открыть второй терминал и из корневой папки проекта перейти в папку frontend:

```powershell
cd frontend
```

Создать файл `.env` на основе примера:

```powershell
Copy-Item .env.example .env
```

В файле `.env` при необходимости можно изменить параметр `API_TARGET`, указав адрес запущенного Backend. По умолчанию используется:

```text
API_TARGET=http://127.0.0.1:8000
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

Для работы уведомлений необходимо заполнить SMTP-параметры в файле `.env`:

- `SMTP_HOST` — адрес SMTP-сервера.
- `SMTP_PORT` — порт SMTP-сервера.
- `SMTP_USER` — адрес почты отправителя.
- `SMTP_PASSWORD` — пароль приложения Gmail.

Для Gmail необходимо использовать пароль приложения, а не обычный пароль от почты.

Проверка предстоящих задач выполняется APScheduler каждую минуту. Напоминание отправляется за 15 минут до начала задачи.

Секретные данные нельзя публиковать или добавлять в Git.

## Разработчики

Командный учебный проект студентов УрФУ (3 семестр, команда №7).