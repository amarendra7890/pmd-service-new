// jiraIssuesCard.js - Complete with Status/Priority Tabs
import { LightningElement, track, wire, api } from 'lwc';
import getJiraIssuesForCurrentUserApex from '@salesforce/apex/JiraController.getJiraIssuesForCurrentUser';
import updateJiraIssueStatusApex from '@salesforce/apex/JiraController.updateJiraIssueStatus';
import syncJiraDataApex from '@salesforce/apex/JiraController.syncJiraData';
import getJiraProjectsApex from '@salesforce/apex/JiraController.getJiraProjects';
import getJiraIssueTypesApex from '@salesforce/apex/JiraController.getJiraIssueTypes';
import getJiraPrioritiesApex from '@salesforce/apex/JiraController.getJiraPriorities';
import getJiraAssigneesApex from '@salesforce/apex/JiraController.getJiraAssignees';
import createJiraIssueApex from '@salesforce/apex/JiraController.createJiraIssue';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import JIRA_ICON from '@salesforce/resourceUrl/jira_icon';

// ---- CUSTOMIZE THESE STATUS ARRAYS TO MATCH YOUR JIRA WORKFLOW ----
const STATUS_CATEGORY_OPEN = ['Open', 'To Do', 'Backlog', 'Reopened', 'Selected for Development', 'Open - Waiting for info'];
const STATUS_CATEGORY_IN_PROGRESS = ['In Progress', 'Development', 'In Review', 'Review', 'Testing', 'QA', 'Blocked'];
const STATUS_CATEGORY_DONE = ['Done', 'Completed', 'Resolved', 'Closed', 'Cancelled', 'Won\'t Do']; 

export default class JiraIssuesCard extends LightningElement {
    jiraIconUrl = JIRA_ICON;
    @track allIssues = [];
    @track errorMessage;
    @track isLoading = true;
    @api showRefreshButton = false;
    
    // View Toggle
    @track currentView = 'status'; // 'status' or 'priority'

    // Create Issue Modal Properties
    @track showCreateModal = false;
    @track isCreatingIssue = false;
    @track availableProjects = [];
    @track availableIssueTypes = [];
    @track availablePriorities = [];
    @track availableAssignees = [];
    
    // Form Data
    @track selectedProject = '';
    @track selectedIssueType = '';
    @track newIssueSummary = '';
    @track newIssueDescription = '';
    @track selectedPriority = '';
    @track selectedInitialStatus = 'to-do';  // Default value changed to To Do
    @track newIssueDueDate = '';
    @track selectedAssignee = '';

    _wiredJiraDataResult;
    statusChangeInProgress = false;

    get yourWorkLink() {
        return 'https://relanto-team-amar.atlassian.net/jira/your-work';
    }

    get isCreateButtonDisabled() {
        return this.isCreatingIssue || 
               !this.selectedProject || 
               !this.selectedIssueType || 
               !this.newIssueSummary.trim();
    }

    // Simple wire - always works, always fast
    @wire(getJiraIssuesForCurrentUserApex)
    wiredJiraData(result) {
        this._wiredJiraDataResult = result;
        this.isLoading = true;
        if (result.data) {
            this.allIssues = result.data.map(issue => {
                const priorityColorClass = issue.priorityColorClass;
                const availableStatuses = Array.isArray(issue.availableStatuses) ? issue.availableStatuses : [];
                return {
                    ...issue,
                    priorityBadgeClass: this.getPriorityBadgeStyling(priorityColorClass),
                    isUpdating: false,
                    filteredAvailableStatuses: availableStatuses.filter(s => s.value !== issue.statusId) 
                                                    .map(s => ({ ...s, value: s.transitionId }))
                };
            });
            this.errorMessage = undefined;
        } else if (result.error) {
            console.error('Error fetching Jira issues:', JSON.stringify(result.error));
            this.errorMessage = this.reduceErrors(result.error).join(', ');
            this.allIssues = [];
        }
        this.isLoading = false;
    }

    // Trigger sync after component loads (background)
    connectedCallback() {
        // Sync after 3 seconds (background operation)
        setTimeout(() => {
            this.performBackgroundSync();
        }, 3000);
    }

    // Background sync - doesn't interfere with UI
    async performBackgroundSync() {
        try {
            await syncJiraDataApex();
            console.log('Background sync completed');
        } catch (error) {
            console.log('Background sync failed:', error.message);
            // Don't show errors for background operations
        }
    }

    // Helper for case-insensitive status checking
    isStatusInArray(status, statusArray) {
        if (!status || !Array.isArray(statusArray)) return false;
        const lowerCaseStatus = status.toLowerCase();
        return statusArray.some(s => s.toLowerCase() === lowerCaseStatus);
    }

    get openIssues() {
        return this.allIssues.filter(issue => this.isStatusInArray(issue.status, STATUS_CATEGORY_OPEN));
    }

    get inProgressIssues() {
        return this.allIssues.filter(issue => this.isStatusInArray(issue.status, STATUS_CATEGORY_IN_PROGRESS));
    }

    get recentlyClosedOrDoneIssues() {
        return this.allIssues.filter(issue => this.isStatusInArray(issue.status, STATUS_CATEGORY_DONE));
    }
    
    get hasNoIssuesToDisplay() {
        return !this.isLoading && this.allIssues.length === 0 && !this.errorMessage;
    }

    // View toggle getters
    get isStatusView() {
        return this.currentView === 'status';
    }

    get isPriorityView() {
        return this.currentView === 'priority';
    }

    get statusTabClass() {
        return this.currentView === 'status' ? 'view-tab view-tab-active' : 'view-tab';
    }

    get priorityTabClass() {
        return this.currentView === 'priority' ? 'view-tab view-tab-active' : 'view-tab';
    }

    // Priority-based filtering
    get highPriorityIssues() {
        return this.allIssues.filter(issue => 
            issue.priority && issue.priority.toLowerCase() === 'high'
        );
    }

    get mediumPriorityIssues() {
        return this.allIssues.filter(issue => 
            issue.priority && issue.priority.toLowerCase() === 'medium'
        );
    }

    get lowPriorityIssues() {
        return this.allIssues.filter(issue => 
            issue.priority && issue.priority.toLowerCase() === 'low'
        );
    }

    // View toggle handlers
    handleStatusViewClick() {
        this.currentView = 'status';
    }

    handlePriorityViewClick() {
        this.currentView = 'priority';
    }

    // Simple refresh - always works and forces a complete reload
    async handleRefreshJira() {
        console.log('Jira refresh button clicked');
        
        // Show spinner immediately
        this.isLoading = true;
        this.errorMessage = undefined;
        
        try {
            // First try to refresh using the wired method
            if (this._wiredJiraDataResult) {
                await refreshApex(this._wiredJiraDataResult);
                console.log('Wired refresh successful');
            }
            
            // Wait a moment and do a background sync for good measure
            setTimeout(() => {
                this.performBackgroundSync();
            }, 1000);
            
            // Show success message
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Refreshed',
                    message: 'Jira issues refreshed successfully',
                    variant: 'success'
                })
            );
            
        } catch (error) {
            console.error('Error refreshing Jira issues:', JSON.stringify(error));
            this.errorMessage = this.reduceErrors(error).join(', ');
            
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Refresh Failed',
                    message: 'Failed to refresh Jira issues. Please try again.',
                    variant: 'error'
                })
            );
        } finally {
            // Always hide spinner after a minimum time
            setTimeout(() => {
                this.isLoading = false;
            }, 500);
        }
    }

    // CREATE ISSUE FUNCTIONALITY
    async handleCreateIssue() {
        this.showCreateModal = true;
        this.resetFormData();
        
        // Load initial data for the form
        try {
            await this.loadProjectsAndMetadata();
        } catch (error) {
            console.error('Error loading create issue data:', error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Failed to load project data. Please try again.',
                    variant: 'error'
                })
            );
        }
    }

    async loadProjectsAndMetadata() {
        try {
            // Load projects
            const projects = await getJiraProjectsApex();
            console.log('projects'+projects);
            this.availableProjects = projects || [];
            
            // Load priorities
            const priorities = await getJiraPrioritiesApex();
            this.availablePriorities = priorities || [];
            console.log('priorities'+priorities);
            
            // Don't auto-select priority - let it default to Medium in Jira
            // Users can select a different priority if needed
            
        } catch (error) {
            console.error('Error loading metadata:', error);
            throw error;
        }
    }

    async handleProjectChange(event) {
        this.selectedProject = event.target.value;
        this.selectedIssueType = ''; // Reset issue type when project changes
        this.availableIssueTypes = [];
        this.availableAssignees = []; // Reset assignees when project changes
        
        if (this.selectedProject) {
            try {
                // Load issue types for selected project
                const issueTypes = await getJiraIssueTypesApex({ projectKey: this.selectedProject });
                this.availableIssueTypes = issueTypes || [];
                
                // Auto-select Task or Story if available
                const defaultType = this.availableIssueTypes.find(t => 
                    t.name.toLowerCase() === 'task' || t.name.toLowerCase() === 'story'
                );
                if (defaultType) {
                    this.selectedIssueType = defaultType.id;
                }

                // Load assignees for selected project
                try {
                    const assignees = await getJiraAssigneesApex({ projectKey: this.selectedProject });
                    this.availableAssignees = assignees || [];
                    console.log('Loaded assignees:', this.availableAssignees);
                } catch (assigneeError) {
                    console.warn('Could not load assignees for project:', assigneeError);
                    this.availableAssignees = [];
                }
                
            } catch (error) {
                console.error('Error loading project data:', error);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Warning',
                        message: 'Could not load all project data. You can still create issues.',
                        variant: 'warning'
                    })
                );
            }
        }
    }

    handleIssueTypeChange(event) {
        this.selectedIssueType = event.target.value;
    }

    handleSummaryChange(event) {
        this.newIssueSummary = event.target.value;
    }

    handleDescriptionChange(event) {
        this.newIssueDescription = event.target.value;
    }

    handlePriorityChange(event) {
        this.selectedPriority = event.target.value;
    }

    handleInitialStatusChange(event) {
        this.selectedInitialStatus = event.target.value;
    }

    handleDueDateChange(event) {
        this.newIssueDueDate = event.target.value;
    }

    handleAssigneeChange(event) {
        this.selectedAssignee = event.target.value;
    }

    handleCloseModal() {
        this.showCreateModal = false;
        this.resetFormData();
    }

    resetFormData() {
        this.selectedProject = '';
        this.selectedIssueType = '';
        this.newIssueSummary = '';
        this.newIssueDescription = '';
        this.selectedPriority = '';
        this.selectedInitialStatus = 'to-do'; // Default to To Do status
        this.newIssueDueDate = '';
        this.selectedAssignee = '';
        this.availableIssueTypes = [];
        this.isCreatingIssue = false;
    }

    async handleSaveIssue() {
        if (this.isCreateButtonDisabled) return;

        this.isCreatingIssue = true;

        try {
            const issueData = {
                projectKey: this.selectedProject,
                issueTypeId: this.selectedIssueType,
                summary: this.newIssueSummary.trim(),
                description: this.newIssueDescription.trim(),
                priorityId: this.selectedPriority,
                initialStatus: this.selectedInitialStatus,
                dueDate: this.newIssueDueDate,
                assigneeId: this.selectedAssignee
            };

            console.log('Creating issue with data:', issueData);
            console.log('Selected assignee:', this.selectedAssignee);
            console.log('Available assignees:', this.availableAssignees);
            
            const result = await createJiraIssueApex({ issueData: JSON.stringify(issueData) });
            
            if (result && result.startsWith('SUCCESS:')) {
                // Extract issue key from success message
                const issueKeyMatch = result.match(/Issue ([A-Z]+-\d+) created/);
                const issueKey = issueKeyMatch ? issueKeyMatch[1] : '';
                
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success!',
                        message: `Jira issue ${issueKey} created successfully and assigned to you!`,
                        variant: 'success',
                        mode: 'dismissable'
                    })
                );
                
                // Close modal first
                this.handleCloseModal();
                
                // Force a complete refresh of the data
                this.isLoading = true;
                this.errorMessage = undefined;
                
                try {
                    // Wait a moment for Jira to process the new issue
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Force refresh the wired data
                    await refreshApex(this._wiredJiraDataResult);
                    console.log('Refreshed issues list after creation');
                    
                    // Additional sync in background
                    setTimeout(() => {
                        this.performBackgroundSync();
                    }, 3000);
                    
                } catch (refreshError) {
                    console.error('Error refreshing after creation:', refreshError);
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Note',
                            message: 'Issue created successfully. Please refresh manually to see the new issue.',
                            variant: 'info'
                        })
                    );
                } finally {
                    this.isLoading = false;
                }
                
            } else {
                throw new Error(result || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error creating Jira issue:', error);
            
            // Parse the error message to provide more helpful feedback
            let userFriendlyMessage = this.parseCreateIssueError(error);
            
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error Creating Issue',
                    message: userFriendlyMessage,
                    variant: 'error',
                    mode: 'sticky'
                })
            );
        } finally {
            this.isCreatingIssue = false;
        }
    }

    // Helper method to parse and provide user-friendly error messages
    parseCreateIssueError(error) {
        const errorMessages = this.reduceErrors(error);
        const errorText = errorMessages.join(', ');
        
        // Check for common field permission issues
        if (errorText.includes('priority') && errorText.includes('not on the appropriate screen')) {
            return 'Issue created but priority could not be set due to Jira field configuration. You can update priority after creation.';
        }
        
        if (errorText.includes('duedate') && errorText.includes('not on the appropriate screen')) {
            return 'Issue created but due date could not be set due to Jira field configuration. You can update due date after creation.';
        }
        
        if (errorText.includes('assignee') && errorText.includes('not on the appropriate screen')) {
            return 'Issue created but assignee could not be set due to Jira field configuration. You can update assignee after creation.';
        }
        
        if (errorText.includes('Field') && errorText.includes('cannot be set')) {
            return 'Issue creation failed due to Jira field configuration. Try creating with only required fields (Project, Issue Type, Summary).';
        }
        
        // Return the original error if no specific pattern matches
        return errorText;
    }

    getPriorityBadgeStyling(priorityColorClassFromApex) {
        let baseClass = 'tag-priority';
        if (priorityColorClassFromApex === 'priority-high') return `${baseClass} tag-priority-high`;
        if (priorityColorClassFromApex === 'priority-medium') return `${baseClass} tag-priority-medium`;
        if (priorityColorClassFromApex === 'priority-low') return `${baseClass} tag-priority-low`;
        return `${baseClass} tag-priority-default`;
    }

    handleSummaryClick(event) { event.stopPropagation(); }
    handleItemClick(event) { /* No action as per previous requirement */ }
    preventBubbling(event){ event.stopPropagation(); }

    // Simple status change - no complex operations
    async handleStatusChange(event) {
        event.stopPropagation();
        
        if (this.statusChangeInProgress) return;

        const issueKey = event.target.dataset.issueKey;
        const transitionId = event.target.value;

        if (!issueKey || !transitionId) return;

        const issueIndex = this.allIssues.findIndex(iss => iss.key === issueKey);
        if (issueIndex === -1) return;

        const selectElement = event.target;
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const newStatusName = selectedOption.text;

        this.statusChangeInProgress = true;

        // Show spinner
        this.allIssues[issueIndex].isUpdating = true;

        try {
            const result = await updateJiraIssueStatusApex({ issueKey: issueKey, transitionId: transitionId });
            if (result === 'SUCCESS') {
                // Update immediately
                this.allIssues[issueIndex].status = newStatusName;
                this.allIssues[issueIndex].statusId = selectedOption.dataset.statusId || this.allIssues[issueIndex].statusId;
                this.allIssues[issueIndex].isUpdating = false;
                
                // Update available statuses
                const availableStatuses = this.allIssues[issueIndex].availableStatuses || [];
                this.allIssues[issueIndex].filteredAvailableStatuses = availableStatuses
                    .filter(s => s.value !== this.allIssues[issueIndex].statusId)
                    .map(s => ({ ...s, value: s.transitionId }));

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: `Issue ${issueKey} status updated to ${newStatusName}`,
                        variant: 'success',
                    })
                );

                // Background sync after status change
                setTimeout(() => {
                    this.performBackgroundSync();
                }, 2000);

            } else { 
                throw new Error(result); 
            }
        } catch (error) {
            const errorMessage = this.reduceErrors(error).join(', ');
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error Updating Jira Status',
                    message: `Failed for ${issueKey}: ${errorMessage}`,
                    variant: 'error', mode: 'sticky'
                })
            );
            
            // Reset on error
            this.allIssues[issueIndex].isUpdating = false;
            event.target.value = this.allIssues[issueIndex].statusId;
        } finally {
            this.statusChangeInProgress = false;
        }
    }

    reduceErrors(errors) {
        if (!Array.isArray(errors)) errors = [errors];
        return errors
            .filter(error => !!error)
            .map(error => {
                if (Array.isArray(error.body)) return error.body.map(e => e.message);
                if (error.body && typeof error.body.message === 'string') return error.body.message;
                if (typeof error.message === 'string' && error.message.includes('AuraHandledException')) {
                     try {
                        let detail = error.message.split('message":"')[1];
                        if (detail) return detail.split('"')[0];
                     } catch(e) {/*ignore parse error*/}
                }
                if (typeof error.message === 'string') return error.message;
                return 'Unknown error';
            })
            .reduce((prev, curr) => prev.concat(curr), [])
            .filter(message => !!message);
    }
}