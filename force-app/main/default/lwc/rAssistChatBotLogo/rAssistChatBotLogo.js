import { LightningElement, track } from 'lwc';

export default class RAssistChatBotLogo extends LightningElement {
    connectedCallback() {
    }

    @track openChatPopUp = false;
    handleIconClick() {
        this.openChatPopUp = true;
    }

    handleClose() {
        this.openChatPopUp = false;
    }
}