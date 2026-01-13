import { LightningElement, api } from "lwc";

export default class RAssistPeriodicDataTable extends LightningElement {
    @api
    data;

    connectedCallback() {
    }


    get pastColumns() {
        if (!this.data.past) return [];

        const firstMetric = Object.keys(this.data.past)[0];
        const months = Object.keys(this.data.past[firstMetric]);
        months.reverse();

        return ["Metric", ...months];
    }

    get currentColumns() {
        if (!this.data.current) return [];

        const firstMetric = Object.keys(this.data.current)[0];
        const months = Object.keys(this.data.current[firstMetric]);
        months.reverse();
        return ["Metric", ...months];
    }

    get pastRows() {
        if (!this.data.past) return [];

        let pastRowData = Object.keys(this.data.past).map((metricName) => {
            const metric = this.data.past[metricName];
            return {
                metric: metricName,
                values: Object.values(metric).reverse()
            };
        });
        return pastRowData.reverse();
    }

    get currentRows() {
        if (!this.data.current) return [];

        return Object.keys(this.data.current).map((metricName) => {
            const metric = this.data.current[metricName];
            return {
                metric: metricName,
                values: Object.values(metric).reverse()
            };
        });
    }
}