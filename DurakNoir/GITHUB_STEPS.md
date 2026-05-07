# GitHub Steps

## 1. Create your own repository

1. Go to **GitHub**.
2. Click **New repository**.
3. Repository name: `durak-noir`
4. Description: `A stylish browser-based Durak card game made with HTML, CSS and JavaScript.`
5. Choose **Public**.
6. Do **not** add another README on GitHub because this project already includes `README.md`.
7. Click **Create repository**.

## 2. Upload this project

Open **WebStorm Terminal** inside the project folder and run:

```bash
git init
git add .
git commit -m "Initial version of Durak Noir"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/durak-noir.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your own GitHub username.

## 3. Send a link to a friend

To play with a friend through a link, upload the project to **Netlify** or **GitHub Pages** first.

Then:

1. Open your hosted website.
2. Click **Play with Friend**.
3. Click **Host Room**.
4. Copy the invite link.
5. Send it to your friend.
6. Your friend opens it and clicks **Join Room**.

## 4. Check the repository

After pushing, your repository should contain:

```text
index.html
README.md
GITHUB_STEPS.md
.gitignore
package.json
css/style.css
js/cards.js
js/ui.js
js/game.js
```
