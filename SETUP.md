# Atelier — настройка сервиса подкастов (Telegram Mini App)

Пошаговая инструкция, что нужно сделать **вручную**, чтобы сервис заработал **бесплатно** (или почти бесплатно) и был доступен **24/7**.

---

## Архитектура (бесплатный стек)

| Компонент | Сервис | Стоимость |
|-----------|--------|-----------|
| Frontend (React) | **Vercel** или **Cloudflare Pages** | Бесплатно |
| БД, файлы, функции | **Appwrite Cloud** (Free) | Бесплатно |
| Telegram Mini App | **@BotFather** | Бесплатно |
| Извлечение аудио | **Appwrite Function** + yt-dlp | В лимитах Free |

> **Важно:** на Free-плане Appwrite проект **замораживается после 1 недели неактивности**. Раз в неделю откройте приложение или настройте [UptimeRobot](https://uptimerobot.com) (бесплатно) — пинг каждые 5 дней на URL вашего API/сайта.

---

## 1. Telegram-бот и Mini App

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram.
2. `/newbot` — создайте бота, сохраните **BOT_TOKEN**.
3. `/newapp` — выберите бота, создайте Mini App:
   - **Title:** Atelier
   - **Description:** Подкасты из любых видео
   - **Photo:** загрузите иконку 640×640
   - **Web App URL:** пока оставьте заглушку, обновите после деплоя (шаг 5)
4. `/mybots` → ваш бот → **Bot Settings** → **Menu Button** → включите и укажите Mini App URL.
5. Опционально: `/setdescription`, `/setabouttext` для красоты.

Сохраните:
- `TELEGRAM_BOT_TOKEN` — для Appwrite Function `telegram-auth`

---

## 2. Appwrite Cloud

1. Зарегистрируйтесь на [cloud.appwrite.io](https://cloud.appwrite.io).
2. Создайте проект **Atelier** (Free plan).
3. Запишите:
   - **Project ID** → `VITE_APPWRITE_PROJECT_ID`
   - **Endpoint** → `https://cloud.appwrite.io/v1`

### 2.1 API Key

**Settings → API Keys → Create API Key**

Права (scopes):
- `databases.read`, `databases.write`
- `users.read` (опционально)
- `storage.read`, `storage.write`
- `functions.read`, `functions.write`

Сохраните ключ — он нужен только для **Functions** (переменные окружения), **не** вставляйте в frontend!

---

## 3. База данных

**Databases → Create database** → ID: `podcast_db`

### Коллекция `users`

| Attribute | Type | Size | Required |
|-----------|------|------|----------|
| telegramId | string | 32 | yes |
| firstName | string | 128 | yes |
| lastName | string | 128 | no |
| username | string | 64 | no |
| photoUrl | string | 512 | no |
| languageCode | string | 8 | no |
| isPremium | boolean | — | no |
| settings | string | 4096 | yes |
| sessionToken | string | 128 | no |
| createdAt | string | 64 | yes |

**Indexes:** `telegramId` (unique), `sessionToken`

### Коллекция `podcasts`

| Attribute | Type | Size | Required |
|-----------|------|------|----------|
| title | string | 256 | yes |
| description | string | 2048 | no |
| coverUrl | string | 512 | no |
| coverFileId | string | 64 | no |
| audioUrl | string | 512 | no |
| audioFileId | string | 64 | no |
| sourceUrl | string | 512 | no |
| sourcePlatform | string | 32 | no |
| duration | integer | — | yes |
| tags | string | 1024 | no |
| userId | string | 64 | yes |
| authorName | string | 128 | no |
| isPublic | boolean | — | yes |
| playCount | integer | — | yes |
| likeCount | integer | — | yes |
| chapters | string | 4096 | no |
| createdAt | string | 64 | yes |

**Indexes:** `title` (fulltext), `description` (fulltext), `tags` (fulltext), `authorName` (fulltext), `userId`, `playCount`, `isPublic`

> Для fulltext: при создании индекса выберите тип **fulltext** в Appwrite Console.

### Коллекция `favorites`

| Attribute | Type | Required |
|-----------|------|----------|
| userId | string | yes |
| podcastId | string | yes |
| createdAt | string | yes |

**Index:** `userId` + `podcastId` (unique composite если доступно)

### Коллекция `progress`

| Attribute | Type | Required |
|-----------|------|----------|
| userId | string | yes |
| podcastId | string | yes |
| position | integer | yes |
| completed | boolean | yes |
| updatedAt | string | yes |

### Коллекция `history`

| Attribute | Type | Required |
|-----------|------|----------|
| userId | string | yes |
| podcastId | string | yes |
| listenedAt | string | yes |
| duration | integer | yes |

### Права доступа (Permissions)

Для быстрого старта на Free-плане (2 функции):

| Коллекция | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| users | Function only* | Any | Function only* | — |
| podcasts | Function only* | Any | Any | — |
| favorites | Any | Any | Any | Any |
| progress | Any | Any | Any | Any |
| history | Any | Any | Any | Any |

\* Создание users — через function `telegram-auth`. Клиент обновляет `favorites/progress` напрямую.

> Для production усильте безопасность: все записи через Functions или JWT Custom Auth.

---

## 4. Storage (файлы)

Создайте 2 bucket:

### `audio`
- Max file size: **100 MB**
- Allowed: `mp3`, `m4a`, `ogg`, `webm`
- Read: **Any**
- Create: **Any** (или Function only — тогда только extract-audio)

### `covers`
- Max file size: **5 MB**
- Allowed: `jpg`, `png`, `webp`
- Read: **Any**
- Create: **Any**

---

## 5. Appwrite Functions

### Function `telegram-auth` (Runtime: Node 18+)

1. **Create function** → ID: `telegram-auth`
2. **Deploy** из папки `appwrite/functions/telegram-auth/`
3. **Execute access:** Any (публичная авторизация)
4. **Timeout:** 15s
5. **Environment variables:**

```
TELEGRAM_BOT_TOKEN=<ваш токен от BotFather>
APPWRITE_DATABASE_ID=podcast_db
APPWRITE_USERS_COLLECTION=users
SESSION_SECRET=<случайная строка 32+ символов>
```

`APPWRITE_API_KEY` и системные переменные Appwrite подставляются автоматически при деплое.

### Function `extract-audio` (Runtime: Python 3.11)

1. **Create function** → ID: `extract-audio`
2. **Deploy** из `appwrite/functions/extract-audio/`
3. **Execute access:** Any (проверка session внутри кода)
4. **Timeout:** **900s** (15 мин — максимум на Free)
5. **Build command:** `pip install -r requirements.txt`
6. **Environment variables:**

```
APPWRITE_DATABASE_ID=podcast_db
APPWRITE_USERS_COLLECTION=users
APPWRITE_PODCASTS_COLLECTION=podcasts
APPWRITE_AUDIO_BUCKET=audio
APPWRITE_COVERS_BUCKET=covers
```

> yt-dlp на Appwrite Cloud: если сборка падает, используйте **Docker runtime** с предустановленным yt-dlp или деплой на **Railway/Fly.io** отдельным микросервисом (см. раздел «Альтернатива»).

---

## 6. Frontend (.env)

Скопируйте `.env.example` → `.env`:

```bash
cp .env.example .env
```

Заполните:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=<ваш project id>
VITE_APPWRITE_DATABASE_ID=podcast_db
VITE_APP_URL=https://your-app.vercel.app
VITE_DEV_MOCK_TELEGRAM=false
```

Локальная разработка:

```bash
npm install
npm run dev
```

С `VITE_DEV_MOCK_TELEGRAM=true` можно тестировать в браузере без Telegram.

---

## 7. Деплой frontend (бесплатно 24/7)

### Vercel (рекомендуется)

1. Залейте проект на GitHub.
2. [vercel.com](https://vercel.com) → Import project.
3. **Environment Variables** — все `VITE_*` из `.env`.
4. Deploy → скопируйте URL.
5. В BotFather обновите **Web App URL** на этот адрес.
6. `VITE_APP_URL` = тот же URL (для шаринга).

### Cloudflare Pages (альтернатива)

Аналогично: build command `npm run build`, output `dist`.

---

## 8. Проверка

1. Откройте бота в Telegram → кнопка меню / Mini App.
2. Должен быть **мгновенный вход** (без форм) — авторизация через `initData`.
3. «Создать» → вставьте YouTube-ссылку → подождите 1–3 мин.
4. Подкаст появится в «Мои» и на главной.
5. Плеер: перемотка, скорость, избранное, шаринг.

---

## 9. Не дать проекту «заснуть» (Appwrite Free)

1. [UptimeRobot](https://uptimerobot.com) — бесплатный мониторинг.
2. URL: `https://your-app.vercel.app` — пинг раз в 5 дней.
3. Опционально: cron на `telegram-auth` function раз в неделю.

---

## 10. Альтернатива: extract-audio на Railway (если Appwrite не тянет yt-dlp)

1. Создайте Dockerfile с `yt-dlp` + Python API.
2. Деплой на [Railway](https://railway.app) free tier.
3. Замените вызов `extractFromUrl` на ваш URL.
4. Передавайте `sessionToken` для авторизации.

---

## Лимиты Free-плана Appwrite

- **2 GB** storage — ~200–400 подкастов по 5–10 MB
- **5 GB** bandwidth / месяц
- **2 functions** на проект
- Пауза после **7 дней** без активности
- Build/execute: **15 min** max

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| «Откройте через Telegram» | Открывайте только из Mini App, не из браузера (или включите mock в dev) |
| Авторизация не работает | Проверьте `TELEGRAM_BOT_TOKEN`, исправлен HMAC в `telegram-auth` |
| yt-dlp timeout | Короткие видео; увеличьте timeout; не плейлисты на 50+ видео |
| Нет звука | Проверьте bucket permissions (Read: Any) |
| CORS | Functions возвращают `Access-Control-Allow-Origin: *` |

---

## Что уже реализовано в приложении

- Автовход через Telegram `initData`
- Главная: продолжить, рекомендации, тренды, создание из URL
- Поиск с debounce, теги, история запросов
- Лайки: избранное, свои подкасты, история
- Аккаунт: скорость, перемотка, таймер сна, автоплей
- Плеер: Media Session API, главы, очередь, шаринг, избранное
- Дизайн Renaissance + анимации (Framer Motion)
- Поддержка YouTube, TikTok, VK, Instagram и др. (через yt-dlp)

Удачи! 🎧
