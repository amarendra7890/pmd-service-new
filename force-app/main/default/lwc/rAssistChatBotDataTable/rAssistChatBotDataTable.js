import { LightningElement, api } from "lwc";

export default class RAssistChatBotDataTable extends LightningElement {
    @api
    tableData = [];
    @api
    columns = [];

    arrayData;
    connectedCallback() {
    }

    @api
    get receivedTableData() {
        return this._fruit;
    }
    set receivedTableData(value) {
        this.handleValueChange(value); // Custom logic here
    }
    handleValueChange(data) {

        this.columns = [...new Set(
            data.flatMap(c => Object.keys(c))
        )];
        /*this.tableData = obj.forEach(c =>{
            console.log(Object.keys(c));
        });*/
        this.tableData = data.map(obj =>
            this.columns.map(key => obj[key] || '') // Handle missing values
        );
        console.log(this.tableData);
        console.log(this.columns);
        console.log(JSON.stringify(this.tableData));
    }

    processData() {
        this.columns = [...new Set(
            this.arrayData.flatMap(c => Object.keys(c))
        )];
        /*this.tableData = obj.forEach(c =>{
            console.log(Object.keys(c));
        });*/
        this.tableData = this.arrayData.map(obj =>
            this.columns.map(key => obj[key] || '') // Handle missing values
        );
        console.log(this.tableData);
        console.log(this.columns);
        console.log(JSON.stringify(this.tableData));
    }
}