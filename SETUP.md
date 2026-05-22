# Atelier — простая настройка

Без Appwrite Functions. Один bucket. Авторизация — сразу из Telegram в базу.

---

## 1. Telegram

1. [@BotFather](https://t.me/BotFather) → `/newbot` → сохраните токен (для бота, **не** нужен в коде приложения).
2. `/newapp` → привяжите Mini App, URL укажете после деплоя (шаг 4).

---

## 2. Appwrite Cloud (бесплатно)

1. [cloud.appwrite.io](https://cloud.appwrite.io) → проект.
2. Скопируйте **Project ID** и **Database ID** в `.env`.

### База `podcast_db` (или ваша)

Создайте коллекции по таблицам ниже.  
**Permissions для всех коллекций (простой вариант):**

| | Create | Read | Update | Delete |
|---|--------|------|--------|--------|
| | Any | Any | Any | Any |

> Для хобби-проекта так проще. ID пользователя = `telegramId` (число из Telegram).

#### `users` — Document ID при создании: **Custom ID** = `telegramId`

| Поле | Тип |
|------|-----|
| telegramId | string |
| firstName | string |
| lastName | string |
| username | string |
| photoUrl | string |
| languageCode | string |
| isPremium | boolean |
| settings | string (JSON) |
| createdAt | string |

#### `podcasts`

| Поле | Тип |
|------|-----|
| title, description, coverUrl, audioUrl | string |
| coverFileId, audioFileId, sourceUrl, sourcePlatform | string |
| duration, playCount, likeCount | integer |
| tags, chapters | string |
| userId, authorName | string |
| isPublic | boolean |
| createdAt | string |

Индексы: `title`, `description`, `tags` — **fulltext** (для поиска).

#### `favorites`, `progress`, `history`

Как в README проекта — поля `userId`, `podcastId`, даты/позиция.

### Storage — **один bucket** `media`

- Max size: 100 MB  
- Extensions: mp3, m4a, jpg, png, webp  
- Read: **Any**  
- Create: **Any** (или отключите, если не загружаете файлы вручную)

Подкасты из YouTube сохраняют **MP3 и обложку в bucket** `media` (через server API key).

---

## 3. Frontend `.env`

```bash
cp .env.example .env
```

Заполните `VITE_APPWRITE_*`, а также **server-only**:

- `APPWRITE_API_KEY` — API key с правами Storage (write)
- `VIDEO_DOWNLOAD_API_KEY` — бесплатный ключ: [video-download-api.com/get-api-key](https://video-download-api.com/get-api-key)

Удалите старые переменные `VITE_APPWRITE_AUDIO_BUCKET`, `VITE_APPWRITE_FN_*`, `RAPIDAPI_KEY`, если остались.

```bash
npm install
npm run dev
```

---

## 4. Деплой на Vercel (бесплатно 24/7)

1. Репозиторий на GitHub → Import в Vercel.
2. Environment Variables — все `VITE_*` + `APPWRITE_API_KEY` + `VIDEO_DOWNLOAD_API_KEY` из `.env`.
3. **`VITE_DEV_MOCK_TELEGRAM=false`** на production (обязательно).
4. Deploy.
5. URL в BotFather → Mini App.
6. `VITE_APP_URL` = тот же URL (без слэша в конце).

### ⚠️ Appwrite Platforms (иначе «Load failed»)

В [Appwrite Console](https://cloud.appwrite.io) → ваш проект → **Settings** → **Platforms**:

1. **Add platform** → **Web**
2. Hostname: `podcast-five-sage.vercel.app` (ваш домен Vercel, **без** `https://`)
3. Сохранить

Без этого браузер в Telegram блокирует запросы к Appwrite.

**Извлечение аудио:** на Vercel работает `api/extract.js` (YouTube → MP3 через [Video Download API](https://video-download-api.com), затем загрузка в Storage).  
Локально — тот же маршрут через Vite dev server.

---

## 5. Как это работает (упрощённо)

```
Telegram Mini App открывается
    → initDataUnsafe.user
    → create/update документ users (ID = telegram id)
    → готово, без Functions

Создать подкаст:
    → GET /api/extract?url=...
    → Video Download API (MP3) → скачать → Appwrite Storage
    → createDocument podcasts (audioFileId, coverFileId, view URL)
```

**Ограничение:** пока только **YouTube**. Лимиты конвертации — по тарифу Video Download API (бесплатный старт, ~$0.0003 за MP3).

---

## 6. Не дать Appwrite «заснуть»

Free-план замирает после 7 дней без запросов.  
[UptimeRobot](https://uptimerobot.com) — пинг вашего Vercel URL раз в 5 дней.

---

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| Нет входа | Открыть из Telegram, не из браузера |
| Permission denied | В коллекциях включить Any на create/read/update |
| extract failed | Проверьте `VIDEO_DOWNLOAD_API_KEY`; только YouTube; другое видео |
| HTML вместо MP3 | Неверный или тестовый API key — получите ключ на video-download-api.com |
| CORS / api 404 на dev | `npm run dev` — API встроен в Vite |

---

## Что удалено из старой версии

- ❌ Appwrite Functions (`telegram-auth`, `extract-audio`)
- ❌ Второй bucket `covers`
- ❌ sessionToken и серверная проверка initData

При необходимости усилить безопасность позже — добавьте одну Vercel-функцию только для проверки `initData` с `BOT_TOKEN`.
