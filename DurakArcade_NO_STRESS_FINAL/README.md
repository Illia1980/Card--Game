# Durak Arcade Online

A stylish online browser arcade with three games:

- **Durak Online**
- **Chess Online**
- **Checkers Online**

You can play alone against a bot or create an online room and invite a friend with a link.

## Features

- Play vs Bot
- Play with Friend
- Room code and invite link
- Durak with trump cards, attack, defense, take, beat, and Cheat Peek
- Cheat trap: if the trap card is clicked, cheating is locked
- Chess board game mode
- Checkers board game mode
- Stylish dark neon design
- Sound toggle
- Works locally with Node.js
- Deploy-ready for Render

## Local Run

Use the easiest method:

```text
START_GAME.bat
```

Or use terminal:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

Do not open `public/index.html` directly. Multiplayer needs the Node.js server.

## Online Multiplayer

GitHub alone is not enough for multiplayer because GitHub Pages does not run `server.js`.

Correct setup:

```text
GitHub = stores the code
Render = runs the server
Friend = opens your Render link
```

Read:

```text
DEPLOY_RENDER_SIMPLE.md
```

## Project Structure

```text
public/
  index.html
  css/style.css
  js/app.js
server.js
package.json
render.yaml
README.md
```

## Author

Created by Illia Litvinov.
