/**
 * DemoAccountService
 *
 * @description Utility service for simple Account-related operations used in unit tests
 *              and demos. Methods validate CRUD permissions before performing SOQL/DML
 *              to satisfy static analysis rules.
 */
public with sharing class DemoAccountService {

    /**
     * Returns up to 100 Accounts for the given industry.
     *
     * @description Returns an empty list if the provided industry is blank or if the
     *              current user does not have read access to Account.
     * @param industry The Account industry to filter by. May be null or blank.
     * @return List<Account> up to 100 matching Account records.
     */
    public static List<Account> getAccountsByIndustry(String industry) {
        // Validate read permission before SOQL to satisfy CRUD checks
        if (!Schema.sObjectType.Account.isAccessible()) {
            return new List<Account>();
        }
        if (String.isBlank(industry)) {
            return new List<Account>();
        }
        return [SELECT Id, Name, Industry FROM Account WHERE Industry = :industry LIMIT 100];
    }

    /**
     * Appends a suffix to each account Name and performs a single update.
     *
     * @description Validates update permission before performing DML. If the user does
     *              not have update permission on Account this method throws a
     *              SecurityException.
     * @param accounts List of Account records to update. May be null or empty.
     * @param suffix   Suffix string to append to each Account.Name. Must not be blank.
     * @throws SecurityException If the user lacks update permission on Account records.
     */
    public static void appendSuffixToNames(List<Account> accounts, String suffix) {
        if (accounts == null || accounts.isEmpty() || String.isBlank(suffix)) {
            return;
        }

        // Validate update permission before performing DML
        if (!Schema.sObjectType.Account.isUpdateable()) {
            throw new System.SecurityException('Insufficient CRUD permission to update Account records.');
        }

        for (Account acct : accounts) {
            if (acct.Name == null) {
                acct.Name = suffix;
            } else {
                acct.Name = acct.Name + ' ' + suffix;
            }
        }
        update accounts;
    }

    /**
     * Simple pure function to keep tests trivial and deterministic.
     *
     * @description Adds two integers treating null as zero.
     * @param a Left integer operand (nullable).
     * @param b Right integer operand (nullable).
     * @return Integer Sum of the two operands with null treated as zero.
     */
    public static Integer sum(Integer a, Integer b) {
        Integer left = (a == null) ? 0 : a;
        Integer right = (b == null) ? 0 : b;
        return left + right;
    }
}