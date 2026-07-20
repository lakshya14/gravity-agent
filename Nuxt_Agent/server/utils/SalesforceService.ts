import { SalesforceRecord } from '../../types/salesforce'
import { SalesforceSoqlResponse } from '../../types/salesforce'
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
  async runSoqlQuery(query: string): Promise<Array<unknown>> {
    console.log(`Running SOQL: ${query}`);
    const baseUrl = `${this.instanceUrl}/services/data/v60.0/query/?q=${encodeURIComponent(query)}`;
    try {
      const res = await $fetch<SalesforceSoqlResponse>(baseUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return res.records;
    } catch (err: any) {
      console.error('SOQL Error:', err.data || err.message);
      const details = err.data ? JSON.stringify(err.data) : err.message || err.toString();
      return { error: 'Failed to execute query', details };
    }
  }


  /**
   * Updates a specific Salesforce record.
   * @param objectName The API name of the object.
   * @param id The record ID.
   * @param fields The fields to update.
   * @returns Success or error message.
   */
  async updateRecord(objectName: string, id: string, fields: Record<string, unknown>): Promise<unknown> {
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
      console.error('Update Error:', err.data || err.message);
      const details = err.data ? JSON.stringify(err.data) : err.message || err.toString();
      return { error: `Failed to update ${objectName}`, details };
    }
  }


}
