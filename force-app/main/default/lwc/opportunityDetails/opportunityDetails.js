import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

// Import Opportunity fields
import OPPORTUNITY_OBJECT from '@salesforce/schema/Opportunity';
import PREDICTED_PROBABILITY from '@salesforce/schema/Opportunity.Predicted_Probability2__c';
import { refreshApex } from "@salesforce/apex";
import OPP_WIN_PREDICTION from '@salesforce/label/c.Relanto_Win_Probabiltiy_Desc';
import { subscribe, onError } from 'lightning/empApi';

const FIELDS2 = ['Opportunity.Predicted_Probability2__c'];
const TOPIC = '/data/OpportunityChangeEvent';

// Fields array to fetch
const FIELDS = [PREDICTED_PROBABILITY];

export default class OpportunityDetails extends LightningElement {
    @api recordId; // Opportunity Id passed from parent or route
    isLoading = true;
    title = 'Win Probability';
    opportunity;
    predictedProbability;
    winProbLabel = OPP_WIN_PREDICTION;

    // Wire method to get the Opportunity record
    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredOpportunity({ error, data }) {
        if (data) {
            //this.wiredRecordResult = data;
            this.opportunity = data;
            this.predictedProbability =  Math.round(
              Math.abs(
                data.fields.Predicted_Probability2__c?.value
              )
            );
            console.log(JSON.stringify(this.opportunity));
            console.log(JSON.stringify(this.predictedProbability));
            this.isLoading = false;
        } else if (error) {
            console.error(error);
            this.isLoading = false;
        }
    }

    async handler() {
        try {
          await refreshApex(this.opportunity);
        } catch (error) {
          // handle error
        }
      }

    connectedCallback() {
      subscribe(TOPIC, -1, (msg) => {
        // Only refresh if this event is for our record
        const changedIds = msg?.data?.payload?.ChangeEventHeader?.recordIds || [];
        if (changedIds.includes(this.recordId)) {
          refreshApex(this.opportunity);
        }
      });

      onError((e) => { /* handle */ });
    }  
}