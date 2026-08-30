# website-cloner

Capture une page web et génère un clone HTML via Claude Vision.

## Lancer en local

```sh
npm install
cp .env.example .env   # puis renseigne ANTHROPIC_API_KEY dans .env
npm start
```

Ouvre `http://localhost:8787`.

La clé API reste côté serveur (`server.js`) — elle n'est jamais envoyée au navigateur.
