# Arcade Duel

**Arcade Duel** is a polished browser arcade with three games:

- **Durak Online**
- **Chess Online**
- **Checkers Online**

You can play alone against a bot or create a room and invite a friend with a link.

## Features

- Play vs bot
- Play with friend by room code / invite link
- Durak with trump, attack, defense, take and beat actions
- Chess powered by chess.js for proper legal moves
- Checkers with captures, promotion and bot logic
- Clean dark premium design
- Responsive interface
- Server-based multiplayer using Socket.IO
- Ready for Render deployment

## Run Locally

Double click:

```text
START_GAME.bat
```

Or run manually:

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Important

Do not open `public/index.html` directly.
Do not use `localhost:63342` for multiplayer.
Use `localhost:3000` locally.

## Online With Friends

GitHub Pages alone will not work because this project needs a Node.js server.
Use:

```text
GitHub → Render → public link
```

Then create a friend room and send the invite link.

## Author

Created by Illia Litvinov.


## UI Update Notes

This version includes a cleaner Durak Online-inspired card table:
- improved playing cards and card backs
- shorter tips/rules panel
- smoother legal move highlighting
- restart and main menu buttons after every game
- improved chess and checkers board visuals

The project must be run with:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```
