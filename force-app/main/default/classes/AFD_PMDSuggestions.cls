public class AFD_PMDSuggestions {
	public class PmdViolation {
        public String className { get; set; }
        public Integer line { get; set; }
        public String message { get; set; }
        public String rule { get; set; }
        public String severity { get; set; }
    }

    @AuraEnabled
    public static String getAISuggestionForViolation(String violationJson) {
        try {
            PmdViolation v = (PmdViolation) JSON.deserialize(violationJson, PmdViolation.class);
            
            // Query the class body to get the code context
            ApexClass cls = [SELECT Body FROM ApexClass WHERE Name = :v.className LIMIT 1];
            String[] commonSplits = cls.Body.split('\n');
            Integer lineIndex = v.line - 1;
            String codeSnippet = '';
            
            if (lineIndex >= 0 && lineIndex < commonSplits.size()) {
                codeSnippet = commonSplits[lineIndex];
            } else {
                codeSnippet = '// Code line not found';
            }

            // Prepare payload
            Map<String,Object> payload = new Map<String,Object>{
                'prompt' => 'Fix this Apex code to comply with PMD rule: ' + v.rule + '. Message: ' + v.message,
                'code'   => codeSnippet
            };

            HttpRequest req = new HttpRequest();
            // TODO: REPLACE WITH YOUR RENDER APP URL
            req.setEndpoint('https://REPLACE_WITH_YOUR_RENDER_URL.onrender.com/fix');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(60000);
            req.setBody(JSON.serialize(payload));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                 Map<String, Object> resp = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                 return (String) resp.get('patch');
            } else {
                 return 'Error from AI service: ' + res.getBody();
            }
        } catch (Exception e) {
            return 'Error getting AI suggestion: ' + e.getMessage();
        }
    }
}