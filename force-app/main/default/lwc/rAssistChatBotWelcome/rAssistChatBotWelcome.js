import { LightningElement, track, api, wire } from "lwc";


export default class RAssistChatBotWelcome extends LightningElement {
    queries = [
        {
            id: "preferred-partner",
            text: "What are my pending tasks",
            fullText: "What are my pending tasks"
        },
        {
            id: "value-index-1",
            text: "Find the total backlog for each compensation plan",
            fullText: "Find the total backlog for each compensation plan"
        },
        {
            id: "value-index-2",
            text: "Show me jira tickets in to do",
            fullText: "Show me jira tickets in to do"
        },
        {
            id: "value-public",
            text: "What task do I have associated with market survey?",
            fullText: "What task do I have associated with market survey?"
        },
        {
            id: "cert-count-1",
            text: "Show me demand forecast for Samsung Tab in North America",
            fullText: "Show me demand forecast for Samsung Tab in North America"
        }
    ];

    get greeting() {
        const hour = new Date().getHours();
        return hour < 12 ? "Good Morning!" : hour < 18 ? "Good Afternoon!" : "Good Evening!";
    }

    handleClick(event) {
        const id = event.target.dataset.id;
        const query = this.queries.find((q) => q.id === id);
        this.dispatchEvent(new CustomEvent("queryclick", { detail: query }));
    }
    
    viewAllQueries() {
        // this.dispatchEvent(new CustomEvent("viewallqueries"));
    }

}