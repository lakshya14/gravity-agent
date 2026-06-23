import { api, LightningElement } from "lwc";

export default class ChildComp extends LightningElement {
  @api messageReceived;
  messageSend;

  handleChildSubmit() {
    $.messageSend = "From Child Component";
    this.dispatchEvent(
      new CustomEvent("childevent", {
        detail: this.messageSend,
        bubbles: true,
        composed: true
      })
    );
  }
  
}