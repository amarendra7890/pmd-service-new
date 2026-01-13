// File: DashboardController.cls
public with sharing class DashboardController {

    private static final Integer PREVIEW_LIMIT = 5; // Consistent limit for previews

    // --- Utility Method to Check Custom Permission Set Assignment ---
    @AuraEnabled(cacheable=true)
    public static Boolean checkUserPermission(String permissionSetName) {
        Set<String> assignedPermissions = new Set<String>();
        for (PermissionSetAssignment psa : [
            SELECT PermissionSet.Name
            FROM PermissionSetAssignment
            WHERE AssigneeId = :UserInfo.getUserId()
            AND PermissionSet.IsCustom = true 
        ]) {
            assignedPermissions.add(psa.PermissionSet.Name);
        }
        return assignedPermissions.contains(permissionSetName);
    }

    // --- User Info ---
    @AuraEnabled(cacheable=true)
    public static User getCurrentUserInfo() {
        return [SELECT Id, Name, SmallPhotoUrl, Email FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
    }

    // --- Paged Result Wrapper ---
    public class PagedResult {
        @AuraEnabled public List<Map<String, Object>> records { get; set; } // Changed to List of Maps
        @AuraEnabled public Integer pageNumber { get; set; }
        @AuraEnabled public Integer pageSize { get; set; }
        @AuraEnabled public Integer totalRecords { get; set; }
        @AuraEnabled public Integer totalPages { get; set; }

        public PagedResult() {
            this.records = new List<Map<String, Object>>();
        }
    }

    // --- Scheduled Jobs ---
    public class ScheduledJobInfo {
        @AuraEnabled public List<CronTrigger> upcomingJobs { get; set; }
        @AuraEnabled public List<CronTrigger> succeededJobs { get; set; }
        @AuraEnabled public List<CronTrigger> failedJobs { get; set; }
        @AuraEnabled public List<CronTrigger> myJobs { get; set; }
        @AuraEnabled public Integer upcomingCount { get; set; }
        @AuraEnabled public Integer succeededCount { get; set; }
        @AuraEnabled public Integer failedCount { get; set; }
        @AuraEnabled public Integer myJobsCount { get; set; }
        
        // New properties for categorized My Jobs
        @AuraEnabled public List<CronTrigger> myUpcomingJobs { get; set; }
        @AuraEnabled public List<CronTrigger> mySucceededJobs { get; set; }
        @AuraEnabled public List<CronTrigger> myFailedJobs { get; set; }
        @AuraEnabled public Integer myUpcomingCount { get; set; }
        @AuraEnabled public Integer mySucceededCount { get; set; }
        @AuraEnabled public Integer myFailedCount { get; set; }

        public ScheduledJobInfo() {
            upcomingJobs = new List<CronTrigger>();
            succeededJobs = new List<CronTrigger>();
            failedJobs = new List<CronTrigger>();
            myJobs = new List<CronTrigger>();
            upcomingCount = 0;
            succeededCount = 0;
            failedCount = 0;
            myJobsCount = 0;
            
            // Initialize new properties
            myUpcomingJobs = new List<CronTrigger>();
            mySucceededJobs = new List<CronTrigger>();
            myFailedJobs = new List<CronTrigger>();
            myUpcomingCount = 0;
            mySucceededCount = 0;
            myFailedCount = 0;
        }
    }

    @AuraEnabled(cacheable=true)
    public static ScheduledJobInfo getScheduledJobs() {
        ScheduledJobInfo info = new ScheduledJobInfo();
        Boolean canViewAll = checkUserPermission('View_All_Scheduled_Jobs_PS');
        String userId = UserInfo.getUserId();

        // Base query parts
        String baseQuery = 'SELECT Id, CronJobDetail.Name, NextFireTime, PreviousFireTime, EndTime, State, TimesTriggered, CreatedBy.Name, CreatedById FROM CronTrigger';
        String userFilter = ' WHERE CreatedById = :userId';
        String orderBy = ' ORDER BY NextFireTime DESC NULLS LAST, PreviousFireTime DESC NULLS LAST';
        
        // Get all jobs (or user's jobs) for counting and preview categorization
        List<CronTrigger> allTriggersForCategorization;
        if (canViewAll) {
            allTriggersForCategorization = Database.query(baseQuery + orderBy + ' LIMIT 200');
        } else {
            allTriggersForCategorization = Database.query(baseQuery + userFilter + orderBy + ' LIMIT 200');
        }

        List<CronTrigger> userCreatedJobsTemp = new List<CronTrigger>();
        List<CronTrigger> myUpcomingJobs = new List<CronTrigger>();
        List<CronTrigger> mySucceededJobs = new List<CronTrigger>();
        List<CronTrigger> myFailedJobs = new List<CronTrigger>();

        for (CronTrigger ct : allTriggersForCategorization) {
            if (ct.CreatedById == userId) {
                userCreatedJobsTemp.add(ct);
                
                // Categorize user's jobs into upcoming, succeeded, failed
                if (ct.State == 'WAITING' || ct.State == 'ACQUIRED' || ct.State == 'EXECUTING') {
                    myUpcomingJobs.add(ct);
                } else if (ct.State == 'COMPLETE' || ct.State == 'DELETED') {
                    mySucceededJobs.add(ct);
                } else if (ct.State == 'ERROR') {
                    myFailedJobs.add(ct);
                }
            }
            
            // Categorize for preview based on canViewAll or user's jobs only
            if (ct.State == 'WAITING' || ct.State == 'ACQUIRED' || ct.State == 'EXECUTING') {
                info.upcomingJobs.add(ct);
            } else if (ct.State == 'COMPLETE' || ct.State == 'DELETED') {
                info.succeededJobs.add(ct);
            } else if (ct.State == 'ERROR') {
                info.failedJobs.add(ct);
            }
        }
        
        // Set My Jobs data
        info.myJobsCount = userCreatedJobsTemp.size();
        sortCronTriggersByStateAndDate(userCreatedJobsTemp);
        info.myJobs = userCreatedJobsTemp.size() > PREVIEW_LIMIT ? getCronTriggerSubList(userCreatedJobsTemp, 0, PREVIEW_LIMIT) : userCreatedJobsTemp;
        
        // Add the categorized my jobs to the info object
        info.myUpcomingJobs = myUpcomingJobs;
        info.mySucceededJobs = mySucceededJobs;
        info.myFailedJobs = myFailedJobs;
        info.myUpcomingCount = myUpcomingJobs.size();
        info.mySucceededCount = mySucceededJobs.size();
        info.myFailedCount = myFailedJobs.size();
        
        info.upcomingCount = info.upcomingJobs.size();
        info.succeededCount = info.succeededJobs.size();
        info.failedCount = info.failedJobs.size();

        // Actual total counts for view more button logic (if canViewAll, otherwise these counts are already user-specific)
        if(canViewAll){
            info.upcomingCount = [SELECT COUNT() FROM CronTrigger WHERE State IN ('WAITING', 'ACQUIRED', 'EXECUTING')];
            info.succeededCount = [SELECT COUNT() FROM CronTrigger WHERE State IN ('COMPLETE', 'DELETED')];
            info.failedCount = [SELECT COUNT() FROM CronTrigger WHERE State = 'ERROR'];
        }
        
        // Limit lists for display in card preview
        if(info.upcomingJobs.size() > PREVIEW_LIMIT) {
            info.upcomingJobs = getCronTriggerSubList(info.upcomingJobs, 0, PREVIEW_LIMIT);
        }
        if(info.succeededJobs.size() > PREVIEW_LIMIT) {
            info.succeededJobs = getCronTriggerSubList(info.succeededJobs, 0, PREVIEW_LIMIT);
        }
        if(info.failedJobs.size() > PREVIEW_LIMIT) {
            info.failedJobs = getCronTriggerSubList(info.failedJobs, 0, PREVIEW_LIMIT);
        }

        return info;
    }

    // Paginated method for "My Scheduled Jobs"
    @AuraEnabled(cacheable=true)
    public static PagedResult getMyScheduledJobsPaged(String createdById, Integer pageSize, Integer pageNumber) {
        if (String.isBlank(createdById) || pageSize == null || pageSize <= 0 || pageNumber == null || pageNumber <= 0) {
            throw new AuraHandledException('User ID, Page Size, and Page Number are required and must be valid.');
        }

        PagedResult result = new PagedResult();
        result.pageSize = pageSize;
        result.pageNumber = pageNumber;
        Integer offset = (pageNumber - 1) * pageSize;

        String commonQueryFields = 'Id, CronJobDetail.Name, NextFireTime, PreviousFireTime, State, CreatedBy.Name, CreatedById ';
        String fromClause = 'FROM CronTrigger ';
        String filterClause = 'WHERE CreatedById = :createdById ';
        String orderByClause = 'ORDER BY NextFireTime DESC NULLS LAST, PreviousFireTime DESC NULLS LAST ';

        String countQuery = 'SELECT COUNT() ' + fromClause + filterClause;
        result.totalRecords = Database.countQuery(String.format(countQuery, new List<String>{createdById}));
        
        if (result.totalRecords == 0) {
            result.totalPages = 0;
            return result;
        }
        result.totalPages = (Integer)Math.ceil((Double)result.totalRecords / pageSize);
        
        String dataQuery = 'SELECT ' + commonQueryFields + fromClause + filterClause + orderByClause +
                           'LIMIT :pageSize OFFSET :offset';
        
        List<CronTrigger> jobTriggers = Database.query(String.format(dataQuery, new List<Object>{createdById, pageSize, offset}));
        result.records = formatCronTriggersForDisplay(jobTriggers);
        return result;
    }

    // Paginated method for System-wide Scheduled Jobs (Upcoming, Succeeded, Failed)
    @AuraEnabled(cacheable=true)
    public static PagedResult getSystemScheduledJobsPaged(String jobStateCategory, String currentUserId, Integer pageSize, Integer pageNumber) {
        if (String.isBlank(jobStateCategory) || pageSize == null || pageSize <= 0 || pageNumber == null || pageNumber <= 0) {
            throw new AuraHandledException('Job State Category, Page Size, and Page Number are required and must be valid.');
        }

        PagedResult result = new PagedResult();
        result.pageSize = pageSize;
        result.pageNumber = pageNumber;
        Integer offset = (pageNumber - 1) * pageSize;

        List<String> statesInCondition = new List<String>();
        if (jobStateCategory == 'upcoming') {
            statesInCondition.addAll(new List<String>{'WAITING', 'ACQUIRED', 'EXECUTING'});
        } else if (jobStateCategory == 'succeeded') {
            statesInCondition.addAll(new List<String>{'COMPLETE', 'DELETED'});
        } else if (jobStateCategory == 'failed') {
            statesInCondition.add('ERROR');
        } else {
            throw new AuraHandledException('Invalid jobStateCategory.');
        }

        String commonQueryFields = 'Id, CronJobDetail.Name, NextFireTime, PreviousFireTime, State, CreatedBy.Name, CreatedById ';
        String fromClause = 'FROM CronTrigger ';
        String filterClause = 'WHERE State IN :statesInCondition ';
        String orderByClause = 'ORDER BY NextFireTime DESC NULLS LAST, PreviousFireTime DESC NULLS LAST ';

        // Apply user filter if user does not have 'View_All_Scheduled_Jobs_PS'
        Boolean canViewAll = checkUserPermission('View_All_Scheduled_Jobs_PS');
        if (!canViewAll) {
            filterClause += 'AND CreatedById = :currentUserId ';
        }

        String countQuery = 'SELECT COUNT() ' + fromClause + filterClause;
        if (!canViewAll) {
             result.totalRecords = Database.countQuery(String.format(countQuery, new List<Object>{statesInCondition, currentUserId}));
        } else {
             result.totalRecords = Database.countQuery(String.format(countQuery, new List<Object>{statesInCondition}));
        }
       

        if (result.totalRecords == 0) {
            result.totalPages = 0;
            return result;
        }
        result.totalPages = (Integer)Math.ceil((Double)result.totalRecords / pageSize);
        
        String dataQuery = 'SELECT ' + commonQueryFields + fromClause + filterClause + orderByClause +
                           'LIMIT :pageSize OFFSET :offset';
        
        List<CronTrigger> jobTriggers;
        if(!canViewAll){
            jobTriggers = Database.query(String.format(dataQuery, new List<Object>{statesInCondition, currentUserId, pageSize, offset}));
        } else {
            jobTriggers = Database.query(String.format(dataQuery, new List<Object>{statesInCondition, pageSize, offset}));
        }

        result.records = formatCronTriggersForDisplay(jobTriggers);
        return result;
    }
    
    // Helper to format CronTrigger list into List of Maps
    private static List<Map<String, Object>> formatCronTriggersForDisplay(List<CronTrigger> triggers) {
        List<Map<String, Object>> formattedJobs = new List<Map<String, Object>>();
        for(CronTrigger job : triggers) {
            Map<String, Object> jobMap = new Map<String, Object>();
            jobMap.put('Id', job.Id);
            jobMap.put('CronJobDetailName', job.CronJobDetail?.Name); // Safe navigation
            jobMap.put('FormattedNextFireTime', formatDateTimeForDisplay(job.NextFireTime));
            jobMap.put('FormattedPreviousFireTime', formatDateTimeForDisplay(job.PreviousFireTime));
            jobMap.put('State', job.State);
            jobMap.put('CreatedByName', job.CreatedBy?.Name); // Safe navigation
            jobMap.put('statusLabel', job.State != null ? job.State : 'Unknown');
            // Add 'statusClass' if you define CSS for it in fullListPage.css (e.g., for row highlighting)
            // jobMap.put('statusClass', getMyJobItemStatusClass(job.State)); 
            formattedJobs.add(jobMap);
        }
        return formattedJobs;
    }
    
    private static String formatDateTimeForDisplay(Datetime dt) {
        if (dt == null) return 'N/A';
        try {
            return dt.format('MMM d, yyyy, h:mm a', UserInfo.getTimeZone().getID());
        } catch (Exception e) {
            return dt.format();
        }
    }

    private static void sortCronTriggersByStateAndDate(List<CronTrigger> triggers) {
        // Existing sort logic ... (Bubble sort is inefficient for large lists, consider Comparator)
        for (Integer i = 0; i < triggers.size() - 1; i++) {
            for (Integer j = i + 1; j < triggers.size(); j++) {
                if (compareCronTriggers(triggers[i], triggers[j]) > 0) {
                    CronTrigger temp = triggers[i];
                    triggers[i] = triggers[j];
                    triggers[j] = temp;
                }
            }
        }
    }
    private static Integer compareCronTriggers(CronTrigger a, CronTrigger b) {
        // Existing compare logic ...
        Map<String, Integer> statePriority = new Map<String, Integer>{
            'EXECUTING' => 1, 'ACQUIRED' => 2, 'WAITING' => 3,
            'ERROR' => 4, 'COMPLETE' => 5, 'DELETED' => 6
        };
        Integer aPriority = statePriority.get(a.State);
        Integer bPriority = statePriority.get(b.State);
        aPriority = aPriority == null ? 999 : aPriority;
        bPriority = bPriority == null ? 999 : bPriority;

        if (aPriority != bPriority) return aPriority - bPriority;
        if (a.NextFireTime != null && b.NextFireTime != null) return b.NextFireTime.getTime() > a.NextFireTime.getTime() ? 1 : (b.NextFireTime.getTime() < a.NextFireTime.getTime() ? -1 : 0);
        if (a.NextFireTime != null) return -1;
        if (b.NextFireTime != null) return 1;
        if (a.PreviousFireTime != null && b.PreviousFireTime != null) return b.PreviousFireTime.getTime() > a.PreviousFireTime.getTime() ? 1 : (b.PreviousFireTime.getTime() < a.PreviousFireTime.getTime() ? -1 : 0);
        return 0;
    }
    private static List<CronTrigger> getCronTriggerSubList(List<CronTrigger> originalList, Integer startIndex, Integer endIndex) {
        // Existing sublist logic ...
        List<CronTrigger> subList = new List<CronTrigger>();
        for (Integer i = startIndex; i < endIndex && i < originalList.size(); i++) {
            subList.add(originalList[i]);
        }
        return subList;
    }
    // --- Apex Classes Info ---
    public class ApexClassesData {
        @AuraEnabled public List<ApexClass> classes { get; set; }
        @AuraEnabled public Integer classCount { get; set; }
        @AuraEnabled public Integer myClassesCount { get; set; }
        @AuraEnabled public Integer lowCoverageCount { get; set; }
        @AuraEnabled public Boolean canViewDetails { get; set; }
        @AuraEnabled public List<ApexClass> myClasses { get; set; }
        @AuraEnabled public List<ApexClassCoverage> lowCoverageClasses { get; set; }

        public ApexClassesData() {
            this.classes = new List<ApexClass>();
            this.myClasses = new List<ApexClass>();
            this.lowCoverageClasses = new List<ApexClassCoverage>();
            this.classCount = 0;
            this.myClassesCount = 0;
            this.lowCoverageCount = 0;
            this.canViewDetails = false;
        }
    }
    
    public class ApexClassCoverage {
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Integer coverage { get; set; }
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String createdByName { get; set; }
        
        public ApexClassCoverage(String id, String name, Integer coverage, String createdByName) {
            this.id = id;
            this.name = name;
            this.coverage = coverage;
            this.createdByName = createdByName;
        }
    }

    @AuraEnabled(cacheable=true)
    public static ApexClassesData getApexClassesInfo() {
        ApexClassesData data = new ApexClassesData();
        Boolean canViewAll = checkUserPermission('View_All_Apex_Classes_Info_PS');
        String userId = UserInfo.getUserId();
        
        // Get all classes for total count
        List<ApexClass> allClasses = [SELECT Id, Name, ApiVersion, Status, CreatedBy.Name, CreatedById, LastModifiedDate 
                                      FROM ApexClass 
                                      ORDER BY Name];
        
        data.classCount = allClasses.size();
        data.canViewDetails = canViewAll;
        
        // Get classes created by current user
        List<ApexClass> userClasses = new List<ApexClass>();
        for (ApexClass cls : allClasses) {
            if (cls.CreatedById == userId) {
                userClasses.add(cls);
            }
        }
        
        data.myClasses = userClasses.size() > 5 ? getApexClassSubList(userClasses, 0, 5) : userClasses;
        data.myClassesCount = userClasses.size();
        
        // Get code coverage data if we have access
        if (canViewAll) {
            try {
                // Use HTTP callout to Tooling API for code coverage data
                Map<Id, Decimal> coverageByClassId = getCoverageDataViaToolingAPI(allClasses);
                
                // Find classes with low coverage (less than 75%)
                List<ApexClassCoverage> lowCoverage = new List<ApexClassCoverage>();
                
                for (ApexClass cls : allClasses) {
                    if (coverageByClassId.containsKey(cls.Id)) {
                        Decimal coverage = coverageByClassId.get(cls.Id);
                        if (coverage < 75) {
                            lowCoverage.add(new ApexClassCoverage(
                                cls.Id,
                                cls.Name,
                                Integer.valueOf(coverage),
                                cls.CreatedBy.Name
                            ));
                        }
                    }
                }
                
                // Sort by coverage (lowest first) - using traditional sort method
                sortApexClassCoverageByPercentage(lowCoverage);
                
                data.lowCoverageClasses = lowCoverage.size() > 5 ? getApexClassCoverageSubList(lowCoverage, 0, 5) : lowCoverage;
                data.lowCoverageCount = lowCoverage.size();
                
            } catch (Exception e) {
                // If Tooling API call fails, set coverage data to empty
                System.debug('Error getting coverage data: ' + e.getMessage());
                data.lowCoverageClasses = new List<ApexClassCoverage>();
                data.lowCoverageCount = 0;
            }
        }
        
        // Limit classes for display
        if (canViewAll && allClasses.size() > 10) { 
            data.classes = getApexClassSubList(allClasses, 0, 10);
        } else if (canViewAll) {
            data.classes = allClasses;
        }
        
        return data;
    }

    // Helper method to get coverage data via Tooling API HTTP callout
    private static Map<Id, Decimal> getCoverageDataViaToolingAPI(List<ApexClass> allClasses) {
        Map<Id, Decimal> coverageByClassId = new Map<Id, Decimal>();
        
        // Build class ID list for SOQL IN clause
        Set<String> classIdStrings = new Set<String>();
        for (ApexClass cls : allClasses) {
            classIdStrings.add('\'' + cls.Id + '\'');
        }
        
        if (classIdStrings.isEmpty()) {
            return coverageByClassId;
        }
        
        // Construct Tooling API query
        String query = 'SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverage WHERE ApexClassOrTriggerId IN (' + String.join(new List<String>(classIdStrings), ',') + ')';
        
        // Make HTTP callout to Tooling API
        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint(URL.getOrgDomainUrl().toExternalForm() + '/services/data/v61.0/tooling/query/?q=' + EncodingUtil.urlEncode(query, 'UTF-8'));
        req.setMethod('GET');
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        req.setHeader('Content-Type', 'application/json');
        
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() == 200) {
            // Parse JSON response
            Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> records = (List<Object>) jsonResponse.get('records');
            
            // Process coverage data - aggregate by class since multiple test classes can cover same class
            Map<Id, Integer> totalCoveredByClass = new Map<Id, Integer>();
            Map<Id, Integer> totalUncoveredByClass = new Map<Id, Integer>();
            
            for (Object recordObj : records) {
                Map<String, Object> record = (Map<String, Object>) recordObj;
                String classIdStr = (String) record.get('ApexClassOrTriggerId');
                Id classId = Id.valueOf(classIdStr);
                
                Integer numCovered = record.get('NumLinesCovered') != null ? Integer.valueOf(record.get('NumLinesCovered')) : 0;
                Integer numUncovered = record.get('NumLinesUncovered') != null ? Integer.valueOf(record.get('NumLinesUncovered')) : 0;
                
                // Aggregate coverage data (sum up from multiple test runs)
                if (!totalCoveredByClass.containsKey(classId)) {
                    totalCoveredByClass.put(classId, 0);
                }
                if (!totalUncoveredByClass.containsKey(classId)) {
                    totalUncoveredByClass.put(classId, 0);
                }
                
                totalCoveredByClass.put(classId, totalCoveredByClass.get(classId) + numCovered);
                totalUncoveredByClass.put(classId, totalUncoveredByClass.get(classId) + numUncovered);
            }
            
            // Calculate coverage percentage for each class
            for (Id classId : totalCoveredByClass.keySet()) {
                Integer covered = totalCoveredByClass.get(classId);
                Integer uncovered = totalUncoveredByClass.containsKey(classId) ? totalUncoveredByClass.get(classId) : 0;
                Integer totalLines = covered + uncovered;
                
                if (totalLines > 0) {
                    Decimal coveragePercentage = (Decimal.valueOf(covered) / Decimal.valueOf(totalLines)) * 100;
                    coverageByClassId.put(classId, coveragePercentage);
                }
            }
        }
        
        return coverageByClassId;
    }

    // Helper method to sort ApexClassCoverage by percentage
    private static void sortApexClassCoverageByPercentage(List<ApexClassCoverage> coverageList) {
        for (Integer i = 0; i < coverageList.size() - 1; i++) {
            for (Integer j = i + 1; j < coverageList.size(); j++) {
                if (coverageList[i].coverage > coverageList[j].coverage) {
                    ApexClassCoverage temp = coverageList[i];
                    coverageList[i] = coverageList[j];
                    coverageList[j] = temp;
                }
            }
        }
    }

    // Helper method to get ApexClass sublist
    private static List<ApexClass> getApexClassSubList(List<ApexClass> originalList, Integer startIndex, Integer endIndex) {
        List<ApexClass> subList = new List<ApexClass>();
        for (Integer i = startIndex; i < endIndex && i < originalList.size(); i++) {
            subList.add(originalList[i]);
        }
        return subList;
    }

    // Helper method to get ApexClassCoverage sublist
    private static List<ApexClassCoverage> getApexClassCoverageSubList(List<ApexClassCoverage> originalList, Integer startIndex, Integer endIndex) {
        List<ApexClassCoverage> subList = new List<ApexClassCoverage>();
        for (Integer i = startIndex; i < endIndex && i < originalList.size(); i++) {
            subList.add(originalList[i]);
        }
        return subList;
    }
    
    // --- API Call Info ---
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getApiUsage() {
        Map<String, Object> usage = new Map<String, Object>();
        Map<String,System.OrgLimit> limitsMap = OrgLimits.getMap();
        System.OrgLimit apiRequestsLimit = limitsMap.get('DailyApiRequests');
        
        usage.put('limit', apiRequestsLimit.getLimit());
        usage.put('used', apiRequestsLimit.getValue());
        usage.put('remaining', apiRequestsLimit.getLimit() - apiRequestsLimit.getValue());
        return usage;
    }

    // --- Permissions Info ---
    public class PermissionsData {
        @AuraEnabled public List<SObject> permissions { get; set; } 
        @AuraEnabled public Integer permissionCount { get; set; }
        @AuraEnabled public Integer userPermissionCount { get; set; }
        @AuraEnabled public Integer myPermissionCount { get; set; }
        @AuraEnabled public Boolean canViewAllPerms { get; set; }
        @AuraEnabled public String viewType {get; set;}
        @AuraEnabled public List<PermissionSet> myPermissions { get; set; }

        public PermissionsData() {
            permissions = new List<SObject>();
            myPermissions = new List<PermissionSet>();
        }
    }

    @AuraEnabled(cacheable=true)
    public static PermissionsData getPermissionsInfo() {
        PermissionsData data = new PermissionsData();
        data.canViewAllPerms = checkUserPermission('View_All_Permissions_Info_PS');
        String userId = UserInfo.getUserId();

        // Get total permission set count
        data.permissionCount = [SELECT COUNT() FROM PermissionSet WHERE IsCustom = true OR Type != 'System'];
        
        // Get user's permission set assignments count
        data.userPermissionCount = [SELECT COUNT() FROM PermissionSetAssignment WHERE AssigneeId = :userId];
        
        // Get permission sets created by current user
        List<PermissionSet> userCreatedPermissions = [
            SELECT Id, Label, Name, IsCustom, CreatedById
            FROM PermissionSet
            WHERE CreatedById = :userId AND (IsCustom = true OR Type != 'System')
            ORDER BY Label
        ];
        
        //data.myPermissions = userCreatedPermissions.size() > 5 ? getPermissionSetSubList(userCreatedPermissions, 0, 5) : userCreatedPermissions;
        data.myPermissions = userCreatedPermissions;
        data.myPermissionCount = userCreatedPermissions.size();

        if (data.canViewAllPerms) {
            data.viewType = 'AllPermissionSets';
            List<PermissionSet> allPerms = [SELECT Label, Name, IsCustom, Type 
                                            FROM PermissionSet 
                                            WHERE IsCustom = true OR Type != 'System' 
                                            ORDER BY Label LIMIT 200];
            data.permissions.addAll(allPerms);
            
            // Limit permissions for display
            // if(data.permissions.size() > 10) {
            //     data.permissions = getSObjectSubList(data.permissions, 0, 10);
            // }

        } else {
            data.viewType = 'UserAssignments';
            List<PermissionSetAssignment> userAssignments = [SELECT PermissionSet.Label, PermissionSet.Name, PermissionSet.IsCustom 
                                                             FROM PermissionSetAssignment 
                                                             WHERE AssigneeId = :UserInfo.getUserId() 
                                                             AND PermissionSet.NamespacePrefix = null 
                                                             ORDER BY PermissionSet.Label LIMIT 200];
            data.permissions.addAll(userAssignments);
            
            // Limit permissions for display
            // if(data.permissions.size() > 10) {
            //     data.permissions = getSObjectSubList(data.permissions, 0, 10);
            // }
        }
        return data;
    }

    // Helper method to get PermissionSet sublist
    private static List<PermissionSet> getPermissionSetSubList(List<PermissionSet> originalList, Integer startIndex, Integer endIndex) {
        List<PermissionSet> subList = new List<PermissionSet>();
        for (Integer i = startIndex; i < endIndex && i < originalList.size(); i++) {
            subList.add(originalList[i]);
        }
        return subList;
    }

    // Helper method to get SObject sublist
    private static List<SObject> getSObjectSubList(List<SObject> originalList, Integer startIndex, Integer endIndex) {
        List<SObject> subList = new List<SObject>();
        for (Integer i = startIndex; i < endIndex && i < originalList.size(); i++) {
            subList.add(originalList[i]);
        }
        return subList;
    }
    
    // Add these methods to your existing DashboardController.cls

    @AuraEnabled(cacheable=false)
    public static List<PmdTypes.Finding> scanApexClass(String classId) {
        try {
            ApexClass cls = [SELECT Body, Name FROM ApexClass WHERE Id = :classId LIMIT 1];
            
            Map<String,Object> payload = new Map<String,Object>{
                'filename' => cls.Name + '.cls',
                'source'   => cls.Body
            };
            
            HttpRequest req = new HttpRequest();
            // TODO: REPLACE WITH YOUR RENDER APP URL
            req.setEndpoint('https://REPLACE_WITH_YOUR_RENDER_URL.onrender.com/run');
            req.setMethod('POST');
            req.setHeader('Content-Type','application/json');
            req.setBody(JSON.serialize(payload));
            req.setTimeout(60000); // Increase timeout to 60 seconds
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if(res.getStatusCode() != 200) {
                System.debug('PMD scan failed: ' + res.getBody());
            }
            
            // Parse the nested PMD response format
            List<Object> rawResults = (List<Object>) JSON.deserializeUntyped(res.getBody());
            List<PmdTypes.Finding> findings = new List<PmdTypes.Finding>();
            
            for(Object engineResult : rawResults) {
                Map<String,Object> engineMap = (Map<String,Object>) engineResult;
                
                // Get violations array from the engine result
                List<Object> violations = (List<Object>) engineMap.get('violations');
                
                if(violations != null) {
                    for(Object violation : violations) {
                        Map<String,Object> violationMap = (Map<String,Object>) violation;
                        
                        PmdTypes.Finding finding = new PmdTypes.Finding();
                        finding.rule = (String) violationMap.get('ruleName');
                        finding.line = violationMap.get('line') != null ? Integer.valueOf(violationMap.get('line')) : 1;
                        finding.message = (String) violationMap.get('message');
                        
                        // Map severity number to text
                        Object severityObj = violationMap.get('severity');
                        if(severityObj != null) {
                            Integer severityNum = Integer.valueOf(severityObj);
                            switch on severityNum {
                                when 1 { finding.severity = 'Error'; }
                                when 2 { finding.severity = 'Warning'; }
                                when 3 { finding.severity = 'Info'; }
                                when 4 { finding.severity = 'Low'; }
                                when 5 { finding.severity = 'Info'; }
                                when else { finding.severity = 'Info'; }
                            }
                        } else {
                            finding.severity = 'Info';
                        }
                        
                        findings.add(finding);
                    }
                }
            }
            
            return findings;
        } catch (System.CalloutException e) {
            if (e.getMessage().contains('timed out')) {
                throw new AuraHandledException('Analysis timed out. This class may be too large for PMD analysis. Try a smaller class or contact your administrator.');
            } else {
                throw new AuraHandledException('Network error during scan: ' + e.getMessage());
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error scanning class: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=false)
    public static String suggestCodeFix(String classId, Integer lineNumber, String rule) {
        try {
            ApexClass cls = [SELECT Body, Name FROM ApexClass WHERE Id = :classId LIMIT 1];
            String[] bodyLines = cls.Body.split('\n');
            String snippet = bodyLines[Math.max(lineNumber-1, 0)];
            
            Map<String,Object> payload = new Map<String,Object>{
                'prompt' => 'Fix this Apex code to comply with PMD rule: ' + rule,
                'code'   => snippet
            };
            
            HttpRequest req = new HttpRequest();
            // TODO: REPLACE WITH YOUR RENDER APP URL
            req.setEndpoint('https://REPLACE_WITH_YOUR_RENDER_URL.onrender.com/fix');
            req.setMethod('POST');
            req.setHeader('Content-Type','application/json');
            req.setBody(JSON.serialize(payload));
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if(res.getStatusCode() != 200) {
                throw new AuraHandledException('AI suggestion failed: ' + res.getBody());
            }
            
            Map<String,Object> resp = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
            return (String) resp.get('patch');
        } catch (Exception e) {
            throw new AuraHandledException('Error getting suggestion: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String,String>> getApexClassOptions() {
        List<Map<String,String>> options = new List<Map<String,String>>();
        
        for(ApexClass cls : [SELECT Id, Name FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name LIMIT 1000]) {
            options.add(new Map<String,String>{
                'label' => cls.Name,
                'value' => cls.Id
            });
        }
        
        return options;
    }
}