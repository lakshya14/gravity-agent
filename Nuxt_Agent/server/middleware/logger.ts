import { defineEventHandler } from 'h3';
import crypto from 'crypto';

export default defineEventHandler((event) => {
  const uuid = crypto.randomUUID();
  event.context.reqId = uuid;
});
