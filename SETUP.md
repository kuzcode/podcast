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

Подкасты из YouTube **не используют bucket** — в БД сохраняются прямые ссылки на аудио и обложку.

---

## 3. Frontend `.env`

```bash
cp .env.example .env
```

Заполните `VITE_APPWRITE_*`. Удалите старые переменные `VITE_APPWRITE_AUDIO_BUCKET`, `VITE_APPWRITE_FN_*`, если остались.

```bash
npm install
npm run dev
```

---

## 4. Деплой на Vercel (бесплатно 24/7)

1. Репозиторий на GitHub → Import в Vercel.
2. Environment Variables — все `VITE_*` из `.env`.
3. Deploy.
4. URL в BotFather → Mini App.
5. `VITE_APP_URL` = тот же URL.

**Извлечение аудио:** на Vercel работает `api/extract.js` (YouTube через Piped API).  
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
    → Piped API → audioUrl + обложка
    → createDocument podcasts (ссылки в БД)
```

**Ограничение:** пока только **YouTube**. Ссылки на аудио могут перестать работать через время (ограничение Piped/YouTube) — для стабильности позже можно добавить загрузку в bucket `media`.

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
| extract failed | Только YouTube; попробуйте другое видео |
| CORS / api 404 на dev | `npm run dev` — API встроен в Vite |

---

## Что удалено из старой версии

- ❌ Appwrite Functions (`telegram-auth`, `extract-audio`)
- ❌ Второй bucket `covers`
- ❌ sessionToken и серверная проверка initData

При необходимости усилить безопасность позже — добавьте одну Vercel-функцию только для проверки `initData` с `BOT_TOKEN`.
