/**
 * Test class for VeryBadAccountUtils
 * Tests all scenarios including edge cases and happy paths
 */
@isTest
public class VeryBadAccountUtilsTest {
    
    /**
     * Test: Update both phone and name for multiple accounts
     */
    @isTest
    static void testUpdatePhonesAndNamesHappyPath() {
        // Setup
        List<Account> testAccounts = new List<Account>{
            new Account(Name = 'Test Account 1', Phone = '555-0001'),
            new Account(Name = 'Test Account 2', Phone = '555-0002')
        };
        insert testAccounts;
        
        List<Id> accountIds = new List<Id>{testAccounts[0].Id, testAccounts[1].Id};
        String newPhone = '555-9999';
        String nameSuffix = ' - Updated';
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, newPhone, nameSuffix);
        Test.stopTest();
        
        // Assert
        List<Account> updatedAccounts = [SELECT Id, Phone, Name FROM Account WHERE Id IN :accountIds ORDER BY Name];
        
        System.assertEquals(newPhone, updatedAccounts[0].Phone, 'Phone should be updated to new value');
        System.assert(updatedAccounts[0].Name.endsWith(nameSuffix), 'Name should end with suffix');
        
        System.assertEquals(newPhone, updatedAccounts[1].Phone, 'Phone should be updated to new value');
        System.assert(updatedAccounts[1].Name.endsWith(nameSuffix), 'Name should end with suffix');
    }
    
    /**
     * Test: Update only phone when name suffix is null
     */
    @isTest
    static void testUpdatePhoneOnlyWhenNameSuffixNull() {
        // Setup
        Account testAccount = new Account(Name = 'Test Account', Phone = '555-0001');
        insert testAccount;
        
        List<Id> accountIds = new List<Id>{testAccount.Id};
        String newPhone = '555-8888';
        String nameSuffix = null;
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, newPhone, nameSuffix);
        Test.stopTest();
        
        // Assert
        Account updatedAccount = [SELECT Id, Phone, Name FROM Account WHERE Id = :testAccount.Id];
        
        System.assertEquals(newPhone, updatedAccount.Phone, 'Phone should be updated');
        System.assertEquals('Test Account', updatedAccount.Name, 'Name should not change when suffix is null');
    }
    
    /**
     * Test: Update only name when phone is null
     */
    @isTest
    static void testUpdateNameOnlyWhenPhoneNull() {
        // Setup
        Account testAccount = new Account(Name = 'Test Account', Phone = '555-0001');
        insert testAccount;
        
        List<Id> accountIds = new List<Id>{testAccount.Id};
        String phone = null;
        String nameSuffix = ' - Modified';
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, phone, nameSuffix);
        Test.stopTest();
        
        // Assert
        Account updatedAccount = [SELECT Id, Phone, Name FROM Account WHERE Id = :testAccount.Id];
        
        System.assertEquals('Test Account - Modified', updatedAccount.Name, 'Name should be updated with suffix');
        System.assertEquals('555-0001', updatedAccount.Phone, 'Phone should not change when phone param is null');
    }
    
    /**
     * Test: Both phone and name are null - no updates should occur
     */
    @isTest
    static void testBothParametersNull() {
        // Setup
        Account testAccount = new Account(Name = 'Test Account', Phone = '555-0001');
        insert testAccount;
        
        List<Id> accountIds = new List<Id>{testAccount.Id};
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, null, null);
        Test.stopTest();
        
        // Assert
        Account updatedAccount = [SELECT Id, Phone, Name FROM Account WHERE Id = :testAccount.Id];
        
        System.assertEquals('Test Account', updatedAccount.Name, 'Name should not change');
        System.assertEquals('555-0001', updatedAccount.Phone, 'Phone should not change');
    }
    
    /**
     * Test: Handle null account ID list
     */
    @isTest
    static void testNullAccountIdList() {
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(null, '555-9999', ' - Updated');
        Test.stopTest();
        
        // Assert - Should complete without error
        System.assert(true, 'Method should handle null list gracefully');
    }
    
    /**
     * Test: Handle empty account ID list
     */
    @isTest
    static void testEmptyAccountIdList() {
        // Execute
        List<Id> emptyList = new List<Id>();
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(emptyList, '555-9999', ' - Updated');
        Test.stopTest();
        
        // Assert - Should complete without error
        System.assert(true, 'Method should handle empty list gracefully');
    }
    
    /**
     * Test: Handle account IDs that don't exist in the database
     */
    @isTest
    static void testNonExistentAccountIds() {
        // Setup
        List<Id> fakeIds = new List<Id>{
            Id.valueOf('001000000000001'),
            Id.valueOf('001000000000002')
        };
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(fakeIds, '555-9999', ' - Updated');
        Test.stopTest();
        
        // Assert - Should complete without error (no accounts to update)
        System.assert(true, 'Method should handle non-existent IDs gracefully');
    }
    
    /**
     * Test: Bulk update with multiple accounts and special characters
     */
    @isTest
    static void testBulkUpdateWithSpecialCharacters() {
        // Setup
        List<Account> testAccounts = new List<Account>();
        for (Integer i = 0; i < 10; i++) {
            testAccounts.add(new Account(
                Name = 'Account ' + i,
                Phone = '555-000' + i
            ));
        }
        insert testAccounts;
        
        List<Id> accountIds = new List<Id>();
        for (Account acc : testAccounts) {
            accountIds.add(acc.Id);
        }
        
        String newPhone = '+1 (555) 888-9999';
        String nameSuffix = ' [UPDATED]';
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, newPhone, nameSuffix);
        Test.stopTest();
        
        // Assert
        List<Account> updatedAccounts = [SELECT Id, Phone, Name FROM Account WHERE Id IN :accountIds];
        
        System.assertEquals(10, updatedAccounts.size(), 'All 10 accounts should be updated');
        for (Account acc : updatedAccounts) {
            System.assertEquals(newPhone, acc.Phone, 'Phone should be updated');
            System.assert(acc.Name.contains('[UPDATED]'), 'Name should contain suffix with special characters');
        }
    }
    
    /**
     * Test: Single account update
     */
    @isTest
    static void testSingleAccountUpdate() {
        // Setup
        Account testAccount = new Account(Name = 'Single Account', Phone = '555-0001');
        insert testAccount;
        
        List<Id> accountIds = new List<Id>{testAccount.Id};
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, '555-1234', ' - Solo');
        Test.stopTest();
        
        // Assert
        Account updatedAccount = [SELECT Id, Phone, Name FROM Account WHERE Id = :testAccount.Id];
        
        System.assertEquals('555-1234', updatedAccount.Phone, 'Phone should be updated');
        System.assertEquals('Single Account - Solo', updatedAccount.Name, 'Name should be updated with suffix');
    }
    
    /**
     * Test: Update with empty string phone
     */
    @isTest
    static void testEmptyStringPhone() {
        // Setup
        Account testAccount = new Account(Name = 'Test Account', Phone = '555-0001');
        insert testAccount;
        
        List<Id> accountIds = new List<Id>{testAccount.Id};
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, '', ' - Updated');
        Test.stopTest();
        
        // Assert
        Account updatedAccount = [SELECT Id, Phone, Name FROM Account WHERE Id = :testAccount.Id];
        
        System.assertEquals('', updatedAccount.Phone, 'Phone should be updated to empty string');
        System.assertEquals('Test Account - Updated', updatedAccount.Name, 'Name should be updated');
    }
    
    /**
     * Test: Update with empty string name suffix
     */
    @isTest
    static void testEmptyStringNameSuffix() {
        // Setup
        Account testAccount = new Account(Name = 'Test Account', Phone = '555-0001');
        insert testAccount;
        
        List<Id> accountIds = new List<Id>{testAccount.Id};
        
        // Execute
        Test.startTest();
        VeryBadAccountUtils.updatePhonesAndNames(accountIds, '555-9999', '');
        Test.stopTest();
        
        // Assert
        Account updatedAccount = [SELECT Id, Phone, Name FROM Account WHERE Id = :testAccount.Id];
        
        System.assertEquals('555-9999', updatedAccount.Phone, 'Phone should be updated');
        System.assertEquals('Test Account', updatedAccount.Name, 'Name should not change with empty suffix');
    }
}
