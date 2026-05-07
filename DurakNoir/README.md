# Durak Noir

**Durak Noir** is a stylish browser version of the classic **Durak** card game with a more modern neon-cinematic look.
The project is made with **HTML, CSS, and JavaScript** and can be opened directly from **WebStorm** in a browser.

## Project Description

This project is a fully playable 1v1 Durak prototype.
The player faces an AI opponent called **The Dealer**.
The game includes a full 36-card deck, all standard suits and ranks, trump logic, attacking, defending, taking cards, beating the table, drawing cards, a game log, popups, and animated UI.

## Main Features

- Full 36-card Durak deck
- 4 suits: spades, clubs, diamonds, hearts
- Random trump suit every game
- Player versus AI opponent
- Attack and defense mechanics
- Take cards mechanic
- Beat / pass mechanic
- Drawing cards after each round
- Win / lose / draw states
- Animated battlefield and card hover effects
- Stylish neon dark UI
- Rules popup
- Game log
- Ready to open locally in a browser

## Technologies Used

- HTML5
- CSS3
- JavaScript
- WebStorm
- Git / GitHub

## How to Open the Project

1. Open the project folder in **WebStorm**.
2. Open `index.html`.
3. Right click and choose **Open in Browser**.
4. Click **Start Game**.

## How to Play

1. The game uses a **36-card deck**.
2. Each player receives **6 cards**.
3. One card defines the **trump suit**.
4. The attacker puts a card on the table.
5. The defender must beat it with:
   - a higher card of the same suit, or
   - any trump card if the attack card is not trump.
6. If all attack cards are defended, press **Beat** or **Pass / Done**.
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
