// types/salesforce.ts

export interface SalesforceOAuthToken {
  
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

export interface SalesforceRecord {
  Id: string;
  [key: string]: unknown; 
}
export interface SalesforceSoqlResponse  {
  totalSize: number;
  done: boolean;
  records: SalesforceRecord[]; 
}

