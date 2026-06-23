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

  const sfService = new SalesforceService(accessToken, instanceUrl);
  const query = `SELECT Id, Name, StageName, Amount, CloseDate, Description, Type, Probability FROM Opportunity WHERE Id = '${id}'`;

  try {
    const records = await sfService.runSoqlQuery(query);

    if (records.error) {
      const is401 = records.details && records.details.includes('401');
      throw createError({ 
        statusCode: is401 ? 401 : 500, 
        statusMessage: is401 ? 'Session expired. Please login again.' : `${records.error}: ${records.details}` 
      });
    }

    if (!records || records.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' });
    }

    return records[0];
  } catch (error: any) {
    console.error('Error fetching opportunity:', error);
    if (error.response?.status === 401 || error.statusCode === 401) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired. Please login again.' });
    }
    throw createError({ 
      statusCode: error.statusCode || 500, 
      statusMessage: error.statusMessage || error.message || 'Failed to fetch opportunity details.' 
    });
  }
});
