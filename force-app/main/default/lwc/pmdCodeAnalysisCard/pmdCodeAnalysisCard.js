// pmdCodeAnalysisCard.js
import { LightningElement, track, wire } from 'lwc';
import getApexClassOptions from '@salesforce/apex/DashboardController.getApexClassOptions';
import scanApexClass from '@salesforce/apex/DashboardController.scanApexClass';
import analyzeClasses from '@salesforce/apex/AFD_PMDAnalysis.analyzeClasses';
import suggestCodeFix from '@salesforce/apex/DashboardController.suggestCodeFix';
import getAISuggestionForViolation from '@salesforce/apex/AFD_PMDSuggestions.getAISuggestionForViolation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PmdCodeAnalysisCard extends LightningElement {
    @track selectedClassId = '';
    @track selectedClassName = '';
    @track isScanning = false;
    @track isSuggesting = false;
    @track aiSuggestion = '';
    @track showSuggestion = false;
    @track classOptions = [];
    @track error = null;
    @track isLoading = true;
    @track filteredOptions = [];
    @track selectedValues = [];
    @track findings = [];       // PMD violations
    @track isScanning = false;
    @track isTable = false;
    @track scanButtonDisabled = true;
    @track scanCount = 0;

     columns = [
        { label: 'Apex Class Name', fieldName: 'label' }
    ];

     findingscolumns = [
        { label: 'Class Name', fieldName: 'className', type: 'text' },
        { label: 'Line', fieldName: 'line', type: 'number' },
        { label: 'Rule', fieldName: 'rule', type: 'text' },
        { label: 'Message', fieldName: 'message', type: 'text' },
        { label: 'Severity', fieldName: 'severity', type: 'number' },
         {
            type: 'button',
            typeAttributes: {
                label: 'AI Suggestion',
                name: 'suggest_fix',
                variant: 'brand-outline',
                disabled: { fieldName: 'isFixDisabled' },
                iconName: 'utility:einstein'
            },
            cellAttributes: { alignment: 'center' },
            initialWidth: 160
        }
    ];

    handleSearch(event) {
    const searchKey = event.target.value.toLowerCase();

    // Filter based on search, maintain checked status
    this.filteredOptions = this.classOptions
        .filter(opt => opt.label.toLowerCase().includes(searchKey));
}

handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;

        if (action === 'suggest_fix') {
            this.callAISuggestion(row);
        }
    }

    @track isModalOpen = false;
    @track suggestionText = '';
    @track isLoadingAI = false;


    callAISuggestion(row) {
         this.isModalOpen = true;
        this.isLoadingAI = true;
        this.suggestionText = '';
        getAISuggestionForViolation({ violationJson: JSON.stringify(row) })
            .then(result => {
                // You can show this in a modal, toast, etc.
                console.log('AI Suggestion:', JSON.stringify(result));
                this.suggestionText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            })
            .catch(error => {
                console.error('Error getting AI suggestion:', error.message);
                this.suggestionText = `Error: ${error?.body?.message || error.message || error}`;
                this.isModalOpen = true;
            })
            .finally(() => {
                this.isLoadingAI = false;
            });;
    }

     closeModal() {
        this.isModalOpen = false;
        this.suggestionText = '';
        this.isLoadingAI = false;
    }

handleCheckboxChange(event) {
    const { value, checked } = event.target;

    // Count how many are currently selected
    const currentlySelected = this.classOptions.filter(opt => opt.checked).length;

    // If trying to check another and already 5 selected, block and show toast
    if (checked && currentlySelected >= 5) {
        // Show toast
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Selection Limit Exceeded',
                message: 'You can select up to 5 classes only.',
                variant: 'warning'
            })
        );

        // Do not update the checkbox state
        event.target.checked = false;
        return;
    }

    // Update classOptions to keep master state
    this.classOptions = this.classOptions.map(opt => ({
        ...opt,
        checked: opt.value === value ? checked : opt.checked
    }));

    // Update filteredOptions to keep UI in sync
    this.filteredOptions = this.filteredOptions.map(opt => ({
        ...opt,
        checked: opt.value === value ? checked : opt.checked
    }));

    // Update selected values array
    this.selectedValues = this.classOptions
        .filter(opt => opt.checked)
        .map(opt => opt.value); // or opt.value if you need IDs
    this.scanCount = this.selectedValues.length;
    this.scanButtonDisabled = false;

    console.log('Selected Classes: ', JSON.stringify(this.selectedValues));
}

handleScanClass() {
    if (!this.selectedValues || this.selectedValues.length === 0) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'No Classes Selected',
                message: 'Please select at least one class to scan.',
                variant: 'warning'
            })
        );
        return;
    }

    this.isScanning = true; // start loading state

    analyzeClasses({ classIds: this.selectedValues })
        .then(result => {
            console.log('Scan Results: ', JSON.stringify(result));
            this.findings = result;
            this.isTable = true;
            this.selectedValues= [];
            this.scanButtonDisabled = true;
        })
        .catch(error => {
            console.error('Error scanning classes:', error);
            this.scanButtonDisabled = false;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Scan Failed',
                    message: 'An error occurred while scanning classes.',
                    variant: 'error'
                })
            );
        })
        .finally(() => {
            this.isScanning = false; // stop loading state
        });
}


     selectedClasses = [];

    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows;
        this.selectedClasses = selectedRows.map(row => row.className);
    }
    // Get the PMD icon URL - using a code analysis icon
    get pmdIconUrl() {
        return '/img/icon/t4v35/standard/apex_120.png'; // Apex icon for PMD
    }
    

    // Columns for the findings datatable
    // findingsColumns = [
    //     { 
    //         label: 'Rule', 
    //         fieldName: 'rule', 
    //         type: 'text',
    //         wrapText: false,
    //         sortable: true,
    //         cellAttributes: { 
    //             class: 'rule-cell'
    //         },
    //         initialWidth: 150
    //     },
    //     { 
    //         label: 'Line', 
    //         fieldName: 'line', 
    //         type: 'number',
    //         cellAttributes: { alignment: 'center' },
    //         initialWidth: 70,
    //         sortable: true
    //     },
    //     { 
    //         label: 'Severity', 
    //         fieldName: 'severity', 
    //         type: 'text',
    //         cellAttributes: { 
    //             class: { fieldName: 'severityClass' },
    //             alignment: 'center'
    //         },
    //         initialWidth: 100,
    //         sortable: true
    //     },
    //     { 
    //         label: 'Message', 
    //         fieldName: 'message', 
    //         type: 'text',
    //         wrapText: true,
    //         cellAttributes: { class: 'message-cell' }
    //     },
    //     {
    //         type: 'button',
    //         typeAttributes: {
    //             label: 'AI Suggestion',
    //             name: 'suggest_fix',
    //             variant: 'brand-outline',
    //             disabled: { fieldName: 'isFixDisabled' },
    //             iconName: 'utility:einstein'
    //         },
    //         cellAttributes: { alignment: 'center' },
    //         initialWidth: 160
    //     }
    // ];

    @wire(getApexClassOptions)
    wiredApexClasses({ error, data }) {
        if (data) {
            this.classOptions = data.map(option => ({
                label: option.label,
                value: option.value
            }));
             this.filteredOptions = [...this.classOptions];
            this.isLoading = false;
            this.error = null;
            this.isLoading = false;
        } else if (error) {
            this.error = 'Failed to load Apex classes';
            this.isLoading = false;
            console.error('Error loading Apex classes:', error);
        }
        // Don't set isLoading to false here if no data and no error - keep loading state
    }

    handleClassSelection(event) {
        this.selectedClassId = event.detail.value;
        const selectedOption = this.classOptions.find(opt => opt.value === this.selectedClassId);
        this.selectedClassName = selectedOption ? selectedOption.label : '';
        this.clearResults();
    }

    // async handleScanClass() {
    //     if (!this.selectedClassId) {
    //         this.showToast('Warning', 'Please select an Apex class first', 'warning');
    //         return;
    //     }

    //     this.isScanning = true;
    //     this.error = null;
    //     this.clearResults();

    //     try {
    //         const result = await scanApexClass({ classId: this.selectedClassId });
            
    //         // Process the findings and add required properties for datatable
    //         this.findings = result.map((finding, index) => ({
    //             id: index,
    //             rule: finding.rule || 'Unknown Rule',
    //             line: finding.line || 1,
    //             message: finding.message || 'No message provided',
    //             severity: finding.severity || 'Info',
    //             severityClass: this.getSeverityClass(finding.severity || 'Info'),
    //             isFixDisabled: false
    //         }));

    //         console.log('Processed findings:', this.findings); // Debug log

    //         if (this.findings.length === 0) {
    //             this.showToast('Success', `No PMD violations found in ${this.selectedClassName}! 🎉`, 'success');
    //         } else {
    //             this.showToast('Info', `Found ${this.findings.length} PMD violation(s) in ${this.selectedClassName}`, 'info');
    //         }
    //     } catch (error) {
    //         let errorMessage = error.body?.message || 'Failed to scan class';
            
    //         // Provide user-friendly error messages
    //         if (errorMessage.includes('timed out')) {
    //             errorMessage = `Analysis timed out for ${this.selectedClassName}. This class may be too large or complex. Try selecting a smaller class.`;
    //             this.showToast('Warning', errorMessage, 'warning');
    //         } else if (errorMessage.includes('too large')) {
    //             errorMessage = `${this.selectedClassName} is too large for PMD analysis. Please try a smaller class (under 100KB).`;
    //             this.showToast('Warning', errorMessage, 'warning');
    //         } else {
    //             this.showToast('Error', errorMessage, 'error');
    //         }
            
    //         this.error = errorMessage;
    //     } finally {
    //         this.isScanning = false;
    //     }
    // }

    // async handleRowAction(event) {
    //     if (event.detail.action.name === 'suggest_fix') {
    //         const row = event.detail.row;
    //         await this.getSuggestion(row);
    //     }
    // }

    async getSuggestion(finding) {
        this.isSuggesting = true;
        this.showSuggestion = false;
        this.aiSuggestion = '';

        try {
            const suggestion = await suggestCodeFix({
                classId: this.selectedClassId,
                lineNumber: finding.line,
                rule: finding.rule
            });

            // Process the suggestion to format it properly
            this.aiSuggestion = this.formatAISuggestion(suggestion);
            this.showSuggestion = true;
            
            // Update the DOM manually with formatted content
            setTimeout(() => {
                const suggestionElement = this.template.querySelector('.suggestion-text');
                if (suggestionElement) {
                    suggestionElement.innerHTML = this.aiSuggestion;
                }
            }, 100);
            
            this.showToast('Success', 'AI suggestion generated! 🤖', 'success');
        } catch (error) {
            const errorMsg = error.body?.message || 'Failed to get AI suggestion';
            this.showToast('Error', errorMsg, 'error');
        } finally {
            this.isSuggesting = false;
        }
    }

    // Helper method to format AI suggestions properly
    formatAISuggestion(rawSuggestion) {
        if (!rawSuggestion) return '';
        
        let formatted = rawSuggestion
            // Remove markdown bold formatting
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Format code blocks
            .replace(/```apex\s*([\s\S]*?)\s*```/g, '<div class="code-block"><pre><code>$1</code></pre></div>')
            .replace(/```\s*([\s\S]*?)\s*```/g, '<div class="code-block"><pre><code>$1</code></pre></div>')
            // Format inline code
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            // Convert line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            // Wrap in paragraphs
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
            
        return formatted;
    }

    handleRefreshCard() {
        // Refresh the class options
        this.isLoading = true;
        this.isTable = false;
        this.selectedValues = [];
        this.clearResults();
        
        // Re-trigger the wire by refreshing the component state
        this.error = null;
        
        // Use eval to trigger wire refresh (simple approach)
        setTimeout(() => {
            if (this.classOptions.length > 0) {
                this.isLoading = false;
                this.showToast('Success', 'Class list refreshed', 'success');
            }
        }, 500);
    }

    clearResults() {
        this.findings = [];
        this.selectedValues = [];
        this.aiSuggestion = '';
        this.showSuggestion = false;
        this.error = null;
    }

    getSeverityClass(severity) {
        switch(severity?.toLowerCase()) {
            case 'error':
            case 'high':
            case '1':
                return 'severity-error';
            case 'warning':
            case 'medium':
            case '2':
                return 'severity-warning';
            case 'info':
            case 'low':
            case '3':
            case '4':
            case '5':
                return 'severity-info';
            default:
                return 'severity-default';
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant,
            mode: 'dismissable'
        }));
    }

    // Getters for conditional rendering and styling
    get hasFindings() {
        return this.findings && this.findings.length > 0;
    }

    get hasClassSelected() {
        return this.selectedClassId !== '';
    }

    get scanButtonLabel() {
        return this.isScanning ? 'Scanning...' : 'Scan Class';
    }

    get scanButtonVariant() {
        return this.isScanning ? 'brand' : 'brand';
    }

    get scanButtonDisabled() {
        return this.isScanning || !this.hasClassSelected;
    }

    get suggestionTitle() {
        return `🤖 AI Suggestion${this.isSuggesting ? ' (Generating...)' : ''}`;
    }

    get findingsHeaderText() {
        if (!this.hasFindings) return '';
        const plural = this.findings.length === 1 ? 'Issue' : 'Issues';
        const filePlural = this.scanCount === 1 ? 'File' : 'Files';
        return `Found ${this.findings.length} ${plural} in ${this.scanCount} ${filePlural}`;
    }

    get emptyStateMessage() {
        if (!this.hasClassSelected) {
            return 'Select an Apex class to begin PMD code analysis with AI-powered suggestions.';
        }
        if (this.isScanning) {
            return `Analyzing ${this.selectedClassName} for code quality issues...`;
        }
        return `Ready to analyze ${this.selectedClassName}. Click "Scan Class" to start.`;
    }

    get showEmptyState() {
        return !this.hasFindings && !this.error && !this.isLoading;
    }

    get cardHeaderClass() {
        return 'card-header';
    }
}