# Самый простой онлайн-запуск для игры с друзьями

GitHub сам по себе НЕ запускает multiplayer server. GitHub хранит код.
Чтобы друг мог зайти по ссылке из другого дома, нужен hosting для `server.js`.
Самый простой вариант: **GitHub + Render**.

## 1. Загрузи проект на GitHub

Создай repository, например:

```text
durak-arcade-online
```

В WebStorm Terminal из папки проекта:

```bash
git init
git add .
git commit -m "Initial version of Durak Arcade Online"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/durak-arcade-online.git
git push -u origin main
```

## 2. Запусти на Render

1. Открой Render.
2. New → Web Service.
3. Connect GitHub repository.
4. Выбери этот проект.
5. Settings:

```text
Build Command: npm install
Start Command: npm start
```

6. Нажми Deploy.

После этого Render даст ссылку типа:

```text
https://durak-arcade-online.onrender.com
```

Эту ссылку уже можно отправлять другу.

## 3. Как играть с другом

1. Открой Render-ссылку.
2. Нажми Play with Friend.
3. Нажми Copy Invite Link.
4. Отправь ссылку другу.
5. Друг открывает ссылку и заходит в твою комнату.

## Важно

- `localhost:3000` работает только на твоём компьютере.
- GitHub Pages не подходит для этой версии, потому что нужен `server.js`.
- Для реальной игры по сети используй Render/Railway/Replit.
