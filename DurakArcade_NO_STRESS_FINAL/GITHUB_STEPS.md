# GitHub Steps

## 1. Create your own repository

1. Go to GitHub.
2. Click **New repository**.
3. Repository name: `durak-arcade-online`.
4. Description: `Online multiplayer Durak, Chess and Checkers made with HTML, CSS and Node.js.`
5. Choose **Public**.
6. Do not add another README because this project already has `README.md`.
7. Click **Create repository**.

## 2. Push the project

Open WebStorm Terminal inside the project folder and run:

```bash
git init
git add .
git commit -m "Initial version of Durak Arcade Online"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/durak-arcade-online.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.
