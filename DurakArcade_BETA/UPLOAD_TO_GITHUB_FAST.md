# Upload to GitHub Fast

## Option A: easiest, through GitHub website

1. Go to GitHub.
2. Press **New repository**.
3. Repository name: `durak-arcade-online`.
4. Choose **Public**.
5. Press **Create repository**.
6. Press **uploading an existing file**.
7. Drag all project files/folders into GitHub:
   - `public`
   - `server.js`
   - `package.json`
   - `README.md`
   - `render.yaml`
   - all `.md` files
8. Press **Commit changes**.

## Option B: through WebStorm Terminal

Run inside the project folder:

```bash
git init
git add .
git commit -m "Initial version of Durak Arcade Online"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/durak-arcade-online.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.
