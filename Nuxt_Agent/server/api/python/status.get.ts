export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  if (!config.mcpServerUrl) {
    return { status: 'stopped', error: 'MCP_SERVER_URL is not configured' };
  }

  let baseUrl = '';
  try {
    const url = new URL(config.mcpServerUrl);
    baseUrl = `${url.protocol}//${url.host}`;
  } catch (e) {
    return { status: 'stopped', error: 'Invalid MCP_SERVER_URL' };
  }

  const healthUrl = `${baseUrl}/health`;

  // We race the fetch against a timeout. We DO NOT abort the fetch if it times out, 
  // because we want the connection to stay alive so Render completes the cold start.
  const fetchPromise = fetch(healthUrl).then(res => res.ok).catch(() => false);
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000));

  try {
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (result === 'timeout') {
      // It took longer than 5s, server is likely cold starting.
      // The fetchPromise is still running in the background.
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(fetchPromise);
      }
      return { status: 'waking_up' };
    } else if (result === true) {
      return { status: 'running' };
    } else {
      return { status: 'stopped' };
    }
  } catch (error) {
    return { status: 'stopped', error: 'Failed to ping server' };
  }
});
