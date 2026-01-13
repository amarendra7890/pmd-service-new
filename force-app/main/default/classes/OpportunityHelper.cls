public class OpportunityHelper {
    
    /**
     * Auto-populate opportunity description based on amount
     */
    public static void updateDescription(List<Opportunity> opportunities) {
        for (Opportunity opp : opportunities) {
            if (opp.Amount != null && opp.Amount > 100000) {
                opp.Opportunity_Level__c = 'Hot Opportunity';
            } else if (opp.Amount != null && opp.Amount > 50000) {
                opp.Opportunity_Level__c = 'Warm Opportunity';
            } else {
                opp.Opportunity_Level__c = 'Standard Opportunity';
            }
        }
    }
}