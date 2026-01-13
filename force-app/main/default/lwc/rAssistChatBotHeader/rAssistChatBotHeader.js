import { api, LightningElement, track } from 'lwc';
import SalesAssistLogo from "@salesforce/resourceUrl/SalesAssistRelantoLogo";
export default class RAssistChatBotHeader extends LightningElement {
    @api isChatbotOpen;
    @track showWelcome = true;
    @track salesAssistLogo = SalesAssistLogo;


    windowRef;
    isWindowed = false;

    refresh() {
        this.dispatchEvent(new CustomEvent('refresh'));
    }

    close() {
        console.log('Closing chatbot in header');
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }


    toggleChatbot() {
        this.isChatbotOpen = !this.isChatbotOpen;
        this.dispatchEvent(new CustomEvent('toggle', { detail: this.isChatbotOpen }));
    }


    openInNew() {
        console.log('Opening in new window');
        this.dispatchEvent(new CustomEvent('openinnew', { bubbles: true, composed: true }));
    }

    get chatbotContainerClass() {
        return `chatbot-container ${this.isFullScreen ? 'full-screen-mode' : ''}`;

    }
    toggleHistory() {
        this.dispatchEvent(new CustomEvent('togglehistory'));
    }



}