# Atelier — подкасты в Telegram

Простой Mini App: авторизация через Telegram → Appwrite, подкасты из YouTube без Functions и без второго bucket.

## Стек

- React + Vite
- Appwrite (только Database; Storage опционально — 1 bucket `media`)
- Vercel `api/extract` — YouTube → RapidAPI (youtube-to-mp315) + Appwrite Storage

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
server/extract.mjs — RapidAPI + загрузка в Storage
```
