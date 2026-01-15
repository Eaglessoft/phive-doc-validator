(function(){
    'use strict';
    
    // Get API endpoint from script tag data attribute (required)
    const currentScript = document.currentScript || (function() {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();
    const API_BASE_URL = currentScript && currentScript.getAttribute('data-api-url');
    
    if (!API_BASE_URL) {
        console.error('PEPPOL Validator: data-api-url attribute is required on script tag. Example: <script src="embed.js" data-api-url="https://your-api-url.com"></script>');
        return;
    }
    
    // Find the root container
    const rootContainer = document.querySelector('.peppol-e-invoice-xml-document-validator');
    
    if (!rootContainer) {
        console.error('Root container .peppol-e-invoice-xml-document-validator not found');
        return;
    }
    
    // Initialize the validator
    function initValidator() {
        // Build HTML structure
        rootContainer.innerHTML = `
            <div class="peppol-header">
                <div class="peppol-header-content">
                    <h1 class="peppol-main-title">Peppol e-document Validator</h1>
                    <p class="peppol-subtitle">Validate your XML documents according to Peppol and EN16931 standards</p>
                </div>
            </div>
            
            <div class="peppol-validator-form">
                <h2 class="peppol-validator-title">Upload and Validate File</h2>
                
                <div class="peppol-input-method-selector">
                    <label class="peppol-method-tab" for="peppol-fileMethod">
                        <input type="radio" name="peppol-inputMethod" value="file" id="peppol-fileMethod">
                        <span class="peppol-method-tab-content">
                            <span class="peppol-method-icon">📤</span>
                            <span class="peppol-method-text">Upload File</span>
                        </span>
                    </label>
                    <label class="peppol-method-tab active" for="peppol-pasteMethod">
                        <input type="radio" name="peppol-inputMethod" value="paste" id="peppol-pasteMethod" checked>
                        <span class="peppol-method-tab-content">
                            <span class="peppol-method-icon">📋</span>
                            <span class="peppol-method-text">Paste Content</span>
                        </span>
                    </label>
                </div>
                
                <div class="peppol-form-group" id="peppol-pasteContentGroup">
                    <div class="peppol-textarea-wrapper">
                        <div class="peppol-line-numbers" id="peppol-lineNumbers"></div>
                        <textarea id="peppol-pasteContent" rows="15" placeholder="Paste your XML content here..." class="peppol-textarea"></textarea>
                    </div>
                </div>
                
                <div class="peppol-form-group" id="peppol-fileUploadGroup" style="display: none;">
                    <label for="peppol-fileInput" class="peppol-file-label">
                        <span class="peppol-file-icon">📄</span>
                        <span class="peppol-file-text" id="peppol-fileText">Select XML file</span>
                        <input type="file" id="peppol-fileInput" accept=".xml">
                    </label>
                </div>
                
                <div class="peppol-form-group">
                    <label for="peppol-ruleSelect">Validation Rule:</label>
                    <div class="peppol-custom-select-wrapper">
                        <div class="peppol-custom-select-trigger" id="peppol-ruleSelectTrigger">
                            <span id="peppol-ruleSelectText">Select a rule...</span>
                            <span class="peppol-select-arrow">▼</span>
                        </div>
                        <div class="peppol-custom-select-dropdown" id="peppol-ruleDropdown" style="display: none;">
                            <div class="peppol-rule-search-in-dropdown">
                                <input type="text" 
                                       id="peppol-ruleSearch" 
                                       placeholder="Search rules..." 
                                       autocomplete="off">
                                <span class="peppol-search-icon">🔍</span>
                            </div>
                            <div class="peppol-rule-filter-options">
                                <label class="peppol-filter-checkbox-label">
                                    <input type="checkbox" id="peppol-hideDeprecatedRules" checked>
                                    <span>Hide deprecated rules</span>
                                </label>
                            </div>
                            <div class="peppol-rule-list" id="peppol-ruleList">
                                <div class="peppol-rule-loading">Loading...</div>
                            </div>
                        </div>
                        <input type="hidden" id="peppol-ruleSelect" name="rule" required>
                    </div>
                    <small class="peppol-help-text">Filter by searching or select from the list</small>
                </div>
                
                <button type="button" id="peppol-submitBtn" class="peppol-btn-primary" disabled>
                    <span class="peppol-btn-text">Validate</span>
                    <span class="peppol-btn-loader" style="display: none;">⏳</span>
                </button>
            </div>
            
            <div id="peppol-resultSection" class="peppol-result-section" style="display: none;">
                <div class="peppol-result-card">
                    <h3 class="peppol-result-title">Validation Results</h3>
                    <div id="peppol-resultContent"></div>
                </div>
            </div>
            
            <div id="peppol-errorSection" class="peppol-error-section" style="display: none;">
                <div class="peppol-error-card">
                    <h3 class="peppol-error-title">❌ Error</h3>
                    <div id="peppol-errorContent"></div>
                </div>
            </div>
            
            <div class="peppol-footer">
                <div class="peppol-footer-content">
                    <p class="peppol-footer-brand">Eaglessoft</p>
                    <p class="peppol-footer-tech">Powered by <a href="https://github.com/phax/phive" target="_blank" rel="noopener noreferrer" class="peppol-footer-link">Phive</a> (Philip Helger)</p>
                </div>
            </div>
        `;
        
        // Get DOM elements
        const pasteMethod = rootContainer.querySelector('#peppol-pasteMethod');
        const fileMethod = rootContainer.querySelector('#peppol-fileMethod');
        const pasteContent = rootContainer.querySelector('#peppol-pasteContent');
        const fileInput = rootContainer.querySelector('#peppol-fileInput');
        const fileText = rootContainer.querySelector('#peppol-fileText');
        const pasteContentGroup = rootContainer.querySelector('#peppol-pasteContentGroup');
        const fileUploadGroup = rootContainer.querySelector('#peppol-fileUploadGroup');
        const ruleSelect = rootContainer.querySelector('#peppol-ruleSelect');
        const ruleSelectTrigger = rootContainer.querySelector('#peppol-ruleSelectTrigger');
        const ruleSelectText = rootContainer.querySelector('#peppol-ruleSelectText');
        const ruleDropdown = rootContainer.querySelector('#peppol-ruleDropdown');
        const ruleSearch = rootContainer.querySelector('#peppol-ruleSearch');
        const ruleList = rootContainer.querySelector('#peppol-ruleList');
        const hideDeprecatedRules = rootContainer.querySelector('#peppol-hideDeprecatedRules');
        const lineNumbers = rootContainer.querySelector('#peppol-lineNumbers');
        const submitBtn = rootContainer.querySelector('#peppol-submitBtn');
        const resultSection = rootContainer.querySelector('#peppol-resultSection');
        const errorSection = rootContainer.querySelector('#peppol-errorSection');
        const resultContent = rootContainer.querySelector('#peppol-resultContent');
        const errorContent = rootContainer.querySelector('#peppol-errorContent');
        
        // State
        let currentXmlContent = '';
        let allRules = [];
        let filteredRules = [];
        let isDropdownOpen = false;
        
        // Setup event listeners
        function setupEventListeners() {
            // Input method change
            pasteMethod.addEventListener('change', handleInputMethodChange);
            fileMethod.addEventListener('change', handleInputMethodChange);
            
            // File input change
            fileInput.addEventListener('change', handleFileSelect);
            
            // Paste content change
            pasteContent.addEventListener('input', () => {
                currentXmlContent = pasteContent.value;
                updateLineNumbers();
                checkFormValidity();
            });
            
            // Sync scroll for line numbers
            pasteContent.addEventListener('scroll', () => {
                if (lineNumbers) {
                    lineNumbers.scrollTop = pasteContent.scrollTop;
                }
            });
            
            // Sync scroll between textarea and line numbers
            const textareaWrapper = rootContainer.querySelector('.peppol-textarea-wrapper');
            if (textareaWrapper) {
                textareaWrapper.addEventListener('scroll', () => {
                    if (lineNumbers) {
                        lineNumbers.scrollTop = textareaWrapper.scrollTop;
                    }
                });
            }
            
            // Custom dropdown trigger
            ruleSelectTrigger.addEventListener('click', toggleDropdown);
            
            // Rule search events
            ruleSearch.addEventListener('input', handleRuleSearch);
            ruleSearch.addEventListener('click', (e) => {
                e.stopPropagation();
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
            
            // Form submit
            submitBtn.addEventListener('click', handleFormSubmit);
            
            // Initialize line numbers
            updateLineNumbers();
        }
        
        // Update line numbers
        function updateLineNumbers() {
            if (!lineNumbers || !pasteContent) return;
            
            const lines = pasteContent.value.split('\n').length;
            const scrollTop = pasteContent.scrollTop;
            
            let lineNumbersHtml = '';
            for (let i = 1; i <= Math.max(lines, 15); i++) {
                lineNumbersHtml += `<div class="peppol-line-number">${i}</div>`;
            }
            lineNumbers.innerHTML = lineNumbersHtml;
            lineNumbers.scrollTop = scrollTop;
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
        }
        
        // Handle rule search
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
                ruleList.innerHTML = '<div class="peppol-rule-empty">No results found</div>';
                return;
            }
            
            rules.forEach(rule => {
                const item = document.createElement('div');
                item.className = `peppol-rule-item ${rule.deprecated ? 'deprecated' : ''} ${ruleSelect.value === rule.vesid ? 'selected' : ''}`;
                
                const readableName = rule.readableName || rule.name || rule.vesid;
                const vesid = rule.vesid;
                
                item.innerHTML = `
                    <div class="peppol-rule-item-name">${escapeHtml(readableName)}</div>
                    <div class="peppol-rule-item-vesid">${escapeHtml(vesid)}</div>
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
        
        // Handle input method change
        function handleInputMethodChange() {
            const pasteTab = rootContainer.querySelector('label[for="peppol-pasteMethod"]');
            const fileTab = rootContainer.querySelector('label[for="peppol-fileMethod"]');
            
            if (pasteMethod.checked) {
                pasteContentGroup.style.display = 'block';
                fileUploadGroup.style.display = 'none';
                if (pasteTab) pasteTab.classList.add('active');
                if (fileTab) fileTab.classList.remove('active');
            } else if (fileMethod.checked) {
                pasteContentGroup.style.display = 'none';
                fileUploadGroup.style.display = 'block';
                if (fileTab) fileTab.classList.add('active');
                if (pasteTab) pasteTab.classList.remove('active');
            }
            checkFormValidity();
        }
        
        // Handle file selection
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                fileText.textContent = file.name;
                fileText.style.color = '#6794f1';
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentXmlContent = e.target.result;
                    pasteContent.value = currentXmlContent;
                    checkFormValidity();
                };
                reader.onerror = function() {
                    showError('Failed to read file content');
                };
                reader.readAsText(file);
            } else {
                fileText.textContent = 'Select XML file';
                fileText.style.color = '#64748b';
                checkFormValidity();
            }
        }
        
        // Check form validity
        function checkFormValidity() {
            const isPasteMethod = pasteMethod.checked;
            const hasFile = fileInput.files.length > 0;
            const hasPasteContent = pasteContent.value.trim().length > 0;
            const hasRule = ruleSelect.value !== '';
            
            const hasInput = isPasteMethod ? hasPasteContent : hasFile;
            submitBtn.disabled = !(hasInput && hasRule);
        }
        
        // Load available rules
        async function loadRules() {
            try {
                const response = await fetch(`${API_BASE_URL}/list-rules`);
                if (!response.ok) {
                    throw new Error('Failed to load rules');
                }
                
                const data = await response.json();
                
                if (data.rules && data.rules.length > 0) {
                    allRules = data.rules;
                    // Apply initial filters (deprecated filter is checked by default)
                    applyFilters('');
                    ruleSearch.placeholder = `${allRules.length} rules available - Search...`;
                } else {
                    ruleList.innerHTML = '<div class="peppol-rule-empty">No rules found</div>';
                    showError('No rules found');
                }
            } catch (error) {
                console.error('Error loading rules:', error);
                ruleList.innerHTML = '<div class="peppol-rule-empty">Failed to load rules</div>';
                showError('An error occurred while loading rules: ' + error.message);
            }
        }
        
        // Handle form submission
        async function handleFormSubmit(event) {
            event.preventDefault();
            
            const rule = ruleSelect.value;
            const isPasteMethod = pasteMethod.checked;
            
            if (!rule) {
                showError('Please select a validation rule');
                ruleSelectTrigger.focus();
                return;
            }
            
            // Show loading state
            setLoadingState(true);
            hideResults();
            
            try {
                const formData = new FormData();
                formData.append('rule', rule);
                
                if (isPasteMethod) {
                    const pasteText = pasteContent.value.trim();
                    if (!pasteText) {
                        showError('Please paste XML content');
                        setLoadingState(false);
                        return;
                    }
                    
                    currentXmlContent = pasteText;
                    const blob = new Blob([pasteText], { type: 'application/xml' });
                    formData.append('file', blob, 'pasted-content.xml');
                } else {
                    const file = fileInput.files[0];
                    if (!file) {
                        showError('Please select an XML file');
                        setLoadingState(false);
                        return;
                    }
                    formData.append('file', file);
                }
                
                const response = await fetch(`${API_BASE_URL}/validate`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    const errorMessage = result.error || result.message || result.errorText || 'Validation error';
                    throw new Error(errorMessage);
                }
                
                if (result.error || result.errorText) {
                    const errorMessage = result.error || result.errorText || 'Validation error';
                    showError(errorMessage);
                    return;
                }
                
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
            const btnText = submitBtn.querySelector('.peppol-btn-text');
            const btnLoader = submitBtn.querySelector('.peppol-btn-loader');
            
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
                        } else if (level.includes('WARNING') || level.includes('WARN')) {
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
            
            let html = '';
            
            const summaryMessage = isSuccess 
                ? `The file <strong>${escapeHtml(fileName)}</strong> is valid. It contains <strong>${totalErrors}</strong> errors and <strong>${totalWarnings}</strong> warnings.`
                : `The file <strong>${escapeHtml(fileName)}</strong> is invalid. It contains <strong>${totalErrors}</strong> errors and <strong>${totalWarnings}</strong> warnings.`;
            
            html += `<div class="peppol-validation-summary-message ${isSuccess ? 'success' : 'error'}">${summaryMessage}</div>`;
            
            if (validationResults.length > 0) {
                html += '<div class="peppol-validation-summary-section">';
                html += '<h4 class="peppol-section-title">Summary</h4>';
                html += '<table class="peppol-validation-summary-table">';
                html += '<thead><tr><th>Validation type</th><th>Validation artifact</th><th>Warnings</th><th>Errors</th></tr></thead>';
                html += '<tbody>';
                
                validationResults.forEach(vr => {
                    const artifactType = formatArtifactType(vr.artifactType);
                    const artifactPath = escapeHtml(vr.artifactPath);
                    html += `<tr>
                        <td>${artifactType}</td>
                        <td>${artifactPath}</td>
                        <td class="peppol-count-cell ${vr.warnings > 0 ? 'has-warnings' : ''}">${vr.warnings}</td>
                        <td class="peppol-count-cell ${vr.errors > 0 ? 'has-errors' : ''}">${vr.errors}</td>
                    </tr>`;
                });
                
                html += '</tbody></table>';
                html += '</div>';
            }
            
            if (validationResults.length > 0) {
                html += '<div class="peppol-validation-details-section">';
                html += '<h4 class="peppol-section-title">Details</h4>';
                
                validationResults.forEach((vr) => {
                    const artifactType = formatArtifactType(vr.artifactType);
                    const artifactPath = escapeHtml(vr.artifactPath);
                    
                    html += `<div class="peppol-validation-detail-group">`;
                    html += `<h5 class="peppol-detail-group-title">${artifactType} - ${artifactPath}</h5>`;
                    
                    if (vr.items && vr.items.length > 0) {
                        vr.items.forEach(item => {
                            const itemClass = getItemClass(item);
                            const itemIcon = getItemIcon(item);
                            const errorText = item.errorText || item.message || item.text || '';
                            const errorLocation = item.errorLocation || item.errorLocationStr || '';
                            const errorField = item.errorFieldName || item.field || '';
                            const errorLevel = item.errorLevel || item.severity || '';
                            
                            html += `
                                <div class="peppol-validation-item ${itemClass}">
                                    <div class="peppol-validation-item-title">
                                        ${itemIcon} ${errorLevel ? escapeHtml(errorLevel) : 'Validation Item'}${errorField ? ' - ' + escapeHtml(errorField) : ''}
                                    </div>
                                    <div class="peppol-validation-item-message">
                                        ${escapeHtml(errorText)}
                                        ${errorLocation ? `<br><small style="color: #64748b;">Location: ${escapeHtml(errorLocation)}</small>` : ''}
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        html += '<div class="peppol-validation-item success">';
                        html += '<div class="peppol-validation-item-message">All fine on this level</div>';
                        html += '</div>';
                    }
                    
                    html += `</div>`;
                });
                
                html += '</div>';
            }
            
            html += `
                <div class="peppol-action-buttons">
                    <button class="peppol-action-btn toggle-json" id="peppol-toggleJsonBtn">
                        <span class="peppol-btn-icon">📄</span>
                        <span>Show/Hide JSON Result</span>
                    </button>
                    <div class="peppol-download-buttons">
                        <button class="peppol-action-btn download-btn" id="peppol-downloadJsonBtn">
                            <span class="peppol-btn-icon">⬇️</span>
                            <span>Download JSON Result</span>
                        </button>
                        <button class="peppol-action-btn download-btn" id="peppol-downloadXmlBtn">
                            <span class="peppol-btn-icon">⬇️</span>
                            <span>Download XML File</span>
                        </button>
                    </div>
                </div>
                <div id="peppol-jsonViewer" class="peppol-json-viewer" style="display: none;">
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                </div>
            `;
            
            resultContent.innerHTML = html;
            
            // Attach event listeners to buttons
            const toggleJsonBtn = rootContainer.querySelector('#peppol-toggleJsonBtn');
            const downloadJsonBtn = rootContainer.querySelector('#peppol-downloadJsonBtn');
            const downloadXmlBtn = rootContainer.querySelector('#peppol-downloadXmlBtn');
            
            if (toggleJsonBtn) {
                toggleJsonBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const jsonViewer = rootContainer.querySelector('#peppol-jsonViewer');
                    if (jsonViewer) {
                        jsonViewer.style.display = jsonViewer.style.display === 'none' ? 'block' : 'none';
                    }
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
            
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Format artifact type
        function formatArtifactType(type) {
            if (!type) return 'Unknown';
            
            const typeUpper = type.toUpperCase();
            
            if (typeUpper.includes('SCHEMATRON') || typeUpper.includes('SCH')) {
                if (type.includes('ISO') && (type.includes('XSLT2') || type.includes('XSLT 2') || type.includes('XSLT-2'))) {
                    return 'Schematron (ISO XSLT2)';
                }
                if (typeUpper.includes('ISO')) {
                    return 'Schematron (ISO)';
                }
                return 'Schematron';
            }
            
            if (typeUpper.includes('SCHEMA') || typeUpper.includes('XSD') || typeUpper.includes('XSDSCHEMA')) {
                return 'XML Schema';
            }
            
            if (typeUpper.includes('XML') && (typeUpper.includes('SYNTAX') || typeUpper.includes('PARSER'))) {
                return 'XML Syntax';
            }
            
            if (typeUpper.includes('XML') && !typeUpper.includes('SCHEMA') && !typeUpper.includes('SCHEMATRON')) {
                return 'XML Syntax';
            }
            
            return type.split(/[-_\s]+/).map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        }
        
        // Get item class
        function getItemClass(item) {
            const level = (item.errorLevel || item.severity || '').toUpperCase();
            if (level.includes('ERROR') || level === 'ERROR') {
                return 'error';
            } else if (level.includes('WARNING') || level.includes('WARN')) {
                return 'warning';
            }
            return 'success';
        }
        
        // Get item icon
        function getItemIcon(item) {
            const level = (item.errorLevel || item.severity || '').toUpperCase();
            if (level.includes('ERROR') || level === 'ERROR') {
                return '❌';
            } else if (level.includes('WARNING') || level.includes('WARN')) {
                return '⚠️';
            }
            return '✅';
        }
        
        // Show error message
        function showError(message) {
            resultSection.style.display = 'none';
            errorSection.style.display = 'block';
            errorContent.innerHTML = `
                <div class="peppol-validation-item error">
                    <div class="peppol-validation-item-title">❌ Error</div>
                    <div class="peppol-validation-item-message">${escapeHtml(message)}</div>
                </div>
            `;
            
            errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Hide results
        function hideResults() {
            resultSection.style.display = 'none';
            errorSection.style.display = 'none';
        }
        
        // Escape HTML
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
        
        // Initialize
        setupEventListeners();
        loadRules();
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initValidator);
    } else {
        initValidator();
    }
})();

