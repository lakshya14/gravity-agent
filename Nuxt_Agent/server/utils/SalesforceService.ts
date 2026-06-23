export class SalesforceService {
  private accessToken: string;
  private instanceUrl: string;

  constructor(accessToken: string, instanceUrl: string) {
    this.accessToken = accessToken;
    this.instanceUrl = instanceUrl;
  }

  /**
   * Executes a SOQL query against Salesforce.
   * @param query The SOQL query string.
   * @returns Array of records or error object.
   */
  async runSoqlQuery(query: string): Promise<any> {
    console.log(`Running SOQL: ${query}`);
    const baseUrl = `${this.instanceUrl}/services/data/v60.0/query/?q=${encodeURIComponent(query)}`;
    try {
      const res = await $fetch<any>(baseUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return res.records;
    } catch (err: any) {
      console.error('SOQL Error:', err);
      return { error: 'Failed to execute query', details: err.message || err.toString() };
    }
  }

  /**
   * Fetches metadata (fields) for a specific Salesforce object.
   * @param objectName The API name of the object.
   * @returns Object containing name and fields.
   */
  async getObjectMetadata(objectName: string): Promise<any> {
    console.log(`Fetching metadata for: ${objectName}`);
    const describeUrl = `${this.instanceUrl}/services/data/v60.0/sobjects/${objectName}/describe`;
    try {
      const res = await $fetch<any>(describeUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return {
        name: res.name,
        fields: res.fields.map((f: any) => ({ name: f.name, type: f.type, label: f.label }))
      };
    } catch (err: any) {
      console.error('Describe Error:', err);
      return { error: `Failed to describe object ${objectName}`, details: err.message || err.toString() };
    }
  }

  /**
   * Updates a specific Salesforce record.
   * @param objectName The API name of the object.
   * @param id The record ID.
   * @param fields The fields to update.
   * @returns Success or error message.
   */
  async updateRecord(objectName: string, id: string, fields: any): Promise<any> {
    console.log(`Updating ${objectName} ${id} with:`, fields);
    const updateUrl = `${this.instanceUrl}/services/data/v60.0/sobjects/${objectName}/${id}`;
    try {
      await $fetch(updateUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: fields
      });
      return { success: true, message: `Successfully updated ${objectName} ${id}.` };
    } catch (err: any) {
      console.error('Update Error:', err);
      return { error: `Failed to update ${objectName}`, details: err.message || err.toString() };
    }
  }

  /**
   * Searches for a Salesforce object's API name by its label.
   * @param label The label to search for.
   * @returns List of matching API names.
   */
  async findObjectApiName(label: string): Promise<any> {
    console.log(`Searching API name for label: ${label}`);
    const sobjectsUrl = `${this.instanceUrl}/services/data/v60.0/sobjects`;
    try {
      const res = await $fetch<any>(sobjectsUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const matches = res.sobjects
        .filter((obj: any) => obj.label.toLowerCase().includes(label.toLowerCase()))
        .map((obj: any) => ({ label: obj.label, apiName: obj.name }));
      
      if (matches.length === 0) {
        return { error: `No objects found matching label: ${label}` };
      }
      return { matches };
    } catch (err: any) {
      console.error('Find Object Error:', err);
      return { error: `Failed to search objects`, details: err.message || err.toString() };
    }
  }
}
