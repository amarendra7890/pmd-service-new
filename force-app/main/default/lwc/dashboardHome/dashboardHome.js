// dashboardHome.js
import { LightningElement, wire, track } from 'lwc';
import getCurrentUserInfo from '@salesforce/apex/DashboardController.getCurrentUserInfo';
import getScheduledJobs from '@salesforce/apex/DashboardController.getScheduledJobs';
import getApexClassesInfo from '@salesforce/apex/DashboardController.getApexClassesInfo';
import getApiUsage from '@salesforce/apex/DashboardController.getApiUsage';
import getPermissionsInfo from '@salesforce/apex/DashboardController.getPermissionsInfo';
import { refreshApex } from '@salesforce/apex';

export default class DashboardHome extends LightningElement {
    @track isDarkMode = false;
    // Updated userInfo to include Id for reliable passing to child components
    @track userInfo = { Id: null, Name: '', Email: '', SmallPhotoUrl: '' };
    _wiredUserInfoResult;

    @track scheduledJobs = {
        upcomingJobs: [], succeededJobs: [], failedJobs: [], myJobs: [],
        upcomingCount: 0, succeededCount: 0, failedCount: 0, myJobsCount: 0,
        // Added new properties for categorized My Jobs
        myUpcomingJobs: [], mySucceededJobs: [], myFailedJobs: [],
        myUpcomingCount: 0, mySucceededCount: 0, myFailedCount: 0
    };
    _wiredScheduledJobsResult;

    @track apexClasses = {
        classes: [], myClasses: [], lowCoverageClasses: [],
        classCount: 0, myClassesCount: 0, lowCoverageCount: 0, canViewDetails: false
    };
    _wiredApexClassesResult;
    
    @track apiUsage = { limit: 0, used: 0, remaining: 0 };
    _wiredApiUsageResult;

    @track permissions = {
        permissions: [], myPermissions: [],
        permissionCount: 0, userPermissionCount: 0, myPermissionCount: 0,
        canViewAllPerms: false, viewType: ''
    };
    _wiredPermissionsResult;
    
    @track isLoading = true;
    @track error = null;
    @track showScrollToTop = false;
    initialLoadCounter = 0;
    totalWireServices = 5; // Keep this as 5 since Jira card handles its own loading

    connectedCallback() {
        setTimeout(() => {
            if (this.isLoading && this.initialLoadCounter < this.totalWireServices) {
                 this.isLoading = false; 
            }
        }, 8000); // Fallback to stop loading after 8 seconds

        // Add scroll event listener
        window.addEventListener('scroll', this.handleScroll.bind(this));
    }

    disconnectedCallback() {
        // Remove scroll event listener
        window.removeEventListener('scroll', this.handleScroll.bind(this));
    }
    
    handleWireCompletion() {
        this.initialLoadCounter++;
        if (this.initialLoadCounter >= this.totalWireServices) {
            this.isLoading = false;
        }
    }

    handleScroll() {
        // Show button when user scrolls down 300px
        this.showScrollToTop = window.pageYOffset > 300;
    }

    handleScrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    @wire(getCurrentUserInfo)
    wiredUserInfo(result) {
        this._wiredUserInfoResult = result;
        if (result.data) {
            // Spread ensures Id, Name, Email, SmallPhotoUrl are updated
            this.userInfo = { ...this.userInfo, ...result.data };
        } else if (result.error) {
            this.handleError(result.error, 'User Info');
            // Reset userInfo to default if error
            this.userInfo = { Id: null, Name: 'Error', Email: 'Error', SmallPhotoUrl: '' };
        }
        this.handleWireCompletion();
    }

    @wire(getScheduledJobs)
    wiredScheduledJobs(result) {
        this._wiredScheduledJobsResult = result;
        if (result.data) {
            this.scheduledJobs = {
                upcomingJobs: result.data.upcomingJobs || [],
                succeededJobs: result.data.succeededJobs || [],
                failedJobs: result.data.failedJobs || [],
                myJobs: result.data.myJobs || [],
                upcomingCount: result.data.upcomingCount || 0,
                succeededCount: result.data.succeededCount || 0,
                failedCount: result.data.failedCount || 0,
                myJobsCount: result.data.myJobsCount || (result.data.myJobs ? result.data.myJobs.length : 0),
                // Handle new categorized My Jobs properties
                myUpcomingJobs: result.data.myUpcomingJobs || [],
                mySucceededJobs: result.data.mySucceededJobs || [],
                myFailedJobs: result.data.myFailedJobs || [],
                myUpcomingCount: result.data.myUpcomingCount || 0,
                mySucceededCount: result.data.mySucceededCount || 0,
                myFailedCount: result.data.myFailedCount || 0
            };
        } else if (result.error) {
            this.handleError(result.error, 'Scheduled Jobs');
            this.scheduledJobs = { 
                upcomingJobs: [], succeededJobs: [], failedJobs: [], myJobs: [], 
                upcomingCount: 0, succeededCount: 0, failedCount: 0, myJobsCount: 0,
                myUpcomingJobs: [], mySucceededJobs: [], myFailedJobs: [],
                myUpcomingCount: 0, mySucceededCount: 0, myFailedCount: 0
            };
        }
        this.handleWireCompletion();
    }

    @wire(getApexClassesInfo)
    wiredApexClasses(result) {
        this._wiredApexClassesResult = result;
        if (result.data) {
            this.apexClasses = { ...this.apexClasses, ...result.data };
        } else if (result.error) {
            this.handleError(result.error, 'Apex Classes');
            this.apexClasses = { classes: [], myClasses: [], lowCoverageClasses: [], classCount: 0, myClassesCount: 0, lowCoverageCount: 0, canViewDetails: false };
        }
        this.handleWireCompletion();
    }

    @wire(getApiUsage)
    wiredApiUsage(result) {
        this._wiredApiUsageResult = result;
        if (result.data) {
            this.apiUsage = { ...this.apiUsage, ...result.data };
        } else if (result.error) {
            this.handleError(result.error, 'API Usage');
            this.apiUsage = { limit: 0, used: 0, remaining: 0 };
        }
        this.handleWireCompletion();
    }

    @wire(getPermissionsInfo)
    wiredPermissions(result) {
        this._wiredPermissionsResult = result;
        if (result.data) {
            this.permissions = { ...this.permissions, ...result.data };
        } else if (result.error) {
            this.handleError(result.error, 'Permissions Info');
            this.permissions = { permissions: [], myPermissions: [], permissionCount: 0, userPermissionCount: 0, myPermissionCount: 0, canViewAllPerms: false, viewType: '' };
        }
        this.handleWireCompletion();
    }

    handleError(error, context) {
        this.error = `Error loading ${context}.`;
        console.error(`Error loading ${context}:`, JSON.stringify(error));
    }

    handleRefreshRequest() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.initialLoadCounter = 0; 
        const refreshes = [];

        if (this._wiredUserInfoResult) refreshes.push(refreshApex(this._wiredUserInfoResult));
        if (this._wiredScheduledJobsResult) refreshes.push(refreshApex(this._wiredScheduledJobsResult));
        if (this._wiredApexClassesResult) refreshes.push(refreshApex(this._wiredApexClassesResult));
        if (this._wiredApiUsageResult) refreshes.push(refreshApex(this._wiredApiUsageResult));
        if (this._wiredPermissionsResult) refreshes.push(refreshApex(this._wiredPermissionsResult));

        // *** IMPROVED: Only refresh Jira if it's not currently processing a status change ***
        setTimeout(() => {
            try {
                const jiraCard = this.template.querySelector('c-jira-issues-card');
                if (jiraCard && typeof jiraCard.handleRefreshJira === 'function') {
                    // Check if Jira card is busy with status changes
                    if (!jiraCard.statusChangeInProgress && !jiraCard.isRefreshing) {
                        jiraCard.handleRefreshJira();
                    } else {
                        console.log('Jira card busy, skipping refresh to prevent interference');
                    }
                }
            } catch (error) {
                console.log('Jira card refresh skipped:', error.message);
            }
        }, 100);

        Promise.all(refreshes)
            .catch(error => {
                this.handleError(error, 'data refresh');
            })
            .finally(() => {
                setTimeout(() => {
                    if (this.initialLoadCounter < this.totalWireServices && this.isLoading) {
                        this.isLoading = false;
                    }
                }, 300);
            });
    }

    handleThemeToggle(event) {
        this.isDarkMode = event.target.checked;
    }

    get containerClass() {
        let classes = 'dashboard-container';
        classes += this.isDarkMode ? ' dark-theme' : ' light-theme'; // light-theme class is not strictly needed if defaults are light
        return classes;
    }

    get scrollToTopClass() {
        let classes = 'scroll-to-top';
        if (this.showScrollToTop) {
            classes += ' show';
        }
        return classes;
    }

    // Getter methods for QuickStatsCard
    // Getter methods for QuickStatsCard
get myApexClassCount() {
    const count = this.apexClasses ? this.apexClasses.myClassesCount : 0;
    console.log('myApexClassCount getter called, returning:', count);
    console.log('this.apexClasses:', this.apexClasses);
    return count;
}

get myPermissionCount() {
    const count = this.permissions ? this.permissions.myPermissionCount : 0;
    console.log('myPermissionCount getter called, returning:', count);
    console.log('this.permissions:', this.permissions);
    return count;
}
}