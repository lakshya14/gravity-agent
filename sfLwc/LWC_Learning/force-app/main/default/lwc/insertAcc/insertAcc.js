import { LightningElement, track } from "lwc";
import getContacts from '@salesforce/apex/ContactController.getContacts';  // Import Apex method


/**
 * Creates Account records.
 */
export default class AccountCreator extends LightningElement {
  @track
  nameField;
  websiteField;
  contactsData = [];  // Data to be passed to the lightning-datatable
    columns = [
        {
            label: 'Name1',
            fieldName: 'Name',
            type: 'text'
        },
        {
            label: 'Email',
            fieldName: 'Email',
            type: 'text'
        },
        {
            label: 'Phone',
            fieldName: 'Phone',
            type: 'phone'
        }
    ];

    // Using the connectedCallback hook to fetch data from Apex
    connectedCallback() {
        this.fetchContacts();
    }

    // Fetch contacts using Apex and assign to contactsData
    async fetchContacts() {
        this.contactsData = await getContacts();
            /*.then((result) => {
                this.contactsData = result;  // Assign fetched contacts to the data property
            })
            .catch((error) => {
                console.error('Error fetching contacts:', error);
            });*/

    }

  handleAccountCreated() {
    // Run code when account is created.
    console.log('LOL');
    let searchCmp = this.template.querySelector(".name");

    let dateCmp = this.template.querySelector(".site");

    let searchvalue = searchCmp.value;

    let dtValue = dateCmp.value;

    if (!searchvalue) {

        searchCmp.setCustomValidity("Name value is required");

    } else {

        searchCmp.setCustomValidity("");

    }

    searchCmp.reportValidity();

    if (!dtValue) {

        dateCmp.setCustomValidity("Date value is required");

    } else {

        dateCmp.setCustomValidity("");

    }

    //dateCmp.reportValidity();

}
  }
