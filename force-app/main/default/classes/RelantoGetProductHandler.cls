public class RelantoGetProductHandler {
//public static final string PRODUCT_END_POINT_URL='http://13.200.72.226:4004/get_prod_recys';
//public static final string PRODUCT_END_POINT_URL='http://3.7.243.194:4000/get_bot_response';
public static final string PRODUCT_END_POINT_URL='http://13.127.183.54:4000/get_bot_response';
public static void getProductController(List<Account> newAccountList,Map<Id,Account> oldAccounts){


    for(Account acc:newAccountList){
        if(acc.Name!=oldAccounts?.get(acc.Id)?.PRODUCT_AREA_OF_INTEREST_C__c){
             getProductNames(acc.Id);
        }else{
             getProductNames(acc.Id);
        }
       
    }

}

@future(callout=true)
public static void getProductNames(String accountId){
	//String accountName='Nippon paints';
    String accountName = getRandomCustomer();
    Map<Id,Account> mapAccount= new Map<Id,Account>([SELECT Id, Name FROM Account Where Id=:accountId]);
    HttpRequest req = new HttpRequest();
        List<Account_Product_Suggestion__c>  listAccountProducts= new List<Account_Product_Suggestion__c>();
		req.setEndpoint(PRODUCT_END_POINT_URL);
		req.setMethod('POST');
		req.setHeader('Content-Type', 'application/json');
		req.setBody('{"query": "' + accountName + '"}');
        req.setTimeout(60000);
		Http http = new Http();
		HttpResponse res = http.send(req);
		System.debug('Response: ' + res.getBody());
       Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

        List<Object> products = (List<Object>)responseData.get('result');

        for (Object obj : products) {
            Map<String, Object> productMap = (Map<String, Object>) obj;
            Account_Product_Suggestion__c accountProduct= new Account_Product_Suggestion__c();
            accountProduct.Name=(String)productMap.get('Product Family');
            //accountProduct.Name='Product_'+appendRandomAlphabet('Product');
			//accountProduct.Opportunity_Size__c=(Decimal) productMap.get('Size ($)');
            accountProduct.Opportunity_Size__c=(Decimal) productMap.get('Avg Base Price');
            accountProduct.Account__c=mapAccount?.get(accountId)?.Id;
           listAccountProducts.add(accountProduct);
        }
    	List<Account_Product_Suggestion__c> existingProductRecommendations = [SELECT Id FROM Account_Product_Suggestion__c WHERE Account__c= :accountId];
    if(!existingProductRecommendations.isEmpty()){
        delete existingProductRecommendations;	
    }
    	
    if(!listAccountProducts.isEmpty()){
        insert listAccountProducts;

    }
            

}
    
    public static String appendRandomAlphabet(String input) {
        // String containing all uppercase alphabet letters
        String alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        // Generate a random index from 0 to 25 (since there are 26 letters in the alphabet)
        Integer randomIndex = Math.floor(Math.random() * 26).intValue();
        
        // Get the character at the random index
        String randomChar = alphabet.substring(randomIndex, randomIndex + 1);
        
        // Append the random character to the input string
        return randomChar;
    }
   
	public static String getRandomCustomer() {
        // String containing all uppercase alphabet letters
        List<String> customer = new List<String> {'Nippon Paints', 'Verizon', 'Lockheed Martin'};
        
        // Generate a random index from 0 to 25 (since there are 26 letters in the alphabet)
        Integer randomIndex = Math.floor(Math.random() * 3).intValue();
        
        // Get the character at the random index
        String randomCustomer = customer[randomIndex];
        
        // Append the random character to the input string
        return randomCustomer;
    }


}