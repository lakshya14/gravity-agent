export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const session = await useSession(event, { password: config.sessionPassword });

  if (!session.data.accessToken || !session.data.instanceUrl) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized. Please login to Salesforce.' });
  }

  const { accessToken, instanceUrl } = session.data;
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Opportunity ID is required.' });
  }

  const body = await readBody(event);
  if (!body || Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields provided for update.' });
  }

  // Extract only the fields we want to allow updating to prevent injection of unexpected fields
  const allowedFields = ['Name', 'StageName', 'Amount', 'CloseDate'];
  const updateData: any = {};
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields provided for update.' });
  }

  const sfService = new SalesforceService(accessToken, instanceUrl);

  try {
    const result = await sfService.updateRecord('Opportunity', id, updateData);

    if (result.error) {
      let errorMessage = result.error;
      
      // Attempt to parse Salesforce REST API error format which is usually an array of objects
      try {
        const details = JSON.parse(result.details);
        if (Array.isArray(details) && details.length > 0 && details[0].message) {
          errorMessage = details[0].message;
        }
      } catch (e) {
        // Fallback to original error if parsing fails
        if (result.details && typeof result.details === 'string') {
          errorMessage = result.details;
        }
      }

      // Throw a 400 error to indicate a validation or logic error from Salesforce
      throw createError({ 
        statusCode: 400, 
        statusMessage: errorMessage 
      });
    }

    return { success: true, message: 'Opportunity updated successfully.' };
  } catch (error: any) {
    console.error('Error updating opportunity:', error);
    if (error.response?.status === 401 || error.statusCode === 401) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired. Please login again.' });
    }
    
    // If it's already an error we created, throw it
    if (error.statusCode) throw error;

    throw createError({ 
      statusCode: 500, 
      statusMessage: 'An unexpected error occurred while updating the Opportunity.' 
    });
  }
});
