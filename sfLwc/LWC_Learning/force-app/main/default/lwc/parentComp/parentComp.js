import { api, LightningElement } from "lwc";

export default class ParentCmp extends LightningElement {
  @api messageReceived;
  messageSend;

  handleParentSubmit() {
    this.messageSend = "From Parent Component";
    this.dispatchEvent(
      new CustomEvent("parentevent", {
        detail: this.messageSend,
        bubbles: true,
        composed: true
      })
    );
  }

  handleChildEvent(event) {
    this.messageReceived = event.detail;
  }

  handlegrandChildEvent(event) {
    this.messageReceived = event.detail;
  }
}