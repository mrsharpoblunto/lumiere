import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import fs from 'fs';
import storage from 'node-persist';
import * as hap from 'hap-nodejs';
import uuid from 'node-uuid';

import express from 'express';
//express middleware
import morgan from 'morgan';
import compression from 'compression';
import errorHandler from 'errorhandler';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import winston from 'winston';

import * as config from './config.mjs';
import {configureApiRoutes} from './api.mjs';
import {VizController} from './viz-controller.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// configure express and its middleware
const app = express();
const port = process.env.PORT || config.APP_SERVER_PORT;

app.enable('trust proxy');
app.set('port', port);
app.use(compression());

// configure logging
app.logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(
      info => `${info.timestamp} - ${info.level}: ${info.message}`,
    ),
  ),
  transports: [
    new winston.transports.Console({
      level: config.LOG_LEVEL,
    }),
  ],
});
app.use(
  morgan('combined', {
    stream: {
      write: message => {
        app.logger.verbose(message);
      },
    },
  }),
);

app.use(cookieParser(uuid.v4()));
app.use(bodyParser.json());
if (process.env.NODE_ENV !== 'production') {
  app.use(
    errorHandler({
      dumpExceptions: true,
      showStack: true,
    }),
  );
}

// setup storage engine
app.storage = storage;
(async () => {
  await storage.init({
    dir: 'persist',
    forgiveParseErrors: true,
  });

  const selectedViz = await storage.getItem(config.VIZ_KEY) || 0;
  app.vizController = new VizController(selectedViz);
  await app.vizController.loadVisualizations();
  app.logger.info("Loaded visualizations: [" + 
    app.vizController.visualizations.map((v) => v.name).join(', ') +
  "]");

  configureApiRoutes(app);
  configureRoutes(app);
  startHomekitServer(app);
  startServer(app);
})();

function configureRoutes(app) {
  app.use(
    express.static(
      path.join(__dirname, '../../dist'),
      config.PUBLIC_STATIC_CACHING,
    ),
  );

  /**
   * handle rendering of the UI
   */
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
  });
}

function startHomekitServer(app) {
  hap.init();
  import('./light-accessory.mjs').then(i => {
    const accessory = i.default(app.vizController);
    accessory.publish({
      port: config.HOMEKIT_PORT,
      username: config.HOMEKIT_USERNAME,
      pincode: config.HOMEKIT_PINCODE,
    });
    app.logger.info('Published HomeKit Accessory Info');
  });
}

function startServer(app) {
  const server = config.APP_HTTPS
    ? https.createServer(sslConfig(), app)
    : http.createServer(app);
  let started = false;
  server
    .listen(port, () => {
      app.logger.info('Express server awaiting connections on port ' + port);
      started = true;
    })
    .on('error', err => {
      if (started) {
        app.logger.error(err.stack);
        process.exit(1);
      } else if (err.code === 'EACCES') {
        app.logger.error(
          `Unable to listen on port ${port}. This is usually due to the process not having permissions to bind to this port. Did you mean to run the server in dev mode with a non-priviledged port instead?`,
        );
        process.exit(1);
      } else if (err.code === 'EADDRINUSE') {
        app.logger.error(
          `Unable to listen on port ${port} because another process is already listening on this port. Do you have another instance of the server already running?`,
        );
        process.exit(1);
      }
    });
}

function sslConfig() {
  return {
    cert: tryReadFileSync(path.join(__dirname, '../../ssl', 'server.crt')),
    key: tryReadFileSync(path.join(__dirname, '../../ssl', 'server.key')),
  };
}

function tryReadFileSync(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (err) {
    return null;
  }
}
