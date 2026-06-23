   // ldsExample.js
   import { LightningElement, api, wire } from 'lwc';
   import getRecordId from '@salesforce/apex/ExampleCtrl.getRecordId';

   export default class LdsExample extends LightningElement {
       @api recordId='0015j0000080gfRAAQ';
       objectApiName = 'Account'; // Change to the desired object API name

       @wire(getRecordId, { recordId: '$recordId' })
       wiredRe({ data, error }) {
           if (data) {
               // Handle the record data
               console.log('Record data:', data);
               this.record = data;
               this.error = undefined;
           } else if (error) {
               // Handle the error
               console.error('Error loading record:', error);
               this.error = error;
               this.record = undefined;
           }
       }

       // Additional logic can be added as needed
   }