# Durak Noir

**Durak Noir** is a stylish browser version of the classic **Durak** card game.
This project is built with **HTML, CSS, and JavaScript** and can be opened directly from **WebStorm** in a browser.

## Project Description

This project is a playable Durak game with a polished cinematic interface.
You can play against an AI opponent called **The Dealer**, or use **Friend Mode** to play with another person through an invite link after the project is hosted online.

The game includes a full 36-card deck, trump logic, attack and defense mechanics, sound, animated dealing, win tracking, selectable card back styles, and a cheat mechanic for AI mode.

## Main Features

- Full 36-card Durak deck
- 4 suits: spades, clubs, diamonds, hearts
- Random trump suit every game
- Player versus smarter AI opponent
- Online Friend Mode with invite link
- Attack / defend / take / beat mechanics
- Animated dealing effect
- Smooth card and table animations
- Neon premium dark UI
- Sound effects with toggle button
- Win / loss / draw counter stored in localStorage
- Card back style picker
- Cheat Peek mechanic in AI mode
- If you click the hidden cheater trap card, you get caught and cheating is locked
- Rules popup
- Game log
- Ready to open locally in browser

## Important Online Note

Friend Mode uses PeerJS/WebRTC.  
It works best when the project is uploaded to **Netlify**, **GitHub Pages**, or another HTTPS hosting service.

If you only open `index.html` locally on your own computer, your friend cannot use your local file path as a public link.  
For sending a real link to a friend, upload the project online first.

## How to Open the Project

1. Open the folder in **WebStorm**.
2. Open `index.html`.
3. Right click and choose **Open in Browser**.
4. Click **Play vs Dealer** or **Play with Friend**.

## How to Play with a Friend

1. Upload the project to Netlify or GitHub Pages.
2. Open the site.
3. Click **Play with Friend**.
4. Click **Host Room**.
5. Copy the invite link.
6. Send the link to your friend.
7. Your friend opens the link and clicks **Join Room**.
8. The game starts when the friend connects.

## How to Play Durak

1. The game uses a **36-card deck**.
2. Each player gets **6 cards**.
3. One card defines the **trump suit**.
4. The attacker plays a card on the table.
5. The defender must beat it with:
   - a higher card of the same suit, or
   - any trump card if the attack card is not trump.
6. If all attacks are defended, press **Beat** or **Pass / Done**.
7. If you cannot defend, press **Take**.
8. The goal is to get rid of all cards after the deck is empty.
9. The player left with cards is the **Durak**.

## Project Structure

```text
DurakNoir/
├── index.html
├── README.md
├── GITHUB_STEPS.md
├── .gitignore
├── package.json
├── css/
│   └── style.css
└── js/
    ├── cards.js
    ├── ui.js
    └── game.js
```

## Repository Requirement

Recommended repository name:

```text
durak-noir
```

Recommended description:

```text
A stylish browser-based Durak card game made with HTML, CSS and JavaScript.
```

## Git Commands

Run these commands in the **WebStorm terminal** from the project folder:

```bash
git init
git add .
git commit -m "Initial version of Durak Noir"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/durak-noir.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

## Author

Created by **Illia Litvinov**.
