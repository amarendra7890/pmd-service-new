import { LightningElement, api } from "lwc";
import chartjs from "@salesforce/resourceUrl/RChartJs";
import { loadScript } from "lightning/platformResourceLoader";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class RAssistChartGenerator extends LightningElement {
    @api apiData;

    isChartJsInitialized = false;
    chartInstance;
    chartConfig;

    labelField;
    valueField;
    fieldOptions = [];

    get showFieldOptions() {
        // return this.fieldOptions.length > 1;
        return false;
    }

    connectedCallback() {
        this.initializeFields();
        this.loadChartData();
    }

    renderedCallback() {
        if (this.isChartJsInitialized) return;

        loadScript(this, chartjs)
            .then(() => {
                this.isChartJsInitialized = true;
                this.renderChart();
            })
            .catch((error) => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: "Error loading ChartJS",
                        message: error.message,
                        variant: "error"
                    })
                );
            });
    }

    initializeFields() {
        const rawData = this.apiData?.data || [];
        if (!Array.isArray(rawData) || rawData.length === 0) return;

        const sample = rawData[0];
        const keys = Object.keys(sample);
        this.fieldOptions = keys.map((k) => ({ label: k, value: k }));

        const { labelField, valueField } = this.detectFields(keys);
        this.labelField = labelField;
        this.valueField = valueField;
    }

    detectFields(keys) {
        const lowerKeys = keys.map((k) => k.toLowerCase());
        const labelPriority = ["portfolio", "month_year", "category", "METRIC", "name", "type", "label", "x"];
        const valuePriority = ["score", "value", "amount", "total", "count", "y"];

        const findMatch = (priorityList) => {
            for (let item of priorityList) {
                const index = lowerKeys.findIndex((k) => k.includes(item));
                if (index !== -1) return keys[index];
            }
            return null;
        };

        const labelField = findMatch(labelPriority) || keys[0];
        const valueField = findMatch(valuePriority) || keys.find((k) => k !== labelField) || keys[1] || keys[0];

        return { labelField, valueField };
    }
    isLoading = false;
    loadChartData() {
        this.isLoading = false;
        const rawData = this.apiData?.data || [];
        const chartType = this.apiData?.chartType || "bar";

        const labels = rawData.map((item) => item[this.labelField] || "");
        const dataValues = rawData.map((item) => item[this.valueField] || 0);

        this.chartConfig = {
            type: chartType,
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Value",
                        data: dataValues,
                        backgroundColor: "#4e79a7"
                    }
                ]
            },
            // options: {
            //     responsive: true,
            //     maintainAspectRatio: false,
            //     plugins: {
            //         legend: {
            //             display: true,
            //             labels: {
            //                 boxWidth: 10
            //             },
            //             position: "right",
            //             align: "start"
            //         },
            //         tooltip: { enabled: true }
            //     },
            //     scales: {
            //         y: {
            //             display: true,
            //             beginAtZero: true,
            //             min: 0,
            //             // Grid settings
            //             grid: {
            //                 display: true,
            //                 drawBorder: true,
            //                 drawOnChartArea: true,
            //                 drawTicks: true
            //             }
            //         },
            //         x: {
            //             /*ticks: {
            //                 autoSkip: false
            //             },*/
            //             display: true,
            //             categoryPercentage: 0.6, // Thinner bars
            //             barPercentage: 0.8,
            //             grid: {
            //                 display: true,
            //                 drawBorder: true,
            //                 drawOnChartArea: true,
            //                 drawTicks: true
            //             },
            //             barThickness: 50
            //         }
            //     },
            //     elements: {
            //         bar: {
            //             // Set maximum bar thickness in pixels
            //             maxBarThickness: 50,
            //             // Set minimum bar length
            //             minBarLength: 2
            //         }
            //     }
            // }
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: true,
                    position: "top",
                    labels: {
                        boxWidth: 10,
                        fontSize: 10, // Adjust this for legend label size
                        padding: 8 // Space between legend items
                    },
                    align: "start"
                },
                tooltips: {
                    enabled: true
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            beginAtZero: true,
                            min: 0
                        },
                        gridLines: {
                            display: true,
                            drawBorder: true,
                            drawOnChartArea: true,
                            drawTicks: true
                        }
                    }],
                    xAxes: [{
                        display: true,
                        categoryPercentage: 0.5, // Adjusts category width (lower = thinner)
                        barPercentage: 0.7, // Adjusts bar width within the category
                        gridLines: {
                            display: true,
                            drawBorder: true,
                            drawOnChartArea: true,
                            drawTicks: true
                        }
                        // barThickness: 10,  <- Not supported in v2.7 as expected
                    }]
                }
            }

        };
        this.isLoading = true;
    }

    renderChart() {
        const ctx = this.template.querySelector("canvas.barChart").getContext("2d");

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new window.Chart(ctx, JSON.parse(JSON.stringify(this.chartConfig)));
        this.chartInstance.resize();
        if (!import.meta.env.SSR) {
            window.addEventListener("resize", () => this.chart.chartInstance());
        }
    }

    disconnectedCallback() {
        window.removeEventListener("resize", this.handleResize);
    }

    handleResize = () => {
        if (this.chartInstance) {
            this.chartInstance.resize();
        }
    };

    handleLabelChange(event) {
        this.labelField = event.detail.value;
        this.loadChartData();
        this.renderChart();
    }

    handleValueChange(event) {
        this.valueField = event.detail.value;
        this.loadChartData();
        this.renderChart();
    }
}