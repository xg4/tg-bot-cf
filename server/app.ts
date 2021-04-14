import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import next from 'next';
import { join } from 'path';
import 'reflect-metadata';
import { buildSchema } from 'type-graphql';
import { createConnection } from 'typeorm';
import { SECRET_PATH } from './config';
import { bot, oneDayOfJob, oneHourOfJob } from './lib';
import { resolvers } from './resolvers';

oneDayOfJob.start();
oneHourOfJob.start();

const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev, dir: join(__dirname, '../client') });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  // connect database
  await createConnection();

  const server = express();

  // middleware
  server.use(express.json());
  server.use(morgan('tiny', { skip: (req) => req.url.startsWith('/_next') }));
  server.use(cors({ credentials: true, origin: true }));

  // telegram bot webhook, telegraf bot
  server.use(SECRET_PATH, (req, res) => bot.handleUpdate(req.body, res));

  const schema = await buildSchema({
    resolvers,
  });
  const apolloServer = new ApolloServer({
    schema,
    context: ({
      req,
      res,
    }: {
      req: Express.Request;
      res: Express.Response;
    }) => ({
      req,
      res,
      // TODO: Handle user/sessions here
      // user: req.user,
    }),
  });
  apolloServer.applyMiddleware({
    app: server,
    cors: false,
    path: '/graphql',
  });

  // client, next.js
  server.all('*', (req, res) => handle(req, res));

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main();
