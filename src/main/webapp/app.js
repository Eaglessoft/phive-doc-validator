(() => {
    'use strict';

    class ValidatorApp {
        constructor() {
            this.dom = this.cacheDom();
            this.state = {
                allRules: [],
                filteredRules: [],
                isDropdownOpen: false,
                pasteContentValue: '',
                uploadedFileName: '',
                uploadedFile: null,
                currentXmlContent: '',
                lastRenderedLineCount: 0
            };
            this.ruleSearchDebounceTimer = null;
        }

        init() {
            this.setupEventListeners();
            this.updateLineNumbers();
            this.loadRules();
        }

        cacheDom() {
            return {
                fileInput: document.getElementById('fileInput'),
                fileText: document.getElementById('fileText'),
                pasteContent: document.getElementById('pasteContent'),
                pasteMethod: document.getElementById('pasteMethod'),
                fileMethod: document.getElementById('fileMethod'),
                pasteContentGroup: document.getElementById('pasteContentGroup'),
                fileUploadGroup: document.getElementById('fileUploadGroup'),
                ruleSelectTrigger: document.getElementById('ruleSelectTrigger'),
                ruleSelectText: document.getElementById('ruleSelectText'),
                ruleSearch: document.getElementById('ruleSearch'),
                ruleSelect: document.getElementById('ruleSelect'),
                ruleDropdown: document.getElementById('ruleDropdown'),
                ruleList: document.getElementById('ruleList'),
                hideDeprecatedRules: document.getElementById('hideDeprecatedRules'),
                submitBtn: document.getElementById('submitBtn'),
                validationForm: document.getElementById('validationForm'),
                resultSection: document.getElementById('resultSection'),
                errorSection: document.getElementById('errorSection'),
                resultContent: document.getElementById('resultContent'),
                errorContent: document.getElementById('errorContent'),
                lineNumbers: document.getElementById('lineNumbers'),
                textareaWrapper: document.querySelector('.textarea-wrapper'),
                footer: document.querySelector('footer')
            };
        }

        setupEventListeners() {
            const {
                fileInput,
                pasteContent,
                textareaWrapper,
                pasteMethod,
                fileMethod,
                validationForm,
                ruleSelectTrigger,
                ruleSearch,
                hideDeprecatedRules,
                ruleDropdown
            } = this.dom;

            if (fileInput) {
                fileInput.addEventListener('change', (event) => this.handleFileSelect(event));
            }

            if (pasteContent) {
                pasteContent.addEventListener('input', () => this.handlePasteContentChange());
            }

            if (textareaWrapper) {
                textareaWrapper.addEventListener('scroll', () => {
                    if (this.dom.lineNumbers) {
                        this.dom.lineNumbers.scrollTop = textareaWrapper.scrollTop;
                    }
                });
            }

            if (pasteMethod) {
                pasteMethod.addEventListener('change', () => this.handleInputMethodChange());
            }

            if (fileMethod) {
                fileMethod.addEventListener('change', () => this.handleInputMethodChange());
            }

            if (validationForm) {
                validationForm.addEventListener('submit', (event) => this.handleFormSubmit(event));
            }

            if (ruleSelectTrigger) {
                ruleSelectTrigger.addEventListener('click', () => this.toggleDropdown());
            }

            if (ruleSearch) {
                ruleSearch.addEventListener('input', (event) => this.handleRuleSearch(event));
                ruleSearch.addEventListener('click', (event) => event.stopPropagation());
            }

            if (hideDeprecatedRules) {
                hideDeprecatedRules.addEventListener('change', () => this.handleDeprecatedFilterChange());
            }

            document.addEventListener('click', (event) => {
                const trigger = this.dom.ruleSelectTrigger;
                const dropdown = this.dom.ruleDropdown;
                if (!trigger || !dropdown) {
                    return;
                }
                if (!trigger.contains(event.target) && !dropdown.contains(event.target)) {
                    this.closeDropdown();
                }
            });

            if (ruleDropdown) {
                ruleDropdown.addEventListener('click', (event) => event.stopPropagation());
            }

            if (this.dom.ruleList) {
                this.dom.ruleList.addEventListener('click', (event) => this.handleRuleListClick(event));
            }
        }

        handleFileSelect(event) {
            const file = event.target.files[0];

            if (file) {
                this.state.uploadedFileName = file.name;
                this.state.uploadedFile = file;

                if (this.dom.fileText) {
                    this.dom.fileText.textContent = file.name;
                    this.dom.fileText.style.color = '#6794f1';
                }

                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    const content = loadEvent.target.result;
                    this.state.pasteContentValue = content;
                    this.state.currentXmlContent = content;
                    if (this.dom.pasteContent) {
                        this.dom.pasteContent.value = content;
                    }
                    if (this.dom.pasteMethod && this.dom.pasteMethod.checked) {
                        this.updateLineNumbers();
                    }
                    this.checkFormValidity();
                };
                reader.onerror = () => {
                    this.showError('Failed to read file content');
                };
                reader.readAsText(file);
                return;
            }

            this.state.uploadedFileName = '';
            this.state.uploadedFile = null;
            if (this.dom.fileText) {
                this.dom.fileText.textContent = 'Select XML file';
                this.dom.fileText.style.color = '#64748b';
            }
            this.checkFormValidity();
        }

        handlePasteContentChange() {
            const content = this.dom.pasteContent ? this.dom.pasteContent.value : '';
            this.state.pasteContentValue = content;
            this.updateLineNumbers();
            this.checkFormValidity();
        }

        ensureFileInputEnabled() {
            if (this.dom.fileInput) {
                this.dom.fileInput.disabled = false;
                this.dom.fileInput.removeAttribute('disabled');
            }
        }

        handleInputMethodChange() {
            const pasteTab = document.querySelector('label[for="pasteMethod"]');
            const fileTab = document.querySelector('label[for="fileMethod"]');

            if (this.dom.pasteMethod && this.dom.pasteMethod.checked) {
                if (this.dom.pasteContentGroup) {
                    this.dom.pasteContentGroup.style.display = 'block';
                }
                if (this.dom.fileUploadGroup) {
                    this.dom.fileUploadGroup.style.display = 'none';
                }
                if (this.dom.pasteContent) {
                    this.dom.pasteContent.value = this.state.pasteContentValue;
                }
                this.updateLineNumbers();
                if (pasteTab) {
                    pasteTab.classList.add('active');
                }
                if (fileTab) {
                    fileTab.classList.remove('active');
                }
            } else if (this.dom.fileMethod && this.dom.fileMethod.checked) {
                if (this.dom.pasteContentGroup) {
                    this.dom.pasteContentGroup.style.display = 'none';
                }
                if (this.dom.fileUploadGroup) {
                    this.dom.fileUploadGroup.style.display = 'block';
                }

                if (this.dom.fileText) {
                    if (this.state.uploadedFileName) {
                        this.dom.fileText.textContent = this.state.uploadedFileName;
                        this.dom.fileText.style.color = '#6794f1';
                    } else {
                        this.dom.fileText.textContent = 'Select XML file';
                        this.dom.fileText.style.color = '#64748b';
                    }
                }

                this.ensureFileInputEnabled();
                if (fileTab) {
                    fileTab.classList.add('active');
                }
                if (pasteTab) {
                    pasteTab.classList.remove('active');
                }
            }

            this.checkFormValidity();
        }

        updateLineNumbers() {
            const textarea = this.dom.pasteContent;
            const lineNumbers = this.dom.lineNumbers;

            if (!textarea || !lineNumbers) {
                return;
            }

            const lines = textarea.value.split('\n').length;
            const scrollTop = textarea.scrollTop;
            const targetLineCount = Math.max(lines, 15);

            if (this.state.lastRenderedLineCount !== targetLineCount) {
                let lineNumbersHtml = '';
                for (let i = 1; i <= targetLineCount; i++) {
                    lineNumbersHtml += `<div class="line-number">${i}</div>`;
                }
                lineNumbers.innerHTML = lineNumbersHtml;
                this.state.lastRenderedLineCount = targetLineCount;
            }
            lineNumbers.scrollTop = scrollTop;
        }

        checkFormValidity() {
            const isPasteMethod = this.dom.pasteMethod ? this.dom.pasteMethod.checked : false;
            const hasFile = this.dom.fileInput ? this.dom.fileInput.files.length > 0 : false;
            const hasPasteContent = this.dom.pasteContent ? this.dom.pasteContent.value.trim().length > 0 : false;
            const hasRule = this.dom.ruleSelect ? this.dom.ruleSelect.value !== '' : false;
            const hasInput = isPasteMethod ? hasPasteContent : hasFile;

            if (this.dom.submitBtn) {
                this.dom.submitBtn.disabled = !(hasInput && hasRule);
            }
        }

        toggleDropdown() {
            if (this.state.isDropdownOpen) {
                this.closeDropdown();
                return;
            }
            this.openDropdown();
        }

        openDropdown() {
            this.state.isDropdownOpen = true;

            if (this.dom.ruleSelectTrigger) {
                this.dom.ruleSelectTrigger.classList.add('active');
            }
            if (this.dom.ruleDropdown) {
                this.dom.ruleDropdown.style.display = 'flex';
            }
            if (this.dom.ruleSearch) {
                this.dom.ruleSearch.focus();
            }
            if (this.dom.footer) {
                this.dom.footer.style.display = 'none';
            }

            if (this.state.allRules.length > 0 && this.dom.ruleSearch) {
                const searchTerm = this.dom.ruleSearch.value.toLowerCase().trim();
                this.applyFilters(searchTerm);
            }
        }

        closeDropdown() {
            this.state.isDropdownOpen = false;

            if (this.dom.ruleSelectTrigger) {
                this.dom.ruleSelectTrigger.classList.remove('active');
            }
            if (this.dom.ruleDropdown) {
                this.dom.ruleDropdown.style.display = 'none';
            }
            if (this.dom.ruleSearch) {
                this.dom.ruleSearch.value = '';
            }
            if (this.dom.footer) {
                this.dom.footer.style.display = 'block';
            }
        }

        async loadRules() {
            try {
                const response = await fetch('list-rules');
                if (!response.ok) {
                    throw new Error('Failed to load rules');
                }

                const data = await response.json();

                if (data.rules && data.rules.length > 0) {
                    this.state.allRules = data.rules;
                    this.applyFilters('');
                    if (this.dom.ruleSearch) {
                        this.dom.ruleSearch.placeholder = `${this.state.allRules.length} rules available - Search...`;
                    }
                    return;
                }

                if (this.dom.ruleList) {
                    this.dom.ruleList.innerHTML = '<div class="rule-empty">No rules found</div>';
                }
                this.showError('No rules found');
            } catch (error) {
                console.error('Error loading rules:', error);
                if (this.dom.ruleList) {
                    this.dom.ruleList.innerHTML = '<div class="rule-empty">Failed to load rules</div>';
                }
                this.showError('An error occurred while loading rules: ' + error.message);
            }
        }

        handleRuleSearch(event) {
            const searchTerm = event.target.value.toLowerCase().trim();
            clearTimeout(this.ruleSearchDebounceTimer);
            this.ruleSearchDebounceTimer = setTimeout(() => {
                this.applyFilters(searchTerm);
            }, 180);
        }

        handleDeprecatedFilterChange() {
            clearTimeout(this.ruleSearchDebounceTimer);
            const searchTerm = this.dom.ruleSearch ? this.dom.ruleSearch.value.toLowerCase().trim() : '';
            this.applyFilters(searchTerm);
        }

        applyFilters(searchTerm) {
            let rules = [...this.state.allRules];

            if (searchTerm !== '') {
                rules = rules.filter((rule) => {
                    const readableName = (rule.readableName || rule.name || rule.vesid || '').toLowerCase();
                    const vesid = (rule.vesid || '').toLowerCase();
                    return readableName.includes(searchTerm) || vesid.includes(searchTerm);
                });
            }

            if (this.dom.hideDeprecatedRules && this.dom.hideDeprecatedRules.checked) {
                rules = rules.filter((rule) => !rule.deprecated);
            }

            this.state.filteredRules = rules;
            this.renderRuleList(rules);
        }

        renderRuleList(rules) {
            if (!this.dom.ruleList) {
                return;
            }

            this.dom.ruleList.innerHTML = '';

            if (rules.length === 0) {
                this.dom.ruleList.innerHTML = '<div class="rule-empty">No results found</div>';
                return;
            }

            const selectedRuleValue = this.dom.ruleSelect ? this.dom.ruleSelect.value : '';
            const fragment = document.createDocumentFragment();

            rules.forEach((rule) => {
                const item = document.createElement('div');
                item.className = `rule-item ${rule.deprecated ? 'deprecated' : ''} ${selectedRuleValue === rule.vesid ? 'selected' : ''}`;
                item.dataset.vesid = rule.vesid;

                const readableName = rule.readableName || rule.name || rule.vesid;
                const vesid = rule.vesid;

                item.innerHTML = `
                    <div class="rule-item-name">${this.escapeHtml(readableName)}</div>
                    <div class="rule-item-vesid">${this.escapeHtml(vesid)}</div>
                `;

                fragment.appendChild(item);
            });

            this.dom.ruleList.appendChild(fragment);
        }

        handleRuleListClick(event) {
            const item = event.target.closest('.rule-item');
            if (!item || !this.dom.ruleList || !this.dom.ruleList.contains(item)) {
                return;
            }

            const vesid = item.dataset.vesid;
            if (!vesid) {
                return;
            }

            const rule = this.state.filteredRules.find((candidate) => candidate.vesid === vesid) ||
                this.state.allRules.find((candidate) => candidate.vesid === vesid);
            if (rule) {
                this.selectRule(rule);
            }
        }

        selectRule(rule) {
            const readableName = rule.readableName || rule.name || rule.vesid;

            if (this.dom.ruleSelect) {
                this.dom.ruleSelect.value = rule.vesid;
            }
            if (this.dom.ruleSelectText) {
                this.dom.ruleSelectText.textContent = readableName;
            }

            this.closeDropdown();
            this.checkFormValidity();
        }

        async handleFormSubmit(event) {
            event.preventDefault();

            const rule = this.dom.ruleSelect ? this.dom.ruleSelect.value : '';
            const isPasteMethod = this.dom.pasteMethod ? this.dom.pasteMethod.checked : false;

            if (!rule) {
                this.showError('Please select a validation rule');
                if (this.dom.ruleSelect) {
                    this.dom.ruleSelect.focus();
                }
                return;
            }

            this.setLoadingState(true);
            this.hideResults();

            try {
                const formData = new FormData();
                formData.append('rule', rule);

                if (isPasteMethod) {
                    const pasteText = this.dom.pasteContent ? this.dom.pasteContent.value.trim() : '';
                    if (!pasteText) {
                        this.showError('Please paste XML content');
                        this.setLoadingState(false);
                        return;
                    }

                    this.state.currentXmlContent = pasteText;
                    const blob = new Blob([pasteText], { type: 'application/xml' });
                    formData.append('file', blob, 'pasted-content.xml');
                    formData.append('isPasteContent', 'true');
                } else {
                    const pasteText = this.dom.pasteContent ? this.dom.pasteContent.value.trim() : '';

                    if (pasteText && this.state.uploadedFile) {
                        this.state.currentXmlContent = pasteText;
                        const blob = new Blob([pasteText], { type: 'application/xml' });
                        const fileName = this.state.uploadedFileName || 'uploaded-file.xml';
                        formData.append('file', blob, fileName);
                    } else {
                        const file = this.dom.fileInput ? this.dom.fileInput.files[0] : null;
                        if (!file) {
                            this.showError('Please select an XML file');
                            this.setLoadingState(false);
                            return;
                        }

                        if (!this.state.currentXmlContent) {
                            const reader = new FileReader();
                            reader.onload = (loadEvent) => {
                                this.state.currentXmlContent = loadEvent.target.result;
                            };
                            reader.readAsText(file);
                        }

                        formData.append('file', file);
                    }
                }

                const response = await fetch('validate', {
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
                    this.showError(errorMessage);
                    return;
                }

                this.displayResults(result);
            } catch (error) {
                console.error('Validation error:', error);
                this.showError('An error occurred during validation: ' + error.message);
            } finally {
                this.setLoadingState(false);
            }
        }

        setLoadingState(loading) {
            if (!this.dom.submitBtn) {
                return;
            }

            const btnText = this.dom.submitBtn.querySelector('.btn-text');
            const btnLoader = this.dom.submitBtn.querySelector('.btn-loader');

            if (loading) {
                this.dom.submitBtn.disabled = true;
                if (btnText) {
                    btnText.textContent = 'Validating...';
                }
                if (btnLoader) {
                    btnLoader.style.display = 'inline-block';
                }
            } else {
                this.dom.submitBtn.disabled = false;
                if (btnText) {
                    btnText.textContent = 'Validate';
                }
                if (btnLoader) {
                    btnLoader.style.display = 'none';
                }
                this.checkFormValidity();
            }
        }

        displayResults(result) {
            if (!this.dom.resultSection || !this.dom.errorSection || !this.dom.resultContent) {
                return;
            }

            this.dom.errorSection.style.display = 'none';
            this.dom.resultSection.style.display = 'block';

            const isSuccess = result.success === true;
            const fileName = result.fileName || 'Unknown file';

            let totalErrors = 0;
            let totalWarnings = 0;
            const validationResults = [];

            if (result.results && Array.isArray(result.results)) {
                result.results.forEach((resultItem) => {
                    const items = resultItem.items || [];
                    let errors = 0;
                    let warnings = 0;
                    const itemViews = [];

                    items.forEach((item) => {
                        const severity = this.getSeverityMeta(item);
                        if (severity.isError) {
                            errors += 1;
                            totalErrors += 1;
                        } else if (severity.isWarning) {
                            warnings += 1;
                            totalWarnings += 1;
                        }

                        itemViews.push({
                            itemClass: severity.className,
                            itemIcon: severity.icon,
                            errorText: item.errorText || item.message || item.text || '',
                            errorLocation: item.errorLocation || item.errorLocationStr || '',
                            errorField: item.errorFieldName || item.field || '',
                            errorLevel: item.errorLevel || item.severity || ''
                        });
                    });

                    validationResults.push({
                        artifactType: resultItem.artifactType || 'Unknown',
                        artifactTypeLabel: this.formatArtifactType(resultItem.artifactType || 'Unknown'),
                        artifactPath: resultItem.artifactPath || '',
                        success: resultItem.success,
                        items,
                        itemViews,
                        errors,
                        warnings
                    });
                });
            }

            let html = '';

            const summaryMessage = isSuccess
                ? `The file <strong>${this.escapeHtml(fileName)}</strong> is valid. It contains <strong>${totalErrors}</strong> errors and <strong>${totalWarnings}</strong> warnings.`
                : `The file <strong>${this.escapeHtml(fileName)}</strong> is invalid. It contains <strong>${totalErrors}</strong> errors and <strong>${totalWarnings}</strong> warnings.`;

            html += `<div class="validation-summary-message ${isSuccess ? 'success' : 'error'}">${summaryMessage}</div>`;

            if (validationResults.length > 0) {
                html += '<div class="validation-summary-section">';
                html += '<h3 class="section-title">Summary</h3>';
                html += '<table class="validation-summary-table">';
                html += '<thead><tr><th>Validation type</th><th>Validation artifact</th><th>Warnings</th><th>Errors</th></tr></thead>';
                html += '<tbody>';

                validationResults.forEach((validationResult) => {
                    const artifactPath = this.escapeHtml(validationResult.artifactPath);
                    html += `<tr>
                        <td>${validationResult.artifactTypeLabel}</td>
                        <td>${artifactPath}</td>
                        <td class="count-cell ${validationResult.warnings > 0 ? 'has-warnings' : ''}">${validationResult.warnings}</td>
                        <td class="count-cell ${validationResult.errors > 0 ? 'has-errors' : ''}">${validationResult.errors}</td>
                    </tr>`;
                });

                html += '</tbody></table>';
                html += '</div>';
            }

            if (validationResults.length > 0) {
                html += '<div class="validation-details-section">';
                html += '<h3 class="section-title">Details</h3>';

                validationResults.forEach((validationResult, index) => {
                    const artifactPath = this.escapeHtml(validationResult.artifactPath);

                    html += '<div class="validation-detail-group">';
                    html += `<h4 class="detail-group-title">${validationResult.artifactTypeLabel} - ${artifactPath}</h4>`;

                    if (validationResult.itemViews && validationResult.itemViews.length > 0) {
                        validationResult.itemViews.forEach((itemView) => {
                            const { itemClass, itemIcon, errorText, errorLocation, errorField, errorLevel } = itemView;

                            html += `
                                <div class="validation-item ${itemClass}">
                                    <div class="validation-item-title">
                                        ${itemIcon} ${errorLevel ? this.escapeHtml(errorLevel) : 'Validation Item'}${errorField ? ' - ' + this.escapeHtml(errorField) : ''}
                                    </div>
                                    <div class="validation-item-message">
                                        ${this.escapeHtml(errorText)}
                                        ${errorLocation ? `<br><small style="color: var(--text-secondary);">Location: ${this.escapeHtml(errorLocation)}</small>` : ''}
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        const hasPreviousErrors = validationResults.slice(0, index).some((prevResult) => {
                            const prevArtifactType = (prevResult.artifactType || '').toUpperCase();
                            return (prevArtifactType.includes('SCHEMA') || prevArtifactType.includes('XSD')) && prevResult.errors > 0;
                        });

                        if (hasPreviousErrors) {
                            html += '<div class="validation-item skipped">';
                            html += '<div class="validation-item-message">⏭️ Skipped (previous validation failed)</div>';
                            html += '</div>';
                        } else {
                            html += '<div class="validation-item success">';
                            html += '<div class="validation-item-message">All fine on this level</div>';
                            html += '</div>';
                        }
                    }

                    html += '</div>';
                });

                html += '</div>';
            }

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
                    <pre id="jsonViewerContent"></pre>
                </div>
            `;

            this.dom.resultContent.innerHTML = html;

            const jsonViewerContent = this.dom.resultContent.querySelector('#jsonViewerContent');
            if (jsonViewerContent) {
                jsonViewerContent.textContent = JSON.stringify(result, null, 2);
            }

            const toggleJsonBtn = this.dom.resultContent.querySelector('#toggleJsonBtn');
            const downloadJsonBtn = this.dom.resultContent.querySelector('#downloadJsonBtn');
            const downloadXmlBtn = this.dom.resultContent.querySelector('#downloadXmlBtn');

            if (toggleJsonBtn) {
                toggleJsonBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.toggleJsonViewer();
                };
            }

            if (downloadJsonBtn) {
                downloadJsonBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.downloadJsonResult(result, fileName);
                };
            }

            if (downloadXmlBtn) {
                downloadXmlBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.downloadXmlFile(fileName);
                };
            }

            this.dom.resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        formatArtifactType(type) {
            if (!type) {
                return 'Unknown';
            }

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

            return type
                .split(/[-_\s]+/)
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

        getSeverityMeta(item) {
            const level = (item.errorLevel || item.severity || '').toUpperCase();
            if (level.includes('ERROR') || level === 'ERROR') {
                return { className: 'error', icon: '❌', isError: true, isWarning: false };
            }
            if (level.includes('WARNING') || level === 'WARNING' || level.includes('WARN')) {
                return { className: 'warning', icon: '⚠️', isError: false, isWarning: true };
            }
            return { className: 'success', icon: '✅', isError: false, isWarning: false };
        }

        getItemClass(item) {
            return this.getSeverityMeta(item).className;
        }

        getItemIcon(item) {
            return this.getSeverityMeta(item).icon;
        }

        showError(message) {
            if (!this.dom.resultSection || !this.dom.errorSection || !this.dom.errorContent) {
                return;
            }

            this.dom.resultSection.style.display = 'none';
            this.dom.errorSection.style.display = 'block';
            this.dom.errorContent.innerHTML = `
                <div class="validation-item error">
                    <div class="validation-item-title">❌ Error</div>
                    <div class="validation-item-message">${this.escapeHtml(message)}</div>
                </div>
            `;

            this.dom.errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        hideResults() {
            if (this.dom.resultSection) {
                this.dom.resultSection.style.display = 'none';
            }
            if (this.dom.errorSection) {
                this.dom.errorSection.style.display = 'none';
            }
        }

        toggleJsonViewer() {
            const jsonViewer = this.dom.resultContent ? this.dom.resultContent.querySelector('#jsonViewer') : null;
            if (!jsonViewer) {
                return;
            }
            jsonViewer.style.display = jsonViewer.style.display === 'none' ? 'block' : 'none';
        }

        escapeHtml(text) {
            if (text == null) {
                return '';
            }
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        downloadJsonResult(result, fileName) {
            try {
                const jsonString = JSON.stringify(result, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const baseFileName = fileName ? fileName.replace(/\.xml$/i, '') : 'validation_result';
                link.download = `${baseFileName}_validation_result.json`;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (error) {
                console.error('Error downloading JSON:', error);
                this.showError('Failed to download JSON result: ' + error.message);
            }
        }

        downloadXmlFile(fileName) {
            try {
                if (!this.state.currentXmlContent) {
                    this.showError('No XML content available to download');
                    return;
                }

                const blob = new Blob([this.state.currentXmlContent], { type: 'application/xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName || 'document.xml';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (error) {
                console.error('Error downloading XML:', error);
                this.showError('Failed to download XML file: ' + error.message);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const app = new ValidatorApp();
        app.init();
    });
})();
