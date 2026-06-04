# Deploy Online on Render

GitHub Pages is not enough for this project because multiplayer needs `server.js`.
Use Render.

## Steps

1. Upload this project to GitHub.
2. Go to Render.com.
3. New → Web Service.
4. Connect your GitHub repository.
5. Render should detect `render.yaml` automatically.
6. Build command: `npm install`.
7. Start command: `npm start`.
8. Deploy.

After deploy you get a public link like:

```text
https://arcade-duel-clean.onrender.com
```

Open it, create a friend room, copy the invite link and send it to your friend.
