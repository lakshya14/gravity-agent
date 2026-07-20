import { logger } from '../utils/logger';
import { getResponseStatus } from 'h3';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => { 
    event.context.startTime = Date.now();
    
    // Log the incoming request with our Pino logger
    logger.info({ 
      reqId: event.context.reqId, 
      method: event.method, 
      url: event.path 
    }, 'Incoming request');
  });

  nitroApp.hooks.hook('afterResponse', (event) => { 
    const timeTaken = Date.now() - event.context.startTime;
    const statusCode = getResponseStatus(event);

    // Log the response, including the status code and duration
    logger.info({ 
      reqId: event.context.reqId, 
      method: event.method,
      url: event.path,
      statusCode, 
      durationMs: timeTaken 
    }, 'Outgoing response');
  });
});
