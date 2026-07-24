type ServerStatus = 'ok' | 'waking_up' | 'stopped';

interface StatusResponse {
  status: ServerStatus;
  error?: string;
}

export default defineEventHandler(async (event): Promise<StatusResponse> => {
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

  // Perform the health check fetch
  const performHealthCheck = async (): Promise<boolean> => {
    try {
      const response = await fetch(healthUrl, { method: 'GET' });
      if (!response.ok) return false;
      
      const data = await response.json();
      return data?.status === 'ok';
    } catch {
      return false;
    }
  };

  const fetchPromise = performHealthCheck();
  
  // Create a timeout promise (e.g., 5 seconds)
  const timeoutPromise = new Promise<'timeout'>((resolve) => 
    setTimeout(() => resolve('timeout'), 5000)
  );

  try {
    // Race the actual fetch against the timeout
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (result === 'timeout') {
      // Background the fetch promise to avoid unhandled rejections
      // and allow the cold-start request to complete.
      fetchPromise.catch(console.error);
      
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(fetchPromise);
      }
      return { status: 'waking_up' };
    } 
    
    // Result is the boolean from performHealthCheck
    if (result === true) {
      return { status: 'ok' }; // Standardized to 'ok'
    } else {
      return { status: 'stopped', error: 'Health check failed or returned unexpected payload' };
    }
  } catch (error) {
    return { status: 'stopped', error: 'Failed to ping server' };
  }
});
