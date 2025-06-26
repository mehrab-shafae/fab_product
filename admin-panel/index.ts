import 'dotenv/config';
import '../cwd.js';
import express from 'express';
import { Pool } from 'pg';
import adminRoutes from './adminRoutes.js';
import { createLogger, transports, format } from 'winston';

const { combine, timestamp, printf, colorize } = format;

const PORT = 7002;

const logger = createLogger({
    level: 'info',
    format: combine(
          timestamp(),
          printf(({ level, message, timestamp, requestId, ...metadata }) => {
                let msg = `${timestamp} [${level}]`;
                if (requestId) msg += ` [${requestId}]`;
                msg += ` : ${message}`;
                if (Object.keys(metadata).length > 0) {
                      msg += JSON.stringify(metadata);
                }
                return msg;
          })
    ),
    transports: [
          new transports.Console({
                format: combine(
                      colorize(),
                      timestamp(),
                      printf(({ level, message, timestamp, requestId, ...metadata }) => {
                            let msg = `${timestamp} [${level}]`;
                            if (requestId) msg += ` [${requestId}]`;
                            msg += ` : ${message}`;
                            if (Object.keys(metadata).length > 0) {
                                  msg += JSON.stringify(metadata);
                            }
                            return msg;
                      })
                ),
          }),
          new transports.File({
                filename: 'error.log',
                level: 'error',
                format: combine(
                      timestamp(),
                      printf(({ level, message, timestamp, requestId, ...metadata }) => {
                            let msg = `${timestamp} [${level}]`;
                            if (requestId) msg += ` [${requestId}]`;
                            msg += ` : ${message}`;
                            if (Object.keys(metadata).length > 0) {
                                  msg += JSON.stringify(metadata);
                            }
                            return msg;
                      })
                ),
          }),
          new transports.File({
                filename: 'combined.log',
                format: combine(
                      timestamp(),
                      printf(({ level, message, timestamp, requestId, ...metadata }) => {
                            let msg = `${timestamp} [${level}]`;
                            if (requestId) msg += ` [${requestId}]`;
                            msg += ` : ${message}`;
                            if (Object.keys(metadata).length > 0) {
                                  msg += JSON.stringify(metadata);
                            }
                            return msg;
                      })
                ),
          }),
    ],
});

const app = express();

const POSTGRES_URI = process.env.POSTGRES_URI || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'postgres'}`;

const pgPool = new Pool({
    connectionString: POSTGRES_URI,
});

function free() {
    pgPool.end();
}

function main() {
      app.locals.pgPool = pgPool;

      app.use('/', adminRoutes);

      app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Unhandled error', {
            error: err.message,
            stack: err.stack,
      });
      res.status(500).json({
            error: 'Internal server error',
      });
      });

      app.listen(PORT, function () {
            console.log(`Database Admin Panel available at http://localhost:${PORT}`);
            });
}

main();

process.on('beforeExit', free);
process.on('SIGINT', free);
process.on('SIGTERM', free);
process.on('SIGQUIT', free);
