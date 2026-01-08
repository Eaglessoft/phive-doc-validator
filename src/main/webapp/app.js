// API base URL
const API_BASE_URL = window.location.origin;

// DOM elements
const fileInput = document.getElementById('fileInput');
const fileText = document.getElementById('fileText');
const pasteContent = document.getElementById('pasteContent');
const pasteMethod = document.getElementById('pasteMethod');
const fileMethod = document.getElementById('fileMethod');
const pasteContentGroup = document.getElementById('pasteContentGroup');
const fileUploadGroup = document.getElementById('fileUploadGroup');
const ruleSelectTrigger = document.getElementById('ruleSelectTrigger');
const ruleSelectText = document.getElementById('ruleSelectText');
const ruleSearch = document.getElementById('ruleSearch');
const ruleSelect = document.getElementById('ruleSelect');
const ruleDropdown = document.getElementById('ruleDropdown');
const ruleList = document.getElementById('ruleList');
const hideDeprecatedRules = document.getElementById('hideDeprecatedRules');
const submitBtn = document.getElementById('submitBtn');
const validationForm = document.getElementById('validationForm');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const resultContent = document.getElementById('resultContent');
const errorContent = document.getElementById('errorContent');

// Store all rules
let allRules = [];
let filteredRules = [];
let isDropdownOpen = false;

// Store content for each input method
let pasteContentValue = '';
let uploadedFileName = '';
let uploadedFile = null;
let currentXmlContent = ''; // Store current XML content for download


// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadRules();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);
    pasteContent.addEventListener('input', () => {
        handlePasteContentChange();
        updateLineNumbers();
    });
    // Sync scroll between textarea and line numbers
    const textareaWrapper = document.querySelector('.textarea-wrapper');
    if (textareaWrapper) {
        textareaWrapper.addEventListener('scroll', () => {
            const lineNumbers = document.getElementById('lineNumbers');
            if (lineNumbers) {
                lineNumbers.scrollTop = textareaWrapper.scrollTop;
            }
        });
    }
    pasteMethod.addEventListener('change', handleInputMethodChange);
    fileMethod.addEventListener('change', handleInputMethodChange);
    validationForm.addEventListener('submit', handleFormSubmit);
    
    // Custom dropdown trigger
    ruleSelectTrigger.addEventListener('click', toggleDropdown);
    
    // Rule search events (inside dropdown)
    ruleSearch.addEventListener('input', handleRuleSearch);
    ruleSearch.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropdown from closing
    });
    
    // Hide deprecated rules checkbox
    hideDeprecatedRules.addEventListener('change', handleDeprecatedFilterChange);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!ruleSelectTrigger.contains(e.target) && !ruleDropdown.contains(e.target)) {
            closeDropdown();
        }
    });
    
    // Prevent dropdown from closing when clicking inside
    ruleDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Initialize line numbers
    updateLineNumbers();
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        uploadedFileName = file.name;
        uploadedFile = file;
        fileText.textContent = file.name;
        fileText.style.color = '#6794f1';
        
        // Read file content and put it in paste content area (but don't switch method)
        const reader = new FileReader();
        reader.onload = function(e) {
            pasteContentValue = e.target.result;
            currentXmlContent = e.target.result; // Store for download
            pasteContent.value = pasteContentValue;
            // Only update line numbers if paste method is currently visible
            if (pasteMethod.checked) {
                updateLineNumbers();
            }
            checkFormValidity();
        };
        reader.onerror = function() {
            showError('Failed to read file content');
        };
        reader.readAsText(file);
    } else {
        uploadedFileName = '';
        uploadedFile = null;
        fileText.textContent = 'Select XML file';
        fileText.style.color = '#64748b';
        checkFormValidity();
    }
}

// Handle paste content change
function handlePasteContentChange(event) {
    pasteContentValue = pasteContent.value;
    updateLineNumbers();
    checkFormValidity();
}

// Ensure file input is enabled when file upload group is shown
function ensureFileInputEnabled() {
    if (fileInput) {
        fileInput.disabled = false;
        fileInput.removeAttribute('disabled');
    }
}

// Handle input method change
function handleInputMethodChange(event) {
    const pasteTab = document.querySelector('label[for="pasteMethod"]');
    const fileTab = document.querySelector('label[for="fileMethod"]');
    
    if (pasteMethod.checked) {
        pasteContentGroup.style.display = 'block';
        fileUploadGroup.style.display = 'none';
        // Restore paste content value (don't clear it)
        pasteContent.value = pasteContentValue;
        updateLineNumbers();
        if (pasteTab) pasteTab.classList.add('active');
        if (fileTab) fileTab.classList.remove('active');
    } else if (fileMethod.checked) {
        pasteContentGroup.style.display = 'none';
        fileUploadGroup.style.display = 'block';
        // Restore file selection state (don't clear it)
        if (uploadedFileName) {
            fileText.textContent = uploadedFileName;
            fileText.style.color = '#6794f1';
        } else {
            fileText.textContent = 'Select XML file';
            fileText.style.color = '#64748b';
        }
        ensureFileInputEnabled(); // Ensure file input is enabled
        if (fileTab) fileTab.classList.add('active');
        if (pasteTab) pasteTab.classList.remove('active');
    }
    checkFormValidity();
}

// Update line numbers for textarea
function updateLineNumbers() {
    const textarea = pasteContent;
    const lineNumbers = document.getElementById('lineNumbers');
    const lines = textarea.value.split('\n').length;
    const scrollTop = textarea.scrollTop;
    
    let lineNumbersHtml = '';
    for (let i = 1; i <= Math.max(lines, 15); i++) {
        lineNumbersHtml += `<div class="line-number">${i}</div>`;
    }
    lineNumbers.innerHTML = lineNumbersHtml;
    lineNumbers.scrollTop = scrollTop;
}

// Check if form is valid
function checkFormValidity() {
    const isPasteMethod = pasteMethod.checked;
    const hasFile = fileInput.files.length > 0;
    const hasPasteContent = pasteContent.value.trim().length > 0;
    const hasRule = ruleSelect.value !== '';
    
    const hasInput = isPasteMethod ? hasPasteContent : hasFile;
    submitBtn.disabled = !(hasInput && hasRule);
}

// Toggle dropdown
function toggleDropdown() {
    if (isDropdownOpen) {
        closeDropdown();
    } else {
        openDropdown();
    }
}

// Open dropdown
function openDropdown() {
    isDropdownOpen = true;
    ruleSelectTrigger.classList.add('active');
    ruleDropdown.style.display = 'flex';
    ruleSearch.focus();
    // Hide footer when dropdown is open
    const footer = document.querySelector('footer');
    if (footer) {
        footer.style.display = 'none';
    }
    // Populate with current filtered rules
    if (allRules.length > 0) {
        const searchTerm = ruleSearch.value.toLowerCase().trim();
        applyFilters(searchTerm);
    }
}

// Close dropdown
function closeDropdown() {
    isDropdownOpen = false;
    ruleSelectTrigger.classList.remove('active');
    ruleDropdown.style.display = 'none';
    ruleSearch.value = '';
    // Show footer when dropdown is closed
    const footer = document.querySelector('footer');
    if (footer) {
        footer.style.display = 'block';
    }
}

// Load available rules from API
async function loadRules() {
    try {
        const response = await fetch(`${API_BASE_URL}/list-rules`);
        if (!response.ok) {
            throw new Error('Failed to load rules');
        }
        
        const data = await response.json();
        
        // Store all rules
        if (data.rules && data.rules.length > 0) {
            allRules = data.rules;
            // Apply initial filters (deprecated filter is checked by default)
            applyFilters('');
            ruleSearch.placeholder = `${allRules.length} rules available - Search...`;
        } else {
            ruleList.innerHTML = '<div class="rule-empty">No rules found</div>';
            showError('No rules found');
        }
    } catch (error) {
        console.error('Error loading rules:', error);
        ruleList.innerHTML = '<div class="rule-empty">Failed to load rules</div>';
        showError('An error occurred while loading rules: ' + error.message);
    }
}

// Handle rule search input
function handleRuleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    applyFilters(searchTerm);
}

// Handle deprecated filter change
function handleDeprecatedFilterChange() {
    const searchTerm = ruleSearch.value.toLowerCase().trim();
    applyFilters(searchTerm);
}

// Apply both search and deprecated filters
function applyFilters(searchTerm) {
    let rules = [...allRules];
    
    // Apply search filter
    if (searchTerm !== '') {
        rules = rules.filter(rule => {
            const readableName = (rule.readableName || rule.name || rule.vesid || '').toLowerCase();
            const vesid = (rule.vesid || '').toLowerCase();
            return readableName.includes(searchTerm) || vesid.includes(searchTerm);
        });
    }
    
    // Apply deprecated filter
    if (hideDeprecatedRules.checked) {
        rules = rules.filter(rule => !rule.deprecated);
    }
    
    filteredRules = rules;
    renderRuleList(filteredRules);
}

// Render rule list in dropdown
function renderRuleList(rules) {
    ruleList.innerHTML = '';
    
    if (rules.length === 0) {
        ruleList.innerHTML = '<div class="rule-empty">No results found</div>';
        return;
    }
    
    // Add rules to list
    rules.forEach(rule => {
        const item = document.createElement('div');
        item.className = `rule-item ${rule.deprecated ? 'deprecated' : ''} ${ruleSelect.value === rule.vesid ? 'selected' : ''}`;
        
        const readableName = rule.readableName || rule.name || rule.vesid;
        const vesid = rule.vesid;
        
        item.innerHTML = `
            <div class="rule-item-name">${escapeHtml(readableName)}</div>
            <div class="rule-item-vesid">${escapeHtml(vesid)}</div>
        `;
        
        item.addEventListener('click', () => {
            selectRule(rule);
        });
        
        ruleList.appendChild(item);
    });
}

// Select a rule
function selectRule(rule) {
    const readableName = rule.readableName || rule.name || rule.vesid;
    ruleSelect.value = rule.vesid;
    ruleSelectText.textContent = readableName;
    closeDropdown();
    checkFormValidity();
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const rule = ruleSelect.value;
    const isPasteMethod = pasteMethod.checked;
    
    if (!rule) {
        showError('Please select a validation rule');
        ruleSelect.focus();
        return;
    }
    
    // Show loading state
    setLoadingState(true);
    hideResults();
    
    try {
        const formData = new FormData();
        formData.append('rule', rule);
        
        if (isPasteMethod) {
            // Paste content method
            const pasteText = pasteContent.value.trim();
            if (!pasteText) {
                showError('Please paste XML content');
                setLoadingState(false);
                return;
            }
            
            // Store XML content for download
            currentXmlContent = pasteText;
            
            // Create a Blob from the paste content
            const blob = new Blob([pasteText], { type: 'application/xml' });
            const fileName = 'pasted-content.xml';
            formData.append('file', blob, fileName);
            formData.append('isPasteContent', 'true');
        } else {
            // File upload method - use paste content if it has been edited, otherwise use original file
            const pasteText = pasteContent.value.trim();
            if (pasteText && uploadedFile) {
                // User has edited the content in paste area, use that instead
                currentXmlContent = pasteText;
                const blob = new Blob([pasteText], { type: 'application/xml' });
                const fileName = uploadedFileName || 'uploaded-file.xml';
                formData.append('file', blob, fileName);
            } else {
                // Use original uploaded file
                const file = fileInput.files[0];
                if (!file) {
                    showError('Please select an XML file');
                    setLoadingState(false);
                    return;
                }
                // Use stored XML content if available, otherwise read from file
                if (currentXmlContent) {
                    formData.append('file', file);
                } else {
                    // Read file content for download (should already be stored, but just in case)
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        currentXmlContent = e.target.result;
                    };
                    reader.readAsText(file);
                    formData.append('file', file);
                }
            }
        }
        
        const response = await fetch(`${API_BASE_URL}/validate`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        // Check for HTTP errors
        if (!response.ok) {
            // Check if PHIVE returned a global error
            const errorMessage = result.error || result.message || result.errorText || 'Validation error';
            throw new Error(errorMessage);
        }
        
        // Check for PHIVE global errors in response
        if (result.error || result.errorText) {
            const errorMessage = result.error || result.errorText || 'Validation error';
            showError(errorMessage);
            return;
        }
        
        // Display results (even if validation failed, we still show the results)
        displayResults(result);
    } catch (error) {
        console.error('Validation error:', error);
        showError('An error occurred during validation: ' + error.message);
    } finally {
        setLoadingState(false);
    }
}

// Set loading state
function setLoadingState(loading) {
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    if (loading) {
        submitBtn.disabled = true;
        btnText.textContent = 'Validating...';
        btnLoader.style.display = 'inline-block';
    } else {
        submitBtn.disabled = false;
        btnText.textContent = 'Validate';
        btnLoader.style.display = 'none';
        checkFormValidity();
    }
}

// Display validation results
function displayResults(result) {
    errorSection.style.display = 'none';
    resultSection.style.display = 'block';
    
    const isSuccess = result.success === true;
    const fileName = result.fileName || 'Unknown file';
    
    // Count total errors and warnings
    let totalErrors = 0;
    let totalWarnings = 0;
    const validationResults = [];
    
    if (result.results && Array.isArray(result.results)) {
        result.results.forEach(resultItem => {
            const items = resultItem.items || [];
            let errors = 0;
            let warnings = 0;
            
            items.forEach(item => {
                const level = (item.errorLevel || item.severity || '').toUpperCase();
                if (level.includes('ERROR') || level === 'ERROR') {
                    errors++;
                    totalErrors++;
                } else if (level.includes('WARNING') || level === 'WARNING' || level.includes('WARN')) {
                    warnings++;
                    totalWarnings++;
                }
            });
            
            validationResults.push({
                artifactType: resultItem.artifactType || 'Unknown',
                artifactPath: resultItem.artifactPath || '',
                success: resultItem.success,
                items: items,
                errors: errors,
                warnings: warnings
            });
        });
    }
    
    // Build HTML
    let html = '';
    
    // Summary message
    const summaryMessage = isSuccess 
        ? `The file <strong>${escapeHtml(fileName)}</strong> is valid. It contains <strong>${totalErrors}</strong> errors and <strong>${totalWarnings}</strong> warnings.`
        : `The file <strong>${escapeHtml(fileName)}</strong> is invalid. It contains <strong>${totalErrors}</strong> errors and <strong>${totalWarnings}</strong> warnings.`;
    
    html += `<div class="validation-summary-message ${isSuccess ? 'success' : 'error'}">${summaryMessage}</div>`;
    
    // Summary table
    if (validationResults.length > 0) {
        html += '<div class="validation-summary-section">';
        html += '<h3 class="section-title">Summary</h3>';
        html += '<table class="validation-summary-table">';
        html += '<thead><tr><th>Validation type</th><th>Validation artifact</th><th>Warnings</th><th>Errors</th></tr></thead>';
        html += '<tbody>';
        
        validationResults.forEach(vr => {
            const artifactType = formatArtifactType(vr.artifactType);
            const artifactPath = escapeHtml(vr.artifactPath);
            html += `<tr>
                <td>${artifactType}</td>
                <td>${artifactPath}</td>
                <td class="count-cell ${vr.warnings > 0 ? 'has-warnings' : ''}">${vr.warnings}</td>
                <td class="count-cell ${vr.errors > 0 ? 'has-errors' : ''}">${vr.errors}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        html += '</div>';
    }
    
    // Details section
    if (validationResults.length > 0) {
        html += '<div class="validation-details-section">';
        html += '<h3 class="section-title">Details</h3>';
        
        validationResults.forEach((vr, index) => {
            const artifactType = formatArtifactType(vr.artifactType);
            const artifactPath = escapeHtml(vr.artifactPath);
            
            html += `<div class="validation-detail-group">`;
            html += `<h4 class="detail-group-title">${artifactType} - ${artifactPath}</h4>`;
            
            if (vr.items && vr.items.length > 0) {
                vr.items.forEach(item => {
                    const itemClass = getItemClass(item);
                    const itemIcon = getItemIcon(item);
                    const errorText = item.errorText || item.message || item.text || '';
                    const errorLocation = item.errorLocation || item.errorLocationStr || '';
                    const errorField = item.errorFieldName || item.field || '';
                    const errorLevel = item.errorLevel || item.severity || '';
                    
                    html += `
                        <div class="validation-item ${itemClass}">
                            <div class="validation-item-title">
                                ${itemIcon} ${errorLevel ? escapeHtml(errorLevel) : 'Validation Item'}${errorField ? ' - ' + escapeHtml(errorField) : ''}
                            </div>
                            <div class="validation-item-message">
                                ${escapeHtml(errorText)}
                                ${errorLocation ? `<br><small style="color: var(--text-secondary);">Location: ${escapeHtml(errorLocation)}</small>` : ''}
                            </div>
                        </div>
                    `;
                });
            } else {
                html += '<div class="validation-item success">';
                html += '<div class="validation-item-message">All fine on this level</div>';
                html += '</div>';
            }
            
            html += `</div>`;
        });
        
        html += '</div>';
    }
    
    // Add action buttons HTML
    html += `
        <div class="action-buttons">
            <button class="action-btn toggle-json" id="toggleJsonBtn">
                <span class="btn-icon">📄</span>
                <span>Show/Hide JSON Result</span>
            </button>
            <div class="download-buttons">
                <button class="action-btn download-btn" id="downloadJsonBtn">
                    <span class="btn-icon">⬇️</span>
                    <span>Download JSON Result</span>
                </button>
                <button class="action-btn download-btn" id="downloadXmlBtn">
                    <span class="btn-icon">⬇️</span>
                    <span>Download XML File</span>
                </button>
            </div>
        </div>
        <div id="jsonViewer" class="json-viewer" style="display: none;">
            <pre>${JSON.stringify(result, null, 2)}</pre>
        </div>
    `;
    
    resultContent.innerHTML = html;
    
    // Attach event listeners to buttons after DOM is updated
    const toggleJsonBtn = document.getElementById('toggleJsonBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const downloadXmlBtn = document.getElementById('downloadXmlBtn');
    
    if (toggleJsonBtn) {
        toggleJsonBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleJsonViewer();
        };
    }
    
    if (downloadJsonBtn) {
        downloadJsonBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            downloadJsonResult(result, fileName);
        };
    }
    
    if (downloadXmlBtn) {
        downloadXmlBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            downloadXmlFile(fileName);
        };
    }
    
    // Scroll to results
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Format artifact type to readable format
function formatArtifactType(type) {
    if (!type) return 'Unknown';
    
    const typeUpper = type.toUpperCase();
    
    // Check for Schematron patterns
    if (typeUpper.includes('SCHEMATRON') || typeUpper.includes('SCH')) {
        // Check for ISO XSLT2 pattern
        if (type.includes('ISO') && (type.includes('XSLT2') || type.includes('XSLT 2') || type.includes('XSLT-2'))) {
            return 'Schematron (ISO XSLT2)';
        }
        // Check for other Schematron variants
        if (typeUpper.includes('ISO')) {
            return 'Schematron (ISO)';
        }
        return 'Schematron';
    }
    
    // Check for XML Schema patterns
    if (typeUpper.includes('SCHEMA') || typeUpper.includes('XSD') || typeUpper.includes('XSDSCHEMA')) {
        return 'XML Schema';
    }
    
    // Check for XML Syntax patterns
    if (typeUpper.includes('XML') && (typeUpper.includes('SYNTAX') || typeUpper.includes('PARSER'))) {
        return 'XML Syntax';
    }
    
    // Check for generic XML
    if (typeUpper.includes('XML') && !typeUpper.includes('SCHEMA') && !typeUpper.includes('SCHEMATRON')) {
        return 'XML Syntax';
    }
    
    // Return formatted version
    return type.split(/[-_\s]+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Get item class based on severity
function getItemClass(item) {
    const level = (item.errorLevel || item.severity || '').toUpperCase();
    if (level.includes('ERROR') || level === 'ERROR') {
        return 'error';
    } else if (level.includes('WARNING') || level === 'WARNING' || level.includes('WARN')) {
        return 'warning';
    }
    return 'success';
}

// Get item icon based on severity
function getItemIcon(item) {
    const level = (item.errorLevel || item.severity || '').toUpperCase();
    if (level.includes('ERROR') || level === 'ERROR') {
        return '❌';
    } else if (level.includes('WARNING') || level === 'WARNING' || level.includes('WARN')) {
        return '⚠️';
    }
    return '✅';
}

// Show error message
function showError(message) {
    resultSection.style.display = 'none';
    errorSection.style.display = 'block';
    errorContent.innerHTML = `
        <div class="validation-item error">
            <div class="validation-item-title">❌ Error</div>
            <div class="validation-item-message">${escapeHtml(message)}</div>
        </div>
    `;
    
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide results
function hideResults() {
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
}

// Toggle JSON viewer
function toggleJsonViewer() {
    const jsonViewer = document.getElementById('jsonViewer');
    if (jsonViewer) {
        jsonViewer.style.display = jsonViewer.style.display === 'none' ? 'block' : 'none';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Download JSON result
function downloadJsonResult(result, fileName) {
    try {
        const jsonString = JSON.stringify(result, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseFileName = fileName ? fileName.replace(/\.xml$/i, '') : 'validation_result';
        a.download = baseFileName + '_validation_result.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error('Error downloading JSON:', error);
        showError('Failed to download JSON result: ' + error.message);
    }
}

// Download XML file
function downloadXmlFile(fileName) {
    try {
        if (!currentXmlContent) {
            showError('No XML content available to download');
            return;
        }
        const blob = new Blob([currentXmlContent], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'document.xml';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error('Error downloading XML:', error);
        showError('Failed to download XML file: ' + error.message);
    }
}

// Make functions available globally
window.toggleJsonViewer = toggleJsonViewer;

