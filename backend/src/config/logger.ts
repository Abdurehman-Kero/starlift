import { createLogger, format, transports } from 'winston';
import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
    : format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
  transports: isProduction
    ? [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' }),
      ]
    : [new transports.Console()],
});

export default logger;
