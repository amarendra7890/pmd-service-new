public without sharing class SalesCopilotController {
	public static final string QUERY_API_END_POINT_URL = Relanto_General_Settings__c.getOrgDefaults().Relanto_Gen_API_Bot_Response_URl__c;

	@AuraEnabled
	public static RChatResponseWrapper getCopilotResponse(String question) {
         System.debug('user query' + question);
		String copilotResponse = '';
          RChatResponseWrapper rWrapper;
		HttpResponse res = getResponseData(question, QUERY_API_END_POINT_URL);
		if (res.getStatus() == 'OK' && res.getStatusCode() == 200) {
			System.debug('Response: ' + res.getBody());
			copilotResponse = res.getBody();
            Chat_Template__c chatTemplate=createChatTemplate(question);
            Chat_Transactions__c chatTransaction= createTransaction(chatTemplate,question,copilotResponse);
            rWrapper = new RChatResponseWrapper(chatTemplate,chatTransaction);
            System.debug('******rWrapper'+rWrapper);
		}
		System.debug('******rWrapper' + rWrapper);
		return rWrapper;
	}

	public static HttpResponse getResponseData(
		String queryMessage,
		String endPoint
	) {
		HttpRequest req = new HttpRequest();
		req.setEndpoint(endPoint);
		req.setMethod('POST');
		req.setHeader('Content-Type', 'application/json');
		req.setBody('{"query": "' + queryMessage + '"}');
        req.setTimeout(60000);
		Http http = new Http();
		HttpResponse res = http.send(req);
		System.debug('Response: ' + res.getBody());
        
        
		return res;
	}

	public static Chat_Template__c createChatTemplate(string message){

    Chat_Template__c chatTemplate= new Chat_Template__c();
    chatTemplate.Name=message.left(70);
    chatTemplate.Last_Accessed_Time__c=System.now();
    chatTemplate.Chat_Id__c=getChatConversationId();
    //chatTemplate.Last_Session_Id__c=userinfo.getSessionId();
    insert chatTemplate;

    return chatTemplate;

}
  public static Chat_Transactions__c createTransaction(Chat_Template__c chatTemplete,String message, String responsePayload){

    Chat_Transactions__c chatTransaction= new Chat_Transactions__c();
    chatTransaction.Question__c=message;
    chatTransaction.Chat_Template__c=chatTemplete.Id;
    chatTransaction.Chat_Transaction_Id__c=getChatRequestId();
    chatTransaction.Answer__c=responsePayload;
    chatTransaction.Status__c='Completed';
    insert chatTransaction;

    return chatTransaction;
}
  public static string getChatConversationId() {
    return UUID.randomUUID().toString();
  }

  public static string getChatRequestId() {
    return UUID.randomUUID().toString();
  }  
    
  @AuraEnabled
    public static RChatResponseWrapper toContinueChatConversation(String message,string chatId){
        HttpResponse res = getResponseData(message, QUERY_API_END_POINT_URL);
        RChatResponseWrapper rWrapper;
        if (res.getStatus() == 'OK' && res.getStatusCode() == 200) {
            System.debug('Response: ' + res.getBody());
            Chat_Template__c chatTemplateRec= getChatTemplateRecord(chatId);
            Chat_Transactions__c chatTransaction=createContinueChatTransaction(chatId,message,res.getBody());
             rWrapper = new RChatResponseWrapper(chatTemplateRec,chatTransaction);
        }
        System.debug('To Continue Message'+rWrapper);
       return rWrapper;
        
    }
     public static Chat_Transactions__c createContinueChatTransaction(String chatId,String message,String responsePayload){
    Chat_Template__c chatTemplateRec= getChatTemplateRecord(chatId);
    Chat_Transactions__c chatTransaction= new Chat_Transactions__c();
    chatTransaction.Question__c=message;
    chatTransaction.Chat_Template__c=chatTemplateRec.Id;
    chatTransaction.Chat_Transaction_Id__c=getChatRequestId();
    chatTransaction.Answer__c=responsePayload;
    chatTransaction.Status__c='Completed';
    insert chatTransaction;

    return chatTransaction;
        }
    
    public static Chat_Template__c getChatTemplateRecord(String chatId){
        
        return [Select Id, OwnerId, IsDeleted, Name, Chat_Id__c, Last_Accessed_Time__c, Last_Session_Id__c from Chat_Template__c where Chat_Id__c=:chatId LIMIT 1];
    }
    
        @AuraEnabled(cacheable=true)
    public static List<Chat_Transactions__c> fetchMessagesByChatId(String chatId){
        
            return [Select id,Question__c, Answer__c from Chat_Transactions__c where Chat_Template__r.Chat_Id__c =: chatId order by createddate desc];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Chat_Template__c> getUserChatTemplateRecords(){
        
        String userId = Userinfo.getUserId();        
        return [Select Id, OwnerId, IsDeleted, Name, Chat_Id__c, Last_Accessed_Time__c, Last_Session_Id__c from Chat_Template__c where
                createdbyId =:userId];
    }
    
  @AuraEnabled
  public static List<RelantoChatConversation> fetchChatsFromChatTemplate(Integer offset) {
    return RelantoChatTransactionData.getChatConversations(offset);
  }
    @AuraEnabled
 public static List<RelantoChatMessage> fetchTransactionsByChatId(String chatId) {
     System.debug('chatId'+chatId);
    return RelantoChatTransactionData.getMessagesByChatId(chatId);
  }
}