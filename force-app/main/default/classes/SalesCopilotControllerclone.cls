/**
* @description       : 
* @author            : ChangeMeIn@UserSettingsUnder.SFDoc
* @group             : 
* @last modified on  : 09-12-2024
* @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class SalesCopilotControllerclone {
    
    public static final string QUERY_API_END_POINT_URL = Relanto_General_Settings__c.getOrgDefaults().Relanto_Gen_API_Bot_Response_URl__c;
    
    //Feature flag for API REsponse
    public static final Feature_Flag__mdt API_FEATURE_FLAG = Feature_Flag__mdt.getInstance('Relanto_Gen_AI_Rest_Service');
    
    @AuraEnabled
    public static RChatResponseWrapper getCopilotResponse(String question) {
        System.debug('user query' + question);
        String copilotResponse = '';
        RChatResponseWrapper rWrapper;
        try{
        if(API_FEATURE_FLAG.Is_Active__c){
            
            HttpResponse res = getResponseData(question, QUERY_API_END_POINT_URL);
            if (res.getStatus() == 'OK' && res.getStatusCode() == 200) {
                System.debug('Response: ' + res.getBody());
                copilotResponse = res.getBody();
                Chat_Template__c chatTemplate=createChatTemplate(question);
                Chat_Transactions__c chatTransaction= createTransaction(chatTemplate,question,copilotResponse);
                rWrapper = new RChatResponseWrapper(chatTemplate,chatTransaction);
                System.debug('******rWrapper'+rWrapper);
            }
        }
        }catch(Exception ex){
            copilotResponse='{' +
    '"response": [' +
        '{' +
            '"response": "Apologies for the inconvenience, but I will only be able to address questions within the company\'s policy guidelines.",' +
            '"retrieved_chunks": "<b>Respective document: ABCInc - A2ZSales FAQ 2024.txt</b>\\n\\n<br>ABCInc-A2ZSales FAQ 2024watch the sales compensation 101 in 3 minutes video on the sales compensation hubfor a simpleexample with explanation.example payment calculation (demo data)where can i find the acceleration rate tables for my compensation plan?rate tables may be found in your individual incentive compensation plan or iicp,but they also can befound in a2zsales when you drill down into the payment calculation for a quotacomponent. you mayneed to scroll down to see the link to expand the rate table. (see above screenshot)how is the payout rate in my incentive pay calculation determined?the payout rate is determined by your revenue attainment and the rate tables foryour compensationplan. rate tables indicate the payout multiplier used for different levels ofattainment:abcinc plans pay the first 100% of attainment at a straight rate, or a multiplierof 1accelerators (i.e. a higher multiplier) are activated when revenue attainmentgoes above 100%,<br>\\n\\n======================================\\n\\n<br><b>Respective document: ABCInc - A2ZSales FAQ 2024.txt</b>\\n\\n<br>ABCInc-A2ZSales FAQ 2024why are the direct and pos summaries different in payments vs. goal to cash?................................ 13payments.................................................................................................................................................... 14payments summary................................................................................................................................ 14how is incentive pay calculated?............................................................................................................ 14where can i find the acceleration rate tables for my compensation plan?........................................... 15",' +
            '"retrieved_links": []' +
        '}' +
    ']' +
'}';
        
            Chat_Template__c chatTemplate=createChatTemplate(question);
            Chat_Transactions__c chatTransaction= createTransaction(chatTemplate,question,copilotResponse);
            rWrapper = new RChatResponseWrapper(chatTemplate,chatTransaction);
       
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
        //req.setBody('{"query": "' + queryMessage + '"}');
        req.setBody('{"query": "' + queryMessage + '","user_id": "user_1"}');
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
        chatTransaction.Is_Chart__c=isChartinMessage(message);
        insert chatTransaction;
        
        return chatTransaction;
    }
    public static string getChatConversationId() {
        return UUID.randomUUID().toString();
    }
    public static boolean isChartinMessage(String promptVal){
        System.debug('promptVal'+promptVal);
        if(promptVal?.containsIgnoreCase('chart')){
            return true;
        }else {
            return false;
        }
    }
    
    public static string getChatRequestId() {
        return UUID.randomUUID().toString();
    }  
    
    @AuraEnabled
    public static RChatResponseWrapper toContinueChatConversation(String message,string chatId){
        
        RChatResponseWrapper rWrapper;
        try{
        if(API_FEATURE_FLAG.Is_Active__c){
            HttpResponse res = getResponseData(message, QUERY_API_END_POINT_URL);
            if (res.getStatus() == 'OK' && res.getStatusCode() == 200) {
                System.debug('Response: ' + res.getBody());
                Chat_Template__c chatTemplateRec= getChatTemplateRecord(chatId);
                Chat_Transactions__c chatTransaction=createContinueChatTransaction(chatId,message,res.getBody());
                rWrapper = new RChatResponseWrapper(chatTemplateRec,chatTransaction);
            }
        }
        }catch(Exception ex){
           String   copilotResponse='{' +
    '"response": [' +
        '{' +
            '"response": "Apologies for the inconvenience, but I will only be able to address questions within the company\'s policy guidelines.",' +
            '"retrieved_chunks": "<b>Respective document: ABCInc - A2ZSales FAQ 2024.txt</b>\\n\\n<br>ABCInc-A2ZSales FAQ 2024watch the sales compensation 101 in 3 minutes video on the sales compensation hubfor a simpleexample with explanation.example payment calculation (demo data)where can i find the acceleration rate tables for my compensation plan?rate tables may be found in your individual incentive compensation plan or iicp,but they also can befound in a2zsales when you drill down into the payment calculation for a quotacomponent. you mayneed to scroll down to see the link to expand the rate table. (see above screenshot)how is the payout rate in my incentive pay calculation determined?the payout rate is determined by your revenue attainment and the rate tables foryour compensationplan. rate tables indicate the payout multiplier used for different levels ofattainment:abcinc plans pay the first 100% of attainment at a straight rate, or a multiplierof 1accelerators (i.e. a higher multiplier) are activated when revenue attainmentgoes above 100%,<br>\\n\\n======================================\\n\\n<br><b>Respective document: ABCInc - A2ZSales FAQ 2024.txt</b>\\n\\n<br>ABCInc-A2ZSales FAQ 2024why are the direct and pos summaries different in payments vs. goal to cash?................................ 13payments.................................................................................................................................................... 14payments summary................................................................................................................................ 14how is incentive pay calculated?............................................................................................................ 14where can i find the acceleration rate tables for my compensation plan?........................................... 15",' +
            '"retrieved_links": []' +
        '}' +
    ']' +
'}';
        
            Chat_Template__c chatTemplate=createChatTemplate(chatId);
            Chat_Transactions__c chatTransaction= createTransaction(chatTemplate,message,copilotResponse);
            rWrapper = new RChatResponseWrapper(chatTemplate,chatTransaction);
            
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
        chatTransaction.is_Chart__c=isChartinMessage(message);
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