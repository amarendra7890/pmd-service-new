import { LightningElement, api, track } from 'lwc';

export default class RAssistChatBot extends LightningElement {
    @api isFullScreen = false;
    @track isChatbotOpen = true;
    @track showWelcome = true;
    @track messages = [];
    @track isHistoryOpen = false;
    @track question = '';
    @track selectedChatId;


    /**
 * Method to display selected chat.
 */
    handleSelectChat(event) {
        this.selectedChatId = event.detail;
        this.template
            .querySelector("c-r-assist-chat-screen")
            .sendChatId(this.selectedChatId);
    }

    toggleChatbot() {
        this.isChatbotOpen = !this.isChatbotOpen;
        console.log('Chatbot toggled:', this.isChatbotOpen);
        this.dispatchEvent(new CustomEvent('popupclose'));
    }

    connectedCallback() {
        console.log('Chatbot component connected');
        console.log('isChatbotOpen:', this.isChatbotOpen);
    }


    refreshChat() {
        this.selectedChatId = null;
        this.template.querySelector("c-r-assist-chat-screen").startNewChat();
    }


    handleToggleHistory() {
        console.log('Toggling history sidebar');
        this.isHistoryOpen = !this.isHistoryOpen;
        console.log('isHistoryOpen:', this.isHistoryOpen);
    }

    handleSelectHistory(event) {
        const selectedId = event.detail.id;
        console.log('Selected history item ID:', selectedId);
    }
    handleHeaderClose() {
        this.isChatbotOpen = false;

        this.dispatchEvent(new CustomEvent('closechatbot', { bubbles: true, composed: true }));

    }
    openInNew() {
        console.log("Opening in new window");
        this.isFullScreen = !this.isFullScreen;
        this.template.querySelector('.chatbot-container').style.display = this.isFullScreen ? 'flex' : '';
        console.log("Fullscreen toggled:", this.isFullScreen);
        console.log("Full Screen mode:", this.isFullScreen ? 'Enabled' : 'Disabled');
        this.dispatchEvent(new CustomEvent('fullscreenchange', { detail: this.isFullScreen }));
    }


    get chatbotContainerClass() {

        return `chatbot-container ${this.isFullScreen ? 'full-screen-mode' : ''}`;

    }



    handleHistoryToggle() {
        this.isHistoryOpen = !this.isHistoryOpen;
        this.template.querySelector('c-r-assist-chat-bot-history').open();
    }

    handleHistoryClose() {
        console.log('History closed');
        this.isHistoryOpen = false;
    }

    handleHistoryItem(event) {
        try{

      
        const selectedId = event.detail.id;
        console.log('Selected chat:', selectedId);
         this.selectedChatId = selectedId;
         this.handleToggleHistory();
        this.template
            .querySelector("c-r-assist-chat-screen")
            .sendChatId(this.selectedChatId);
             } catch (error) {
  // Code to handle the error
  console.error("An error occurred:", error.message);
  // You can also access other properties of the error object, like error.name or error.stack
}
    }

    handleNewChatFromHistory() {
        this.template.querySelector('c-r-assist-chat-screen').startNewChat();
    }

    get historyShadowClass() {
        return this.isHistoryOpen ? 'with-shadow' : '';
    }

}