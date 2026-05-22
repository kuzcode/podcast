# Atelier — подкасты в Telegram

Простой Mini App: авторизация через Telegram → Appwrite, подкасты из YouTube без Functions и без второго bucket.

## Стек

- React + Vite
- Appwrite (Database + Storage bucket `media`)
- Vercel `api/extract` — YouTube → MP3 ([Video Download API](https://video-download-api.com)) → Storage

## Запуск

```bash
npm install
cp .env.example .env
npm run dev
```

Полная настройка: **[SETUP.md](./SETUP.md)**

## Структура

```
src/              — приложение
api/extract.js    — извлечение YouTube (Vercel + dev)
server/extract.mjs — конвертация + загрузка в Storage
```
