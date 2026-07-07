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
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      return { status: 'running' };
    }
    return { status: 'stopped' };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { status: 'waking_up' };
    }
    return { status: 'stopped' };
  }
});
