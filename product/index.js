import 'dotenv/config';
import '../cwd.js';
import '../asyncHandler.js';
// ======================================================================
import { createLogger, format, transports } from 'winston';
import { spawn } from 'child_process';

// ======================================================================

const { combine, timestamp, printf, colorize } = format;

let categoriesWorkerProcess = null;
let productsWorkerProcess = null;
let ordersWorkerProcess = null;

// =====================[ Logger Enhancement ]=====================
const logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
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

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
//const isDevelopment = process.env.NODE_ENV === 'development';

// ======================================================================
logger.debug = function (message, metadata = {}) {
      if (DEBUG_MODE) {
            this.info(message, { ...metadata, debug: true });
      }
};

// ======================================================================

function free() {
      console.log('\nCore free...');

      // try {
      //     clearCorruptedCache();
      // } catch (_) {
      // } finally {
      //     console.log('Cache cleared');
      // }

      setTimeout(() => {
            process.exit(0);
      }, 1000);
}

// ======================================================================
async function main() {
      startCategoriesWorker();
      console.log('hi')
      startProductsWorker();
      startOrdersWorker();
}
main();

process.on('beforeExit', () => {
      //stopPguiWorker();
      free();
});
process.on('SIGINT', () => {
      //stopPguiWorker();
      free();
});
process.on('SIGTERM', () => {
      //stopPguiWorker();
      free();
});
process.on('SIGQUIT', () => {
      //stopPguiWorker();
      free();
});

function startCategoriesWorker() {
      if (categoriesWorkerProcess) return;
      const grayBg = '\x1b[100m'; // ANSI green background
      const reset = '\x1b[0m';
      logger.info(`${grayBg}[CategoriesWorker] Starting Categories worker...${reset}`);
      categoriesWorkerProcess = spawn('node', ['build/product/modules/categories/categoriesWorker.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
            cwd: process.cwd(),
      });
      categoriesWorkerProcess.stdout.on('data', data => {
            logger.info(`${grayBg}[CategoriesWorker] ${data.toString().trim()}${reset}`);
      });
      categoriesWorkerProcess.stderr.on('data', data => {
            logger.error(`${grayBg}[CategoriesWorker] ${data.toString().trim()}${reset}`);
      });
      categoriesWorkerProcess.on('close', code => {
            logger.info(`${grayBg}[CategoriesWorker] Categories worker exited with code ${code}${reset}`);
            categoriesWorkerProcess = null;
      });
}

function startProductsWorker() {
      if (productsWorkerProcess) return;
      const grayBg = '\x1b[100m';
      const reset = '\x1b[0m';
      logger.info(`${grayBg}[ProductsWorker] Starting Products worker...${reset}`);
      productsWorkerProcess = spawn('node', ['build/product/modules/products/productsWorker.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
            cwd: process.cwd(),
      });
      productsWorkerProcess.stdout.on('data', data => {
            logger.info(`${grayBg}[ProductsWorker] ${data.toString().trim()}${reset}`);
      });
      productsWorkerProcess.stderr.on('data', data => {
            logger.error(`${grayBg}[ProductsWorker] ${data.toString().trim()}${reset}`);
      });
      productsWorkerProcess.on('close', code => {
            logger.info(`${grayBg}[ProductsWorker] Products worker exited with code ${code}${reset}`);
            productsWorkerProcess = null;
      });
}

function startOrdersWorker() {
      if (ordersWorkerProcess) return;
      const grayBg = '\x1b[100m';
      const reset = '\x1b[0m';
      logger.info(`[OrdersWorker] Starting Products worker...`);
      ordersWorkerProcess = spawn('node', ['build/product/modules/orders/ordersWorker.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
            cwd: process.cwd(),
      });
      ordersWorkerProcess.stdout.on('data', data => {
            logger.info(`[OrdersWorker] ${data.toString().trim()}`);
      });
      ordersWorkerProcess.stderr.on('data', data => {
            logger.error(`[OrdersWorker] ${data.toString().trim()}`);
      });
      ordersWorkerProcess.on('close', code => {
            logger.info(`[OrdersWorker] Orders worker exited with code ${code}`);
            ordersWorkerProcess = null;
      });
}
