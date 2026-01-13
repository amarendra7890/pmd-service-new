import { LightningElement,track } from 'lwc';
import companyLogo from '@salesforce/resourceUrl/CompanyLogo';

export default class RelantoSalesCopoilt extends LightningElement {

    @track messages = [];
    @track currentMessage = '';

    @track userChathistory = [];
    logoUrl = companyLogo;
    connectedCallback() {
       /* this.userChathistory = [{id: 1, text: 'Hello, how can I help you?', isUser: true},
                                {id: 2, text: 'I am looking for a new laptop.', isUser: true},
                                {id: 3, text: 'What is your budget?', isUser: true},
                                {id: 4, text: 'I am looking for a laptop under $1000.', isUser: true},
                                {id: 5, text: 'I have a few options in mind. Would you like me to show them to you?', isUser: true},
        ];*/
    }

    handleInputChange(event) {
        this.currentMessage = event.target.value;
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.sendMessage();
        }
    }
    openEditChat(){
        alert('button Clicked');
    }
    sendMessage() {
        if (this.currentMessage.trim() !== '') {
            // Add the user's message to the chat history
            this.messages = [
                ...this.messages,
                {
                    id: this.messages.length + 1,
                    text: this.currentMessage,
                    isUser: true
                }
            ];

            // Simulate a response from the bot (this could be an API call)
            setTimeout(() => {
                this.messages = [
                    ...this.messages,
                    {
                        id: this.messages.length + 1,
                        text: 'This is autmated Response.',
                        isUser: false
                    }
                ];
                this.scrollToBottom();
            }, 1000);

            // Clear the input field
            this.currentMessage = '';
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        const chatHistory = this.template.querySelector('.chat-history');
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

}