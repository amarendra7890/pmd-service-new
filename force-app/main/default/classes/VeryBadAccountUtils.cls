/**
 * Utility class for managing Account-related operations.
 * Provides bulkified methods for updating Account records efficiently.
 */
public with sharing class VeryBadAccountUtils {
    private static final Integer QUERY_LIMIT = 10000;

    /**
     * Updates Phone and Name fields for the provided Accounts.
     * 
     * - Bulkified: single SOQL query and single DML operation
     * - Safely handles null/empty input lists
     * - Respects null parameters (only updates non-null fields)
     * 
     * @param accountIds List of Account IDs to update
     * @param phone New phone number (null skips update)
     * @param nameSuffix Suffix to append to Name (null skips update)
     */
    public static void updatePhonesAndNames(List<Id> accountIds, String phone, String nameSuffix) {
        if (isValidInput(accountIds)) {
            List<Account> accountsToUpdate = getAccountsForUpdate(accountIds);
            if (!accountsToUpdate.isEmpty()) {
                applyUpdatesToAccounts(accountsToUpdate, phone, nameSuffix);
                updateAccounts(accountsToUpdate);
            }
        }
    }

    /**
     * Validates if the input account IDs list is valid.
     * 
     * @param accountIds List of Account IDs to validate
     * @return True if list is not null and not empty, false otherwise
     */
    private static Boolean isValidInput(List<Id> accountIds) {
        return accountIds != null && !accountIds.isEmpty();
    }

    /**
     * Retrieves Accounts from the database for the given IDs.
     * 
     * @param accountIds List of Account IDs to retrieve
     * @return List of Account records with Id, Phone, and Name fields
     */
    private static List<Account> getAccountsForUpdate(List<Id> accountIds) {
        return [
            SELECT Id, Phone, Name 
            FROM Account 
            WHERE Id IN :accountIds
            LIMIT :QUERY_LIMIT
        ];
    }

    /**
     * Applies phone and name updates to the provided accounts.
     * 
     * @param accounts List of Account records to update
     * @param phone New phone number (null skips update)
     * @param nameSuffix Suffix to append to Name (null skips update)
     */
    private static void applyUpdatesToAccounts(List<Account> accounts, String phone, String nameSuffix) {
        for (Account acc : accounts) {
            updateAccountPhone(acc, phone);
            updateAccountName(acc, nameSuffix);
        }
    }

    /**
     * Updates the phone number of an account if the new phone is not null.
     * 
     * @param account Account record to update
     * @param phone New phone number (null skips update)
     */
    private static void updateAccountPhone(Account account, String phone) {
        if (phone != null) {
            account.Phone = phone;
        }
    }

    /**
     * Updates the name of an account by appending a suffix if the suffix is not null.
     * 
     * @param account Account record to update
     * @param nameSuffix Suffix to append to Name (null skips update)
     */
    private static void updateAccountName(Account account, String nameSuffix) {
        if (nameSuffix != null) {
            account.Name = account.Name + nameSuffix;
        }
    }

    /**
     * Performs the DML update operation on the provided accounts.
     * 
     * @param accounts List of Account records to update in database
     */
    private static void updateAccounts(List<Account> accounts) {
        update accounts;
    }
}
