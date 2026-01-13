import { LightningElement, api, track } from "lwc";
import getCopilotResponse from "@salesforce/apex/SalesCopilotControllerclone.getCopilotResponse";
import getContinueCopilotResponse from "@salesforce/apex/SalesCopilotControllerclone.toContinueChatConversation";
import apiErrorMessage from "@salesforce/label/c.Relanto_API_ERROR_Message";
import searchTitlePlaceholder from "@salesforce/label/c.Relanto_GPT_Message_Textarea_Placeholder";
import fetchMessagesByChatId from  "@salesforce/apex/SalesCopilotControllerclone.fetchTransactionsByChatId";
export default class RAssistChatScreen extends LightningElement {
    label = {
        searchTitlePlaceholder,
        apiErrorMessage
    };
    @api questions;
    @track isGenerating = false;
    @track showWelcome = true;
    @track columns = [];
    @track data = [];
    @track tableData = [];
    @track chartLabel = [];
    @track chartData = [];
    @track chartConfiguration;
    @api chatId;
    @track messages = [];
    @track draftMessage = "";
    @track isGenerating = false;
    @track isMessagesLoading = false;
    answerParagraphs;
    userSessionId;
    query;
    shouldScrollToBottom = false;
    chartData = [];
    chartTitle = "";
    showChart = false;

    @track today = new Date().toDateString();

    /**
     * Method called from relantoChat cmp to display selected chat based on Id.
     * @param {string} chatId
     */
    @api
    sendChatId(chatId) {
        try{
        console.log('this.chatId78: '+this.chatId);
        this.chatId = chatId;
        this.resetChat();
        this.loadMessages();
        }catch (error) {
  // Code to handle the error
  console.error("An error occurred while loading history:", error.message);
  // You can also access other properties of the error object, like error.name or error.stack
}
       
    }

    renderedCallback() {
        if (this.shouldScrollToBottom) {
            setTimeout(() => {
                this.scrollToBottom();
                this.shouldScrollToBottom = false;
            }, 0);
        }
    }

    scrollToBottom() {
        const container = this.template.querySelector(".chat-messages");
        console.log("Scroll container:", container);
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    /**
     * Method is called from relantoChat cmp to start a new chat.
     */
    @api
    startNewChat() {
        this.showWelcome = true;
        this.chatId = "";
        this.resetChat();
    }

    // addMessage(type, text) {
    //     const msg = {
    //         id: Date.now().toString(),
    //         type,
    //         text,
    //         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    //         avatar: type === 'bot' ? '🤖' : 'You'
    //     };
    //     this.messages = [...this.messages, msg];
    //     console.log('This is User message response: ' + JSON.stringify(this.messages));
    // }

   likeMessage(event) {
    const button = event.currentTarget;
    const messageElement = button.closest(".message-content");

    // Get sibling buttons
    const dislikeBtn = messageElement.querySelector(".action-btn[title='Dislike']");
    const copyBtn = messageElement.querySelector(".action-btn[title='Copy']");

    // Toggle active state
    const isActive = button.classList.contains("active");

    if (!isActive) {
        button.classList.add("active");
        button.style.color = "#00bceb"; // Cisco blue
        // Reset dislike button
        dislikeBtn.classList.remove("active");
        dislikeBtn.style.color = "";
        console.log("Message liked ✅");
    } else {
        button.classList.remove("active");
        button.style.color = "";
        console.log("Like removed");
    }
}

dislikeMessage(event) {
    const button = event.currentTarget;
    const messageElement = button.closest(".message-content");

    // Get sibling buttons
    const likeBtn = messageElement.querySelector(".action-btn[title='Like']");
    const copyBtn = messageElement.querySelector(".action-btn[title='Copy']");

    // Toggle active state
    const isActive = button.classList.contains("active");

    if (!isActive) {
        button.classList.add("active");
        button.style.color = "#ff4757"; // red for dislike
        // Reset like button
        likeBtn.classList.remove("active");
        likeBtn.style.color = "";
        console.log("Message disliked ❌");
    } else {
        button.classList.remove("active");
        button.style.color = "";
        console.log("Dislike removed");
    }
}

copyMessage(event) {
    const button = event.currentTarget;
    const messageText = button.closest(".message-content").querySelector(".message-bubble").innerText;

    navigator.clipboard.writeText(messageText).then(() => {
        button.style.color = "#00bceb"; // highlight color
        console.log("Message copied 📋");

        // Reset color after 1s
        setTimeout(() => {
            button.style.color = "";
        }, 1000);
    }).catch(err => {
        console.error("Failed to copy message:", err);
    });
}


    handleUserMessage(event) {
        this.questions = event.detail;
        this.draftMessage = this.questions;
        this.showWelcome = false;
        this.sendMessage();
    }

    handleCommonQuery(event) {
        console.log("Event: " + JSON.stringify(event.detail));
        this.questions = event.detail.fullText;
        console.log("Event: " + JSON.stringify(this.questions));
        this.showWelcome = false;
        this.draftMessage = this.questions;
        this.sendMessage();
    }

    connectedCallback() {
        console.log("ChatBotScreen --------");
        // console.log('messages: ' + JSON.stringify(this.questions));

        // if (this.chatId) {
        //     this.loadMessages();
        //     //this.assignedBEGEOs = fetchAssignedBEGEOs();
        // }
        //this.sendMessage();
    }
    /**
     * This method is used to clear chat data.
     */
    resetChat() {
        this.messages = [];
        this.chartData = [];
        // this.clearUserInput();
    }
    /**
     * This method is used to clear the prompt user typed.
     */
    // clearUserInput() {
    //     const textarea = this.template.querySelector("textarea");
    //     textarea.value = "";
    //     this.draftMessage = "";
    // }

    // /////////////////// ------------------ ///////////////////////
   loadMessages() {
    console.log('LoadMessages on history Clicked');
    this.isMessagesLoading = true;

    fetchMessagesByChatId({ chatId: this.chatId })
        .then((result) => {
            console.log("******result", JSON.stringify(result));

            // Normalize and safely parse messages
            this.messages = result.map((msg) => {
                let parsedAnswer;

                try {
                    // ✅ Handle if 'answer' is already an object or still a string
                    parsedAnswer =
                        typeof msg.answer === "string" ? JSON.parse(msg.answer) : msg.answer;
                } catch (e) {
                    console.warn("Invalid JSON in msg.answer:", e);
                    parsedAnswer = {};
                }

                return {
                    ...msg,
                    parsedAnswer: parsedAnswer, // keep parsed answer for debugging if needed
                    statusIsComplete: msg.status === "Completed",
                    statusIsError: msg.status === "Error",
                    isLastMessage: this.isLastMessage(msg)
                };
            });

            // ✅ Avoid undefined array errors
            if (this.messages.length > 0) {
                const lastMsg = this.messages[this.messages.length - 1];
                this.userSessionId = lastMsg.sessionId || null;
                this.query = lastMsg.prompt || "";

                try {
                    const parsedAnswer =
                        typeof lastMsg.answer === "string"
                            ? JSON.parse(lastMsg.answer)
                            : lastMsg.answer;
                    this.answerParagraphs = parsedAnswer.response || "";
                } catch (e) {
                    this.answerParagraphs = "";
                    console.warn("Error parsing last message for answerParagraphs");
                }

                // ✅ Process the historical data (your detailed logic)
                this.processHistoricalChatMessages(this.messages);
                this.scrollToBottom();
            } else {
                console.log("No messages found for this chatId");
            }

            this.isMessagesLoading = false;
        })
        .catch((error) => {
            console.error("Error fetching messages:", error);
            this.isMessagesLoading = false;
        });
}


  processHistoricalChatMessages(messages) {
    console.log('Yes loaded in History ' + JSON.stringify(messages));

    messages.forEach((c) => {
        let messageAnswer = c.answer;
        let parsedAnswer;

        try {
            parsedAnswer = typeof messageAnswer === "string" ? JSON.parse(messageAnswer) : messageAnswer;
        } catch (err) {
            console.error("Invalid JSON in message.answer:", err);
            parsedAnswer = {};
        }

        const result = parsedAnswer.data || parsedAnswer.result;
        const responseArray = parsedAnswer.response || [];
        let formattedResponse = "";
        let isDataTable = false;
        let isChart = false;

        // 🧠 Handle text array in `response`
        if (Array.isArray(responseArray) && responseArray.length > 0) {
            formattedResponse = responseArray
                .map((item) => (typeof item === "object" ? item.response || "" : item))
                .join("\n\n")
                .trim();
        }

        // 🧩 Detect and handle data patterns
        if (Array.isArray(result) && result.length > 0) {
            const firstRow = result[0];
            if (typeof firstRow === "object" && !Array.isArray(firstRow)) {
                // ✅ Case 1: Proper data table (array of objects)
                isDataTable = true;
                isChart = true;
            } else if (Array.isArray(firstRow) && firstRow.length === 1) {
                // ✅ Case 2: [["No results found."]] → treat as plain text
                formattedResponse = firstRow[0];
            } else if (typeof firstRow === "string") {
                // ✅ Case 3: ["No records found"]
                formattedResponse = firstRow;
            }
        }

        // 🧩 Handle failed responses
        if (!isDataTable && parsedAnswer.success === false && parsedAnswer.statusMessage) {
            formattedResponse = parsedAnswer.statusMessage;
        }

        // 🧩 Sources (if any)
        let formattedSources = "";
        if (parsedAnswer.sources && Array.isArray(parsedAnswer.sources)) {
            formattedSources = parsedAnswer.sources.join("\n\n");
        }

        // 🧩 Assign to chat message object
        c.isDataTable = isDataTable;
        c.isSource = formattedSources !== "";
        c.sources = formattedSources ? `<br>\n\nSources:\n\n${formattedSources}` : "";
        c.isChart = isChart;
        c.isLastMessage = this.isLastMessage(c);
        c.statusIsComplete = true;

        if (isDataTable) {
            c.tableCloumnfromAPI = this.getDataTableColumns(result, true);
            c.tableDataFromAPI = this.formatTabelAmountData(result);
            c.chartData = {
                chartType: "bar",
                data: result
            };
            this.prepareChartData(c, "PORTFOLIO", "SCORE", "#1f77b4", "Score by Portfolio");
        }

        // ✅ Always set reponseTextValue if present (even with a table)
         if(c.tableCloumnfromAPI==null && c.tableDataFromAPI==null){
                    formattedResponse = 'No data found';
                }
        c.reponseTextValue = formattedResponse;

        this.showWelcome = false;
        this.shouldScrollToBottom = true;
    });

    this.messages = messages;
}



    get hasMessages() {
        return this.messages.length > 0;
    }

    sendMessage() {
        this.shouldScrollToBottom = true;

        if (!this.draftMessage.trim()) {
            return;
        }
        this.messages.forEach((message) => {
            message.isLastMessage = false;
            if (!message.chartData) {
                message.showChart = false;
            }
        });
        this.isGenerating = true;
        const newMessage = {
            prompt: this.draftMessage,
            answer: "",
            status: "In Progress",
            isLastMessage: true
        };
        // this.messages.unshift(newMessage);
        this.messages.push(newMessage);
        this.shouldScrollToBottom = true;
        //this.chartData = [];
        // this.clearUserInput();

        const promptText = this.messages[this.messages.length - 1].prompt.trim();
        if (!this.chatId) {
            this.getCopilot(promptText);
            return;
        }
        getContinueCopilotResponse({
            message: promptText,
            chatId: this.chatId
        })
           .then((response) => {
             this.chatId = response.conversation.id;
                console.log("Raw response:", JSON.stringify(response));
                let cResponse;
                try {
                    cResponse = JSON.parse(response.message.answer);
                    // console.log('Parsed response:', cResponse);
                } catch (error) {
                    console.error("Failed to parse response:", response.message.answer);
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, response.message.answer, null, null);
                    return;
                }

                const data = cResponse.data;
                const responses = cResponse.response;
                if (Array.isArray(data)) {
                    console.log('Aray;');
                    let isArrayData = true;
                    if (!Array.isArray(data) || data.length === 0) {
                        isArrayData = false;
                    }
                    this.columns = this.getDataTableColumns(data);
                    const formattedData = this.formatTabelAmountData(data);
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, isArrayData, null, this.columns, formattedData);
                }
                //  If response is a string → show as text
                else if (typeof responses === "string") {
                    console.log('String');
                    // console.log('Response is string:', responses);
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, responses, null, null);
                }
                //  If response is an array of objects → extract each item.response
                else if (Array.isArray(responses)) {
                     console.log('Stringresponses');
                    responses.forEach((item) => {
                        if (item && typeof item === "object" && "response" in item) {
                            this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, JSON.stringify(item.response), null, null);
                        }
                    });
                } else if ("result" in cResponse) {
                    console.log('StringcResponse');
                    const result = cResponse.result;
                    if (Array.isArray(result) && result.every(Array.isArray)) {
                        const flatResult = result.flat().join(" ");
                        // console.log('Flattened result:', flatResult);
                        this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, flatResult, null, null);
                    } else {
                        // console.log('Result is not array of arrays. Treating as table...');
                        let isArrayData = true;
                        if (!Array.isArray(result) || result.length === 0) {
                            isArrayData = false;
                        }
                        this.columns = this.getDataTableColumns(result);
                        const formattedData = this.formatTabelAmountData(result);

                        this.updateMessageStatus(this.messages[this.messages.length - 1], response, isArrayData, null, this.columns, formattedData);
                    }
                } else {
                    console.log("Unknown structure. Displaying raw answer as text.");
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, JSON.stringify(response.message.answer), null, null);
                }
            })
            .catch((error) => {
                console.error("Error continuing conversation:", error);
                this.updateMessageStatus(this.messages[this.messages.length - 1], {
                    isSuccess: false
                });
            })
            .finally(() => {
                this.isGenerating = false;
            });
    }

    /**
     * This method is used to check if the message is last in the conversation.
     * @param {object} message
     * @returns
     */
    isLastMessage(message) {
        return this.messages.length > 0 && this.messages[this.messages.length - 1].id === message.id;
    }

    async getCopilot() {
        await getCopilotResponse({
            question: this.messages[this.messages.length - 1].prompt.trim()
        })
            .then((response) => {
                this.chatId = response.conversation.id;
                console.log("Raw response:", JSON.stringify(response));
                let cResponse;
                try {
                    cResponse = JSON.parse(response.message.answer);
                    // console.log('Parsed response:', cResponse);
                } catch (error) {
                    console.error("Failed to parse response:", response.message.answer);
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, response.message.answer, null, null);
                    return;
                }

                const data = cResponse.data;
                const responses = cResponse.response;
                if (Array.isArray(data)) {
                    let isArrayData = true;
                    if (!Array.isArray(data) || data.length === 0) {
                        isArrayData = false;
                    }
                    this.columns = this.getDataTableColumns(data);
                    const formattedData = this.formatTabelAmountData(data);
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, isArrayData, null, this.columns, formattedData);
                }
                //  If response is a string → show as text
                else if (typeof responses === "string") {
                    // console.log('Response is string:', responses);
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, responses, null, null);
                }
                //  If response is an array of objects → extract each item.response
                else if (Array.isArray(responses)) {
                    responses.forEach((item) => {
                        if (item && typeof item === "object" && "response" in item) {
                            this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, JSON.stringify(item.response), null, null);
                        }
                    });
                } else if ("result" in cResponse) {
                    const result = cResponse.result;
                    if (Array.isArray(result) && result.every(Array.isArray)) {
                        const flatResult = result.flat().join(" ");
                        // console.log('Flattened result:', flatResult);
                        this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, flatResult, null, null);
                    } else {
                        // console.log('Result is not array of arrays. Treating as table...');
                        let isArrayData = true;
                        if (!Array.isArray(result) || result.length === 0) {
                            isArrayData = false;
                        }
                        this.columns = this.getDataTableColumns(result);
                        const formattedData = this.formatTabelAmountData(result);

                        this.updateMessageStatus(this.messages[this.messages.length - 1], response, isArrayData, null, this.columns, formattedData);
                    }
                } else {
                    console.log("Unknown structure. Displaying raw answer as text.");
                    this.updateMessageStatus(this.messages[this.messages.length - 1], response, false, JSON.stringify(response.message.answer), null, null);
                }
            })
            .catch((error) => {
                console.error("Error continuing conversation:", error);
                this.updateMessageStatus(this.messages[this.messages.length - 1], {
                    isSuccess: false
                });
            })
            .finally(() => {
                this.isGenerating = false;
            });
    }

    getDataTableColumns(data, avoidStateChange = false) {
        // console.log('Input data for columns:', JSON.stringify(data));
        let formatData = Array.isArray(data) ? data : data.result || data.data;
        if (!Array.isArray(formatData) || formatData.length === 0) {
            console.warn("Invalid or empty table data");
            return [];
        }
        const dataWithId = this.addIdToData(formatData);
        const cleanedData = this.removeSpacesFromKeys(dataWithId);
        if (!avoidStateChange) {
            this.tableData = cleanedData;
        }
        const keys = Object.keys(cleanedData[0]).filter((key) => key !== "Id");
        return keys.map((key) => ({
            label: this.capitalizeFirstLetter(key),
            fieldName: key,
            type: "text"
        }));
    }
    capitalizeFirstLetter(string) {
        return string
            .split(" ")
            .filter((word) => word.length > 0)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }
    updateMessageStatus(message, response, isDataTableValue, responseText, tableCloumns, tableDatavals) {
        // console.log('***Response--updateStatus', JSON.stringify(response.conversation));

        try {
            if (response.isSuccess) {
                let apiResponse = JSON.parse(response.message.answer);
                // console.log('***Parsed API Response', JSON.stringify(apiResponse));
                let plainTextResponse = "";
                let retrievedChunks = null;
                if (apiResponse && typeof apiResponse === "object" && "success" in apiResponse) {
                    if (!apiResponse.success) {
                        console.log("Error:", apiResponse.statusMessage);
                        plainTextResponse = apiResponse.statusMessage;
                    }
                    if (apiResponse.data) {
                        console.log(apiResponse.data);
                    }
                } else if (Array.isArray(apiResponse.response)) {
                    plainTextResponse = apiResponse.response
                        .map((item) => {
                            if (typeof item === "string") return item;
                            if (typeof item === "object") {
                                retrievedChunks = item.retrieved_chunks || null;
                                return item.response;
                            }
                            return "";
                        })
                        .join("\n\n");
                } else if (typeof apiResponse.response === "string") {
                    plainTextResponse = apiResponse.response;
                    if (apiResponse.data) {
                        console.log("1--" + JSON.stringify(apiResponse.data));
                        console.log("1--" + JSON.parse(JSON.stringify(apiResponse.data)));
                    }
                } else {
                    plainTextResponse = JSON.stringify(apiResponse.response);
                    plainTextResponse = plainTextResponse;
                    if (apiResponse.data) {
                        console.log("2--" + JSON.stringify(apiResponse.data));
                    }
                }

                let formattedSources = "";
                if (apiResponse.sources && Array.isArray(apiResponse.sources)) {
                    console.log("Sources: " + apiResponse.sources);
                    formattedSources = apiResponse.sources
                        .map((src) => {
                            // Extract text and URL from Markdown
                            const match = src.match(/\[(.*?)\]\((.*?)\)/);
                            if (match) {
                                const label = match[1];
                                const url = match[2];
                                return src.replace(match[0], `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
                            }
                            return src;
                        })
                        .join("<br>");
                }
                console.log(tableCloumns);
                console.log(tableDatavals);
                if(tableCloumns==null && tableDatavals==null){
                    plainTextResponse = 'No data found';
                }
                Object.assign(message, {
                    id: response.message.id,
                    status: "Complete",
                    statusIsComplete: true,
                    statusIsError: false,
                    isLastMessage: true,
                    answer: response.message.answer,
                    timestamp: response.message.timestamp,
                    isDataTable: isDataTableValue,
                    reponseTextValue: plainTextResponse,
                    retrievedChunks: retrievedChunks,
                    tableCloumnfromAPI: tableCloumns,
                    tableDataFromAPI: tableDatavals,
                    apiResult: apiResponse.result,
                    apiQuery: apiResponse.query,
                    isChart: isDataTableValue,
                    dataObject: apiResponse.data,
                    isSource: formattedSources !== "",
                    sources: `<br>\n\nSources:\n\n${formattedSources}`,
                    chartData: {
                        chartType: "bar",
                        data: apiResponse.data || apiResponse.response
                    }
                });
                console.log(response.message);
                console.log(response.message.tableCloumnfromAPI);
                console.log(response.message.tableDataFromAPI);
                if (apiResponse.data) {
                    if (Array.isArray(apiResponse.data)) {
                        this.prepareChartData(message, "PORTFOLIO", "SCORE", "#1f77b4", "Score by Portfolio");
                    } else if (typeof apiResponse.data === "object") {
                        message.isDataObject = true;
                    }
                }
                this.shouldScrollToBottom = true;
                this.userSessionId = response.message.sessionId;
                this.chatId = response.conversation.id;
                this.answerParagraphs = plainTextResponse.split("\n\n").map((paragraph) => ({
                    lines: paragraph.split("\n").map((line, index, arr) => ({
                        text: line,
                        addBreak: index < arr.length - 1
                    }))
                }));
                response.conversation.title = response.message.prompt;
                response.conversation.lastMessageTimestamp = new Date();
                response.conversation.chatHistoryUniqueId = this.generateChatHistoryUniqueId();
                this.dispatchEvent(new CustomEvent("handleConversationUpdate", { detail: response.conversation }));
            } else {
                Object.assign(message, {
                    status: "Error",
                    statusIsComplete: false,
                    statusIsError: true
                });
                this.shouldScrollToBottom = true;
                console.error("Operation failed:", response.errorMessage);
            }
        } catch (error) {
            console.error("Error in updateMessageStatus:", error.message);
        }
    }

    addIdToData(data) {
        return data.map((item, index) => {
            return {
                ...item, // Spread the existing object properties
                Id: `record-${index + 1}` // Add an Id field, using a unique identifier
            };
        });
    }
    removeSpacesFromKeys(data) {
        return data.map((item) => {
            const newItem = {};
            Object.keys(item).forEach((key) => {
                // Remove spaces from the key
                const newKey = key?.replace(/\s+/g, "");
                // Assign the value to the new key
                newItem[newKey] = item[key];
            });
            return newItem;
        });
    }

    generateChatHistoryUniqueId() {
        return `id-${Date.now()}`;
    }

    formatTabelAmountData(data) {
        return data.map((item) => {
            const formattedItem = {};

            for (const key in item) {
                if (!item.hasOwnProperty(key)) continue;

                const value = item[key];

                if (typeof value === "string" && value.includes("$")) {
                    const numericValue = parseFloat(value.replace(/[$,]/g, ""));

                    formattedItem[key] = !isNaN(numericValue) ? `$ ${numericValue.toLocaleString()}` : value;
                } else {
                    formattedItem[key] = value;
                }
            }
            // console.log('FormatedItem' + JSON.stringify(formattedItem));
            return formattedItem;
        });
    }

    prepareChartData(message, xKey, yValue, color, chartTitle) {
        try {
            var data = message.chartData.data;
            var chartData = [];
            if (Array.isArray(message.chartData.data)) {
                data.forEach((c) => {
                    if (c[yValue]) {
                        chartData.push({ label: c[xKey], value: c[yValue], color: color });
                        this.chartTitle = chartTitle;
                    }
                });
                message.chartData.data = chartData;
                if (chartData.length > 0) {
                    message.showChart = true;
                } else {
                    message.showChart = false;
                }
                console.log(chartData);
            }
        } catch (error) {
            message.showChart = false;
        }
        console.log(message);
    }
}