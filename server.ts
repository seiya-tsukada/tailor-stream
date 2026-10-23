import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { SERVER_CONFIG } from './server/config';
import { feedRouter } from './server/routes/feedRoutes';

const app = express();

app.use(express.json());
app.use(feedRouter);

async function startServer() {
  if (!SERVER_CONFIG.IS_PRODUCTION) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), SERVER_CONFIG.DIST_DIR);
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(SERVER_CONFIG.PORT, SERVER_CONFIG.HOST, () => {
    console.log(`${SERVER_CONFIG.APP_NAME} Server running on http://localhost:${SERVER_CONFIG.PORT}`);
  });
}

startServer();
