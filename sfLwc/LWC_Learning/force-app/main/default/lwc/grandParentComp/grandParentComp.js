import { LightningElement } from "lwc";

export default class GrandParentComp extends LightningElement {
  messageReceived;
  messageSend;

  handleGrandParentSubmit() {
    this.messageSend = "From Grand Parent Component";
  }

  handleParentEvent(event) {
    this.messageReceived = event.detail;
  }

  handleChildEvent(event) {
    this.messageReceived = event.detail;
  }

  handlegrandChildEvent(event) {
    this.messageReceived = event.detail;
  }
}