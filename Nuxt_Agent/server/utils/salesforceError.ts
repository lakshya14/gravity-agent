export function handleSalesforceError(result: any, defaultStatusCode = 500) {
  if (!result || (!result.error && !result.details)) return;

  const details = result.details || '';
  
  // Check for 401 / session expiration
  if (details.includes('401') || details.includes('INVALID_SESSION_ID')) {
    throw createError({ statusCode: 401, statusMessage: 'Session expired. Please login again.' });
  }

  let errorMessage = result.error || 'Salesforce API Error';
  
  // Attempt to parse Salesforce REST API error format
  try {
    if (details) {
      const parsedDetails = JSON.parse(details);
      if (Array.isArray(parsedDetails) && parsedDetails[0]?.message) {
        errorMessage = parsedDetails[0].message;
      } else {
        errorMessage = `${result.error}: ${details}`;
      }
    }
  } catch (e) {
    errorMessage = `${result.error}: ${details}`;
  }
  
  throw createError({ statusCode: defaultStatusCode, statusMessage: errorMessage });
}
