import { startServer } from './server';

const port = Number(process.env.PORT ?? 3001);

const server = await startServer({ port });
console.log(`Asta Chemma server listening on port ${server.port}`);

const shutdown = () => {
  console.log('Shutting down…');
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
