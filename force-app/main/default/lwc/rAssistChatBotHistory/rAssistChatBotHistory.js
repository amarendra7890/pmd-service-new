import { LightningElement, api, track } from 'lwc';
import fetchChatsFromServer from "@salesforce/apex/SalesCopilotControllerclone.fetchChatsFromChatTemplate";
import { DateTime } from "c/luxon";

export default class rAssistChatbotHistory extends LightningElement {
    /**
   * This is the placeholder for chats associated with a chatId.
   * @type {object}
   */
  @track chats = [];

  /**
   * This is placeholder for grouping chats based on dates.
   * @type {object}
   */
  @track groupedChats = [];

  /**
   * This is flag for displaying spinner when messages are loading.
   * @type {boolean}
   */
  @track isLoading = true;

  /**
   * This is the messages length.
   * @type {number}
   */
  offset = 0;

  /**
   * This is flag for displaying latest message for a chat when component loads
   * @type {boolean}
   */
  loadChatsWhenComponentFirstLoads = false;

  // Expose the labels to use in the template.
//   label = {
//     noRecordsToShowMessage,
//     newChatButtonLabel
//   };

  /**
   * This method checks if any conversations present.
   */
  get hasConversations() {
    return this.chats.length > 0;
  }
    @track isOpen = false;

    @api helpLinks = [];
    @api monthlyData = [];
    /**
     * This method checks if any conversations present.
     */
    get hasConversations() {
        return this.chats.length > 0;
    }

    helpLinks = [
        {
            text: 'Get Started with Relanto',
            url: 'https://www.relanto.ai/',
            icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z'
        },
        {
            text: 'Explore R-Assist',
            url: 'https://www.relanto.ai/ai-first-lab',
            icon: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z'
        }
    ];

    @track recentSearches = [];

    closeHistory() {
        const closeEvent = new CustomEvent('closehistory');
        this.dispatchEvent(closeEvent);
    }

    handleHistoryClick(event) {
        const id = event.currentTarget.dataset.id;
        console.log('History Clicked: ');

    }

    @api open() {
        this.isOpen = true;
    }

    handleClose() {
        this.isOpen = false;
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleSelect(event) {
    const selectedId = event.currentTarget.dataset.id;
    console.log('History Clicked Dataset: ', event.currentTarget.dataset);
    console.log('History Clicked: ' + selectedId);

        this.dispatchEvent(
            new CustomEvent('selecthistory', { detail: { id: selectedId } })
        );
    }


    get sidebarClass() {
        return `history-sidebar ${this.isOpen ? 'open' : ''}`;
    }
    handleHistoryToggle() {
        const history = this.template.querySelector('c-r-assist-chat-history');
        if (history) {
            history.open(); // Triggers it to appear
        }
    }

    connectedCallback() {
        this.loadChats();
        // this.loadChatsWhenComponentFirstLoads = true;
    }
    // offset = 0;
    /**
   * This method is used to load chats from back-end.
   */
    // loadChats() {
    //     this.isLoading = true;
    //     fetchChatsFromServer({ offset: this.offset })
    //         .then((result) => {
    //             // Store full result in chats for reference
    //             this.chats.push(...result);
    //             this.offset += result.length;
    //             console.log('Recent History: '+JSON.stringify(result));
    //             // Extract recent search text
    //             this.recentSearches = result.map(chat => ({
    //                 id: chat.id,
    //                 text: chat.title
    //             }));
    //             console.log('Recent History2: '+JSON.stringify(result));
    //             this.isLoading = false;
    //         })
    //         .catch((error) => {
    //             console.error("Error fetching chats:", error);
    //             this.isLoading = false;
    //         });
    // }

      /**
   * This method is used to load chats from back-end.
   */
  loadChats() {
    this.isLoading = true;
    fetchChatsFromServer({ offset: this.offset })
      .then((result) => {
        this.chats.push(...result);
        this.offset += result.length;
        this.groupChats();
        this.isLoading = false;
      })
      .catch((error) => {
        console.error("Error fetching chats:", error.message);
        this.isLoading = false;
      });
  }


  
//   This method is used to group chats into categories like Today, Yesterday and Previous 7 days based on last message in each chat.
   
  groupChats() {
    const now = DateTime.now();
    const today = now.startOf("day");
    const yesterday = today.minus({ days: 1 });
    const last7Days = today.minus({ days: 7 });

    this.chats = this.chats
      .map((chat) => ({
        ...chat,
        chatDate: DateTime.fromISO(chat.lastMessageTimestamp).toLocal(),
        chatDateDisplay: DateTime.fromISO(chat.lastMessageTimestamp)
          .toLocal()
          .toLocaleString(DateTime.DATETIME_FULL)
      }))
      .sort((a, b) => b.chatDate - a.chatDate);

    const groups = [
      { date: "Today", chats: [], condition: (date) => date >= today },
      {
        date: "Yesterday",
        chats: [],
        condition: (date) => date >= yesterday && date < today
      },
      {
        date: "Previous 7 Days",
        chats: [],
        condition: (date) => date >= last7Days && date < yesterday
      }
    ];

    this.chats.forEach((chat) => {
      const group = groups.find((group) => group.condition(chat.chatDate));
      if (group) {
        group.chats.push(chat);
      }
    });

    this.groupedChats = groups.filter((group) => group.chats.length > 0);
    if (this.loadChatsWhenComponentFirstLoads) {
      if (this.groupedChats.length > 0) {
        const chatId = this.groupedChats[0].chats[0].id;
        this.groupedChats = this.groupedChats.map((chat) => ({
          ...chat,
          isSelected: chat.id === chatId
        }));
        this.dispatchEvent(new CustomEvent("selectchat", { detail: chatId }));
      }
      this.loadChatsWhenComponentFirstLoads = false;
    }
}

    /**
   * This method is used to add messages to chat history
   * @param {object} conversation
   */
    @api
    addChatToHistory(conversation) {

        // console.log('Event JSOn Conversation' + JSON.stringify(conversation));
        const existingChatIndex = this.chats.findIndex(
            (chat) => chat.chatHistoryUniqueId === conversation.chatHistoryUniqueId
        );
        if (existingChatIndex !== -1) {
            this.chats[existingChatIndex].lastMessageTimestamp =
                conversation.lastMessageTimestamp;

        } else {
            // this.chats.push(conversation);
            this.chats.push(conversation);

        }
        //this.chats.push(conversation);
        this.markSelectedChat(conversation.chatHistoryUniqueId);
    }


    /**
   * This method is triggered when chat is selected from history pane.
   * @param {} event
   */
    selectChat(event) {
        const chatId = event.target.getAttribute("data-id");
        const chatuniqueId = event.target.getAttribute("id");
        this.markSelectedChat(chatuniqueId);
        this.dispatchEvent(new CustomEvent("selectchat", { detail: chatId }));
    }

    /**
     * This method is used to track which conversation is selected to display.
     * @param {string} chatId
     */
    markSelectedChat(chatId) {
        // Make sure isSelected is updated deeply
        this.chats = this.chats.map((chat) => ({
            ...chat,
            isSelected: chat.chatHistoryUniqueId === chatId
        }));
        // Since we change chats, regroup them
        // this.sortChatsByDate(this.groupedChats);
        // console.log('****Grouped Chat' + JSON.stringify(this.groupedChats));

    }

    /**
     * This method is triggered when user clicks new message and chat window should clear previous messages displayed.
     */
    unselectAllChats() {
        // Make sure isSelected is updated deeply
        this.chats = this.chats.map((chat) => ({
            ...chat,
            isSelected: false
        }));
        // Since we change chats, regroup them
        this.sortChatsByDate(this.groupedChats);

    }

    handleThreadButtonClick() {
        this.handleClose();
        const event = new CustomEvent('newchat');
        this.dispatchEvent(event);
    }

}