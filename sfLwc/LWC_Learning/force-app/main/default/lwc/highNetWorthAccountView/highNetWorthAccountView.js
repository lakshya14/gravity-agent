import { LightningElement, api, wire } from 'lwc';
import getAccountAccessInfo from '@salesforce/apex/AccountAccessController.getAccountAccessInfo';
import HNW_Error from "@salesforce/label/c.HNW_Error";

export default class HighNetWorthAccountView extends LightningElement {
    @api recordId;
    HNW_Error_Label=HNW_Error;
    showError = false;
    showReadOnly = false;
    showEditable = false;
    mode="";



    @wire(getAccountAccessInfo, { accountId: '$recordId' })
    wiredAccess({ error, data }) {
        if (data) { 
            const {
                recordExists,
                hasReadAccess,
                hasEditAccess,
                hasPermission,
                highNetWorth
            } = data;
console.log(data);

            if (!recordExists || !hasReadAccess) {
                this.showError = true;
            } else if (highNetWorth) {
                //this.showEditable = hasPermission;
                //this.showReadOnly = !hasPermission;
                if(hasPermission){
                    this.mode = "view";
                }else{
                    this.mode = "readonly";
                }
            } else {
                //this.showEditable = hasEditAccess;
                //this.showReadOnly = !hasEditAccess;
                if(hasEditAccess){
                    this.mode = "view";
                }else{
                    this.mode = "readonly";
                }
            }console.log(this.mode);
            
        } else if (error) {
            this.showError = true;
            console.error('Access check failed: ', error);
        }
    }

    handleSuccess(event) {
       
        console.log('Record updated', event.detail.id,data);
       /* this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Record updated successfully!',
                variant: 'success'
            })
        );*/
    }
}
