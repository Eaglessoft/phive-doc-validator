(function () {
    'use strict';

    const DEFAULT_API_BASE_URL = 'https://tools.docnaut.com/peppol-e-invoice-xml-document-validator';
    const SEARCH_DEBOUNCE_MS = 180;
    const REQUEST_TIMEOUT_MS = 15000;
    const DEFAULT_CSS_URL = 'https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css';
    const ROOT_CLASS = 'peppol-e-invoice-xml-document-validator';

    function getCurrentScript() {
        return document.currentScript || (function () {
            const scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1];
        })();
    }

    function normalizeApiBaseUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        if (!trimmed) return '';
        return trimmed.replace(/\/+$/, '');
    }

    function resolveScriptApiBaseUrl() {
        const script = getCurrentScript();
        return normalizeApiBaseUrl(script && script.getAttribute('data-api-url'));
    }

    function toBoolean(value, fallback) {
        if (value == null) return fallback;
        const v = String(value).trim().toLowerCase();
        if (v === '1' || v === 'true' || v === 'yes') return true;
        if (v === '0' || v === 'false' || v === 'no') return false;
        return fallback;
    }

    function resolveCssUrl() {
        const script = getCurrentScript();
        if (script) {
            const explicit = script.getAttribute('data-css-url');
            if (explicit && explicit.trim()) {
                return explicit.trim();
            }
            const src = script.getAttribute('src');
            if (src) {
                try {
                    return new URL('embed.css', src).toString();
                } catch (e) {
                    // fallback below
                }
            }
        }
        return DEFAULT_CSS_URL;
    }

    function ensureCssLoaded(autoCssEnabled) {
        if (!autoCssEnabled) return;

        const existingManaged = document.querySelector('link[data-peppol-embed-css="true"]');
        if (existingManaged) return;

        const hasAnyEmbedCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some((link) => (link.getAttribute('href') || '').includes('/embed.css'));
        if (hasAnyEmbedCss) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = resolveCssUrl();
        link.setAttribute('data-peppol-embed-css', 'true');
        (document.head || document.documentElement).appendChild(link);
    }

    function debounce(fn, delayMs) {
        let timer = null;
        return function debounced() {
            const args = arguments;
            const ctx = this;
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(ctx, args), delayMs);
        };
    }

    function requestJson(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        return fetch(url, { ...(options || {}), signal: controller.signal })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const message = data.error || data.message || data.errorText || `Request failed (${response.status})`;
                    throw new Error(message);
                }
                return data;
            })
            .catch((error) => {
                if (error && error.name === 'AbortError') {
                    throw new Error('Request timed out');
                }
                throw error;
            })
            .finally(() => clearTimeout(timeoutId));
    }

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function createEl(tag, config, children) {
        const node = document.createElement(tag);
        const cfg = config || {};

        if (cfg.className) node.className = cfg.className;
        if (cfg.text != null) node.textContent = cfg.text;
        if (cfg.html != null) node.innerHTML = cfg.html;
        if (cfg.attrs) {
            Object.keys(cfg.attrs).forEach((key) => {
                const value = cfg.attrs[key];
                if (value != null) node.setAttribute(key, String(value));
            });
        }
        if (cfg.props) {
            Object.keys(cfg.props).forEach((key) => {
                node[key] = cfg.props[key];
            });
        }

        (children || []).forEach((child) => {
            if (child == null) return;
            node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });

        return node;
    }

    class PeppolValidatorApp {
        constructor(rootContainer, apiBaseUrl) {
            this.root = rootContainer;
            this.apiBaseUrl = apiBaseUrl;

            this.currentXmlContent = '';
            this.allRules = [];
            this.filteredRules = [];
            this.isDropdownOpen = false;

            this.refs = {};
        }

        mount() {
            this.root.classList.add(ROOT_CLASS);
            this.root.innerHTML = '';
            this.buildLayout();
            this.bindEvents();
            this.updateLineNumbers();
            this.loadRules();
        }

        buildLayout() {
            const header = createEl('div', { className: 'peppol-header' }, [
                createEl('div', { className: 'peppol-header-content' }, [
                    createEl('h1', { className: 'peppol-main-title', text: 'Peppol e-document Validator' }),
                    createEl('p', {
                        className: 'peppol-subtitle',
                        text: 'Validate your XML documents according to Peppol and EN16931 standards'
                    })
                ])
            ]);

            const fileMethodInput = createEl('input', {
                attrs: { type: 'radio', name: 'peppol-inputMethod', value: 'file', id: 'peppol-fileMethod' }
            });
            const pasteMethodInput = createEl('input', {
                attrs: { type: 'radio', name: 'peppol-inputMethod', value: 'paste', id: 'peppol-pasteMethod', checked: 'checked' }
            });

            const methodSelector = createEl('div', { className: 'peppol-input-method-selector' }, [
                createEl('label', { className: 'peppol-method-tab', attrs: { for: 'peppol-fileMethod' } }, [
                    fileMethodInput,
                    createEl('span', { className: 'peppol-method-tab-content' }, [
                        createEl('span', { className: 'peppol-method-icon', text: '📤' }),
                        createEl('span', { className: 'peppol-method-text', text: 'Upload File' })
                    ])
                ]),
                createEl('label', { className: 'peppol-method-tab active', attrs: { for: 'peppol-pasteMethod' } }, [
                    pasteMethodInput,
                    createEl('span', { className: 'peppol-method-tab-content' }, [
                        createEl('span', { className: 'peppol-method-icon', text: '📋' }),
                        createEl('span', { className: 'peppol-method-text', text: 'Paste Content' })
                    ])
                ])
            ]);

            const pasteContent = createEl('textarea', {
                className: 'peppol-textarea',
                attrs: {
                    id: 'peppol-pasteContent',
                    rows: '15',
                    placeholder: 'Paste your XML content here...'
                }
            });

            const pasteGroup = createEl('div', { className: 'peppol-form-group', attrs: { id: 'peppol-pasteContentGroup' } }, [
                createEl('div', { className: 'peppol-textarea-wrapper' }, [
                    createEl('div', { className: 'peppol-line-numbers', attrs: { id: 'peppol-lineNumbers' } }),
                    pasteContent
                ])
            ]);

            const fileInput = createEl('input', {
                attrs: { type: 'file', id: 'peppol-fileInput', accept: '.xml' }
            });

            const fileGroup = createEl('div', {
                className: 'peppol-form-group',
                attrs: { id: 'peppol-fileUploadGroup' },
                props: { style: 'display: none;' }
            }, [
                createEl('label', { className: 'peppol-file-label', attrs: { for: 'peppol-fileInput' } }, [
                    createEl('span', { className: 'peppol-file-icon', text: '📄' }),
                    createEl('span', { className: 'peppol-file-text', text: 'Select XML file', attrs: { id: 'peppol-fileText' } }),
                    fileInput
                ])
            ]);

            const ruleSearch = createEl('input', {
                attrs: {
                    type: 'text',
                    id: 'peppol-ruleSearch',
                    placeholder: 'Search rules...',
                    autocomplete: 'off'
                }
            });

            const ruleGroup = createEl('div', { className: 'peppol-form-group' }, [
                createEl('label', { text: 'Validation Rule:', attrs: { for: 'peppol-ruleSelect' } }),
                createEl('div', { className: 'peppol-custom-select-wrapper' }, [
                    createEl('div', { className: 'peppol-custom-select-trigger', attrs: { id: 'peppol-ruleSelectTrigger' } }, [
                        createEl('span', { text: 'Select a rule...', attrs: { id: 'peppol-ruleSelectText' } }),
                        createEl('span', { className: 'peppol-select-arrow', text: '▼' })
                    ]),
                    createEl('div', {
                        className: 'peppol-custom-select-dropdown',
                        attrs: { id: 'peppol-ruleDropdown' },
                        props: { style: 'display: none;' }
                    }, [
                        createEl('div', { className: 'peppol-rule-search-in-dropdown' }, [
                            ruleSearch,
                            createEl('span', { className: 'peppol-search-icon', text: '🔍' })
                        ]),
                        createEl('div', { className: 'peppol-rule-filter-options' }, [
                            createEl('label', { className: 'peppol-filter-checkbox-label' }, [
                                createEl('input', { attrs: { type: 'checkbox', id: 'peppol-hideDeprecatedRules', checked: 'checked' } }),
                                createEl('span', { text: 'Hide deprecated rules' })
                            ])
                        ]),
                        createEl('div', { className: 'peppol-rule-list', attrs: { id: 'peppol-ruleList' } }, [
                            createEl('div', { className: 'peppol-rule-loading', text: 'Loading...' })
                        ])
                    ]),
                    createEl('input', { attrs: { type: 'hidden', id: 'peppol-ruleSelect', name: 'rule', required: 'required' } })
                ]),
                createEl('small', { className: 'peppol-help-text', text: 'Filter by searching or select from the list' })
            ]);

            const submitBtn = createEl('button', {
                className: 'peppol-btn-primary',
                attrs: { type: 'button', id: 'peppol-submitBtn', disabled: 'disabled' }
            }, [
                createEl('span', { className: 'peppol-btn-text', text: 'Validate' }),
                createEl('span', { className: 'peppol-btn-loader', text: '⏳', props: { style: 'display: none;' } })
            ]);

            const form = createEl('div', { className: 'peppol-validator-form' }, [
                createEl('h2', { className: 'peppol-validator-title', text: 'Upload and Validate File' }),
                methodSelector,
                pasteGroup,
                fileGroup,
                ruleGroup,
                submitBtn
            ]);

            const resultSection = createEl('div', {
                className: 'peppol-result-section',
                attrs: { id: 'peppol-resultSection' },
                props: { style: 'display: none;' }
            }, [
                createEl('div', { className: 'peppol-result-card' }, [
                    createEl('h3', { className: 'peppol-result-title', text: 'Validation Results' }),
                    createEl('div', { attrs: { id: 'peppol-resultContent' } })
                ])
            ]);

            const errorSection = createEl('div', {
                className: 'peppol-error-section',
                attrs: { id: 'peppol-errorSection' },
                props: { style: 'display: none;' }
            }, [
                createEl('div', { className: 'peppol-error-card' }, [
                    createEl('h3', { className: 'peppol-error-title', text: '❌ Error' }),
                    createEl('div', { attrs: { id: 'peppol-errorContent' } })
                ])
            ]);

            const footer = createEl('div', { className: 'peppol-footer' }, [
                createEl('div', { className: 'peppol-footer-content' }, [
                    createEl('p', { className: 'peppol-footer-brand', text: 'Eaglessoft' }),
                    createEl('p', {
                        className: 'peppol-footer-tech',
                        html: 'Powered by <a href="https://github.com/phax/phive" target="_blank" rel="noopener noreferrer" class="peppol-footer-link">Phive</a> (Philip Helger) | Source: <a href="https://github.com/eaglessoft/phive-doc-validator" target="_blank" rel="noopener noreferrer" class="peppol-footer-link">GitHub</a>'
                    })
                ])
            ]);

            this.root.appendChild(header);
            this.root.appendChild(form);
            this.root.appendChild(resultSection);
            this.root.appendChild(errorSection);
            this.root.appendChild(footer);

            this.collectRefs();
        }

        collectRefs() {
            const ids = [
                'peppol-pasteMethod', 'peppol-fileMethod', 'peppol-pasteContent', 'peppol-fileInput',
                'peppol-fileText', 'peppol-pasteContentGroup', 'peppol-fileUploadGroup', 'peppol-ruleSelect',
                'peppol-ruleSelectTrigger', 'peppol-ruleSelectText', 'peppol-ruleDropdown', 'peppol-ruleSearch',
                'peppol-ruleList', 'peppol-hideDeprecatedRules', 'peppol-lineNumbers', 'peppol-submitBtn',
                'peppol-resultSection', 'peppol-errorSection', 'peppol-resultContent', 'peppol-errorContent'
            ];
            ids.forEach((id) => {
                this.refs[id] = this.root.querySelector(`#${id}`);
            });
            this.refs.textareaWrapper = this.root.querySelector('.peppol-textarea-wrapper');
            this.refs.pasteTab = this.root.querySelector('label[for="peppol-pasteMethod"]');
            this.refs.fileTab = this.root.querySelector('label[for="peppol-fileMethod"]');
        }

        bindEvents() {
            const refs = this.refs;
            const debouncedRuleSearch = debounce((event) => {
                const searchTerm = event.target.value.toLowerCase().trim();
                this.applyFilters(searchTerm);
            }, SEARCH_DEBOUNCE_MS);

            refs['peppol-pasteMethod'].addEventListener('change', () => this.handleInputMethodChange());
            refs['peppol-fileMethod'].addEventListener('change', () => this.handleInputMethodChange());
            refs['peppol-fileInput'].addEventListener('change', (e) => this.handleFileSelect(e));

            refs['peppol-pasteContent'].addEventListener('input', () => {
                this.currentXmlContent = refs['peppol-pasteContent'].value;
                this.updateLineNumbers();
                this.checkFormValidity();
            });

            refs['peppol-pasteContent'].addEventListener('scroll', () => {
                refs['peppol-lineNumbers'].scrollTop = refs['peppol-pasteContent'].scrollTop;
            });

            if (refs.textareaWrapper) {
                refs.textareaWrapper.addEventListener('scroll', () => {
                    refs['peppol-lineNumbers'].scrollTop = refs.textareaWrapper.scrollTop;
                });
            }

            refs['peppol-ruleSelectTrigger'].addEventListener('click', () => this.toggleDropdown());
            refs['peppol-ruleSearch'].addEventListener('input', debouncedRuleSearch);
            refs['peppol-ruleSearch'].addEventListener('click', (e) => e.stopPropagation());
            refs['peppol-hideDeprecatedRules'].addEventListener('change', () => this.handleDeprecatedFilterChange());

            document.addEventListener('click', (e) => {
                if (!refs['peppol-ruleSelectTrigger'].contains(e.target) && !refs['peppol-ruleDropdown'].contains(e.target)) {
                    this.closeDropdown();
                }
            });

            refs['peppol-ruleDropdown'].addEventListener('click', (e) => e.stopPropagation());

            refs['peppol-ruleList'].addEventListener('click', (e) => {
                const item = e.target.closest('.peppol-rule-item');
                if (!item) return;
                const vesid = item.getAttribute('data-vesid');
                if (!vesid) return;
                const selectedRule = this.allRules.find((rule) => rule.vesid === vesid);
                if (selectedRule) this.selectRule(selectedRule);
            });

            refs['peppol-submitBtn'].addEventListener('click', (e) => this.handleFormSubmit(e));
        }

        updateLineNumbers() {
            const textarea = this.refs['peppol-pasteContent'];
            const lineNumbers = this.refs['peppol-lineNumbers'];
            if (!textarea || !lineNumbers) return;

            const lines = textarea.value.split('\n').length;
            const visibleLineCount = Math.max(lines, 15);
            const fragment = document.createDocumentFragment();
            for (let i = 1; i <= visibleLineCount; i++) {
                fragment.appendChild(createEl('div', { className: 'peppol-line-number', text: String(i) }));
            }
            lineNumbers.innerHTML = '';
            lineNumbers.appendChild(fragment);
            lineNumbers.scrollTop = textarea.scrollTop;
        }

        toggleDropdown() {
            if (this.isDropdownOpen) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        }

        openDropdown() {
            this.isDropdownOpen = true;
            this.refs['peppol-ruleSelectTrigger'].classList.add('active');
            this.refs['peppol-ruleDropdown'].style.display = 'flex';
            this.refs['peppol-ruleSearch'].focus();
            if (this.allRules.length > 0) {
                const searchTerm = this.refs['peppol-ruleSearch'].value.toLowerCase().trim();
                this.applyFilters(searchTerm);
            }
        }

        closeDropdown() {
            this.isDropdownOpen = false;
            this.refs['peppol-ruleSelectTrigger'].classList.remove('active');
            this.refs['peppol-ruleDropdown'].style.display = 'none';
            this.refs['peppol-ruleSearch'].value = '';
        }

        handleDeprecatedFilterChange() {
            const searchTerm = this.refs['peppol-ruleSearch'].value.toLowerCase().trim();
            this.applyFilters(searchTerm);
        }

        applyFilters(searchTerm) {
            let rules = this.allRules.slice();

            if (searchTerm) {
                rules = rules.filter((rule) => {
                    const readableName = (rule.readableName || rule.name || rule.vesid || '').toLowerCase();
                    const vesid = (rule.vesid || '').toLowerCase();
                    return readableName.includes(searchTerm) || vesid.includes(searchTerm);
                });
            }

            if (this.refs['peppol-hideDeprecatedRules'].checked) {
                rules = rules.filter((rule) => !rule.deprecated);
            }

            this.filteredRules = rules;
            this.renderRuleList(rules);
        }

        renderRuleList(rules) {
            const ruleList = this.refs['peppol-ruleList'];
            const selectedVesid = this.refs['peppol-ruleSelect'].value;

            ruleList.innerHTML = '';
            if (!rules.length) {
                ruleList.appendChild(createEl('div', { className: 'peppol-rule-empty', text: 'No results found' }));
                return;
            }

            const fragment = document.createDocumentFragment();
            rules.forEach((rule) => {
                const readableName = rule.readableName || rule.name || rule.vesid;
                const item = createEl('div', {
                    className: `peppol-rule-item ${rule.deprecated ? 'deprecated' : ''} ${selectedVesid === rule.vesid ? 'selected' : ''}`.trim(),
                    attrs: { 'data-vesid': rule.vesid }
                }, [
                    createEl('div', { className: 'peppol-rule-item-name', text: readableName }),
                    createEl('div', { className: 'peppol-rule-item-vesid', text: rule.vesid })
                ]);
                fragment.appendChild(item);
            });
            ruleList.appendChild(fragment);
        }

        selectRule(rule) {
            const readableName = rule.readableName || rule.name || rule.vesid;
            this.refs['peppol-ruleSelect'].value = rule.vesid;
            this.refs['peppol-ruleSelectText'].textContent = readableName;
            this.closeDropdown();
            this.checkFormValidity();
        }

        handleInputMethodChange() {
            const pasteMethod = this.refs['peppol-pasteMethod'];
            const fileMethod = this.refs['peppol-fileMethod'];

            if (pasteMethod.checked) {
                this.refs['peppol-pasteContentGroup'].style.display = 'block';
                this.refs['peppol-fileUploadGroup'].style.display = 'none';
                if (this.refs.pasteTab) this.refs.pasteTab.classList.add('active');
                if (this.refs.fileTab) this.refs.fileTab.classList.remove('active');
            } else if (fileMethod.checked) {
                this.refs['peppol-pasteContentGroup'].style.display = 'none';
                this.refs['peppol-fileUploadGroup'].style.display = 'block';
                if (this.refs.fileTab) this.refs.fileTab.classList.add('active');
                if (this.refs.pasteTab) this.refs.pasteTab.classList.remove('active');
            }

            this.checkFormValidity();
        }

        handleFileSelect(event) {
            const file = event.target.files[0];
            const fileText = this.refs['peppol-fileText'];

            if (!file) {
                fileText.textContent = 'Select XML file';
                fileText.style.color = '#64748b';
                this.checkFormValidity();
                return;
            }

            fileText.textContent = file.name;
            fileText.style.color = '#6794f1';

            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentXmlContent = e.target.result;
                this.refs['peppol-pasteContent'].value = this.currentXmlContent;
                this.checkFormValidity();
            };
            reader.onerror = () => {
                this.showError('Failed to read file content');
            };
            reader.readAsText(file);
        }

        checkFormValidity() {
            const isPasteMethod = this.refs['peppol-pasteMethod'].checked;
            const hasFile = this.refs['peppol-fileInput'].files.length > 0;
            const hasPasteContent = this.refs['peppol-pasteContent'].value.trim().length > 0;
            const hasRule = this.refs['peppol-ruleSelect'].value !== '';

            const hasInput = isPasteMethod ? hasPasteContent : hasFile;
            this.refs['peppol-submitBtn'].disabled = !(hasInput && hasRule);
        }

        loadRules() {
            return requestJson(`${this.apiBaseUrl}/list-rules`)
                .then((data) => {
                    if (!data.rules || !data.rules.length) {
                        this.refs['peppol-ruleList'].innerHTML = '<div class="peppol-rule-empty">No rules found</div>';
                        this.showError('No rules found');
                        return;
                    }

                    this.allRules = data.rules;
                    this.applyFilters('');
                    this.refs['peppol-ruleSearch'].placeholder = `${this.allRules.length} rules available - Search...`;
                })
                .catch((error) => {
                    console.error('Error loading rules:', error);
                    this.refs['peppol-ruleList'].innerHTML = '<div class="peppol-rule-empty">Failed to load rules</div>';
                    this.showError(`An error occurred while loading rules: ${error.message}`);
                });
        }

        handleFormSubmit(event) {
            event.preventDefault();

            const rule = this.refs['peppol-ruleSelect'].value;
            const isPasteMethod = this.refs['peppol-pasteMethod'].checked;

            if (!rule) {
                this.showError('Please select a validation rule');
                this.refs['peppol-ruleSelectTrigger'].focus();
                return;
            }

            this.setLoadingState(true);
            this.hideResults();

            const formData = new FormData();
            formData.append('rule', rule);

            if (isPasteMethod) {
                const pasteText = this.refs['peppol-pasteContent'].value.trim();
                if (!pasteText) {
                    this.showError('Please paste XML content');
                    this.setLoadingState(false);
                    return;
                }
                this.currentXmlContent = pasteText;
                formData.append('file', new Blob([pasteText], { type: 'application/xml' }), 'pasted-content.xml');
            } else {
                const file = this.refs['peppol-fileInput'].files[0];
                if (!file) {
                    this.showError('Please select an XML file');
                    this.setLoadingState(false);
                    return;
                }
                formData.append('file', file);
            }

            requestJson(`${this.apiBaseUrl}/validate`, {
                method: 'POST',
                body: formData
            })
                .then((result) => {
                    if (result.error || result.errorText) {
                        this.showError(result.error || result.errorText || 'Validation error');
                        return;
                    }
                    this.displayResults(result);
                })
                .catch((error) => {
                    console.error('Validation error:', error);
                    this.showError(`An error occurred during validation: ${error.message}`);
                })
                .finally(() => {
                    this.setLoadingState(false);
                });
        }

        setLoadingState(loading) {
            const submitBtn = this.refs['peppol-submitBtn'];
            const btnText = submitBtn.querySelector('.peppol-btn-text');
            const btnLoader = submitBtn.querySelector('.peppol-btn-loader');

            if (loading) {
                submitBtn.disabled = true;
                btnText.textContent = 'Validating...';
                btnLoader.style.display = 'inline-block';
                return;
            }

            submitBtn.disabled = false;
            btnText.textContent = 'Validate';
            btnLoader.style.display = 'none';
            this.checkFormValidity();
        }

        displayResults(result) {
            const resultSection = this.refs['peppol-resultSection'];
            const errorSection = this.refs['peppol-errorSection'];
            const resultContent = this.refs['peppol-resultContent'];

            errorSection.style.display = 'none';
            resultSection.style.display = 'block';

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

                    items.forEach((item) => {
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
                        items,
                        errors,
                        warnings
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

                validationResults.forEach((vr) => {
                    const artifactType = this.formatArtifactType(vr.artifactType);
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
                    const artifactType = this.formatArtifactType(vr.artifactType);
                    const artifactPath = escapeHtml(vr.artifactPath);

                    html += `<div class="peppol-validation-detail-group">`;
                    html += `<h5 class="peppol-detail-group-title">${artifactType} - ${artifactPath}</h5>`;

                    if (vr.items && vr.items.length > 0) {
                        vr.items.forEach((item) => {
                            const itemClass = this.getItemClass(item);
                            const itemIcon = this.getItemIcon(item);
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

                    html += '</div>';
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

            const toggleJsonBtn = this.root.querySelector('#peppol-toggleJsonBtn');
            const downloadJsonBtn = this.root.querySelector('#peppol-downloadJsonBtn');
            const downloadXmlBtn = this.root.querySelector('#peppol-downloadXmlBtn');

            if (toggleJsonBtn) {
                toggleJsonBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const jsonViewer = this.root.querySelector('#peppol-jsonViewer');
                    if (jsonViewer) {
                        jsonViewer.style.display = jsonViewer.style.display === 'none' ? 'block' : 'none';
                    }
                };
            }

            if (downloadJsonBtn) {
                downloadJsonBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.downloadJsonResult(result, fileName);
                };
            }

            if (downloadXmlBtn) {
                downloadXmlBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.downloadXmlFile(fileName);
                };
            }

            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        formatArtifactType(type) {
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

            return type
                .split(/[-_\s]+/)
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

        getItemClass(item) {
            const level = (item.errorLevel || item.severity || '').toUpperCase();
            if (level.includes('ERROR') || level === 'ERROR') return 'error';
            if (level.includes('WARNING') || level.includes('WARN')) return 'warning';
            return 'success';
        }

        getItemIcon(item) {
            const level = (item.errorLevel || item.severity || '').toUpperCase();
            if (level.includes('ERROR') || level === 'ERROR') return '❌';
            if (level.includes('WARNING') || level.includes('WARN')) return '⚠️';
            return '✅';
        }

        showError(message) {
            this.refs['peppol-resultSection'].style.display = 'none';
            this.refs['peppol-errorSection'].style.display = 'block';
            this.refs['peppol-errorContent'].innerHTML = `
                <div class="peppol-validation-item error">
                    <div class="peppol-validation-item-title">❌ Error</div>
                    <div class="peppol-validation-item-message">${escapeHtml(message)}</div>
                </div>
            `;
            this.refs['peppol-errorSection'].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        hideResults() {
            this.refs['peppol-resultSection'].style.display = 'none';
            this.refs['peppol-errorSection'].style.display = 'none';
        }

        downloadJsonResult(result, fileName) {
            try {
                const jsonString = JSON.stringify(result, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const baseFileName = fileName ? fileName.replace(/\.xml$/i, '') : 'validation_result';
                a.download = `${baseFileName}_validation_result.json`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (error) {
                console.error('Error downloading JSON:', error);
                this.showError(`Failed to download JSON result: ${error.message}`);
            }
        }

        downloadXmlFile(fileName) {
            try {
                if (!this.currentXmlContent) {
                    this.showError('No XML content available to download');
                    return;
                }
                const blob = new Blob([this.currentXmlContent], { type: 'application/xml;charset=utf-8' });
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
                this.showError(`Failed to download XML file: ${error.message}`);
            }
        }
    }

    class PeppolValidatorElement extends HTMLElement {
        connectedCallback() {
            if (this.__peppolInitialized) return;
            this.__peppolInitialized = true;

            const componentApiUrl = normalizeApiBaseUrl(this.getAttribute('api-url'));
            const scriptApiUrl = resolveScriptApiBaseUrl();
            const apiBaseUrl = componentApiUrl || scriptApiUrl || DEFAULT_API_BASE_URL;
            const autoCss = toBoolean(this.getAttribute('auto-css'), true);

            if (!componentApiUrl) {
                this.setAttribute('api-url', apiBaseUrl);
            }

            ensureCssLoaded(autoCss);

            const app = new PeppolValidatorApp(this, apiBaseUrl);
            app.mount();
        }
    }

    function mountLegacyContainer() {
        if (document.querySelector('peppol-validator')) return;

        const legacyRoot = document.querySelector(`.${ROOT_CLASS}`);
        if (!legacyRoot) return;

        const legacyApiUrl = normalizeApiBaseUrl(legacyRoot.getAttribute('data-api-url'));
        const scriptApiUrl = resolveScriptApiBaseUrl();
        const apiBaseUrl = legacyApiUrl || scriptApiUrl || DEFAULT_API_BASE_URL;

        const script = getCurrentScript();
        const scriptAutoCss = script ? script.getAttribute('data-auto-css') : null;
        const containerAutoCss = legacyRoot.getAttribute('data-auto-css');
        const autoCss = toBoolean(containerAutoCss != null ? containerAutoCss : scriptAutoCss, true);

        ensureCssLoaded(autoCss);

        const app = new PeppolValidatorApp(legacyRoot, apiBaseUrl);
        app.mount();
    }

    function bootstrap() {
        if (!customElements.get('peppol-validator')) {
            customElements.define('peppol-validator', PeppolValidatorElement);
        }
        mountLegacyContainer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
