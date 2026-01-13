public class AFD_PMDAnalysis {

    public class PmdViolation {
        @AuraEnabled public String rule;
        @AuraEnabled public String message;
        @AuraEnabled public Integer line;
        @AuraEnabled public String severity;
        @AuraEnabled public String className;
    }

    @AuraEnabled
    public static List<PmdViolation> analyzeClasses(List<Id> classIds) {
        List<PmdViolation> allViolations = new List<PmdViolation>();

        if (classIds.isEmpty()) return allViolations;

        // Fetch Apex class source code
        List<ApexClass> classes = [
            SELECT Id, Name, Body
            FROM ApexClass
            WHERE Id IN :classIds
        ];

        // Prepare JSON payload for PMD server
        Map<String, Object> payload = new Map<String, Object>();
        List<Object> sources = new List<Object>();
        for (ApexClass ac : classes) {
            sources.add(new Map<String, Object>{
                'name' => ac.Name,
                'source' => ac.Body
            });
        }
        payload.put('classes', sources);

        try {
            HttpRequest req = new HttpRequest();
            // TODO: REPLACE WITH YOUR RENDER APP URL
            // Example: https://your-app-name.onrender.com/analyze
            req.setEndpoint('https://REPLACE_WITH_YOUR_RENDER_URL.onrender.com/analyze'); 
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(120000);
            req.setBody(JSON.serialize(payload));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> raw = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

                // 'violations' key contains the list of PMD issues
                if (raw.containsKey('violations')) {
                    List<Object> issues = (List<Object>) raw.get('violations');

                    for (Object o : issues) {
                        Map<String, Object> issue = (Map<String, Object>) o;
                        PmdViolation v = new PmdViolation();
                        v.rule = (String) issue.get('rule');
                        v.message = (String) issue.get('description'); // PMD uses 'description'
                        v.line = issue.containsKey('beginline') ? (Integer) issue.get('beginline') : null;
                        v.severity = issue.containsKey('priority') ? String.valueOf(issue.get('priority')) : null;
                        v.className = (String) issue.get('className');
                        allViolations.add(v);
                    }
                }

                // Optional: log warnings from PMD server
                if (raw.containsKey('warnings')) {
                    List<Object> warnings = (List<Object>) raw.get('warnings');
                    for (Object w : warnings) {
                        System.debug('⚠️ PMD Warning: ' + w);
                    }
                }

            } else {
                System.debug('❌ PMD server error: ' + res.getStatusCode() + ' - ' + res.getBody());
            }

        } catch (CalloutException ce) {
            System.debug('❌ PMD callout failed: ' + ce.getMessage());
        } catch (Exception e) {
            System.debug('❌ Unexpected error: ' + e.getMessage());
        }

        return allViolations;
    }
}