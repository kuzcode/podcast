# Atelier — подкасты в Telegram

Мини-приложение Telegram для прослушивания подкастов. Создавайте подкасты из видео YouTube и других платформ, слушайте с удобным плеером и персональными рекомендациями.

## Быстрый старт (разработка)

```bash
npm install
cp .env.example .env
# Заполните VITE_APPWRITE_PROJECT_ID или оставьте mock-режим
npm run dev
```

## Полная настройка (production)

См. **[SETUP.md](./SETUP.md)** — пошаговая инструкция:

- Telegram Bot + Mini App
- Appwrite (БД, Storage, Functions)
- Деплой на Vercel (бесплатно 24/7)
- Мониторинг чтобы проект не «засыпал»

## Стек

- React 19 + TypeScript + Vite
- Appwrite (БД, файлы, serverless)
- Telegram Web App SDK
- Framer Motion, Howler.js, Zustand

## Структура

```
src/           — React-приложение
appwrite/      — Cloud Functions (auth, extract-audio)
SETUP.md       — инструкция по развёртыванию
```
