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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      return { status: 'running' };
    }
    return { status: 'stopped' };
  } catch (error: any) {
    clearTimeout(timeoutId);

    // The probe failed — service is cold or starting. Fire a long-running
    // wake-up request that keeps the connection alive for up to 60 seconds,
    // giving Render enough time to complete the cold start. We don't await it.
    const wakeController = new AbortController();
    const wakeTimeout = setTimeout(() => wakeController.abort(), 60000);
    fetch(healthUrl, { signal: wakeController.signal })
      .then(() => clearTimeout(wakeTimeout))
      .catch(() => clearTimeout(wakeTimeout));

    if (error.name === 'AbortError') {
      return { status: 'waking_up' };
    }
    return { status: 'waking_up' };
  }
});
