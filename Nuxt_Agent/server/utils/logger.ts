import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';
import type { FunctionCall } from '@google/genai';

// We configure pino to use pino-pretty in development, but raw JSON in production!
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    },
  }),
});

/**
 * Structured tool call trace logging.
 * Appends functionCall and functionResponse objects per session turn into a structured JSON log file.
 * Answers "how do you debug when the agent picks the wrong tool?" with a concrete example.
 */
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'tool_traces.jsonl');
// Runs ONCE at module load — subsequent awaits resolve instantly
const logDirReady = fs.mkdir(LOG_DIR, { recursive: true }).catch((err) => {
  console.error('Failed to create logs directory', err);
});

export async function logToolTrace(trace: {
  correlationId?: string;
  iteration: number;
  functionCall: Pick<FunctionCall, 'name' | 'args'>;
  functionResponse: { data: unknown };
}) {
  try {
    await logDirReady;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...trace
    };
    
    await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (error) {
    logger.error({ error }, 'Failed to write tool trace log');
  }
}
