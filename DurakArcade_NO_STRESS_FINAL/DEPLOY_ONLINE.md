# Deploy Online

To play with a friend from another house, `localhost` is not enough. You need to deploy the Node.js server.

## Easy option: Render

1. Upload the project to GitHub.
2. Go to Render.
3. Create **New Web Service**.
4. Connect your GitHub repository.
5. Set start command:

```bash
npm start
```

6. Deploy.
7. Open the Render URL.
8. Create a room and send the invite link to your friend.

## Local network option

If your friend is on the same Wi-Fi:

1. Run `npm start`.
2. Find your local IP address.
3. Your friend opens:

```text
http://YOUR-IP:3000
```

Example:

```text
http://192.168.1.25:3000
```
