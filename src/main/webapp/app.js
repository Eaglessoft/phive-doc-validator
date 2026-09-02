(() => {
    'use strict';


    const HIGHLIGHT_LIMIT = 300000;
    const HIGHLIGHT_INLINE_LIMIT = 60000;

    /* Inline SVG, not emoji. Emoji render differently on every OS, sit on their
       own colour, and so cannot take the per-severity colour the report's title
       rules already set - these inherit it through currentColor. Sized in CSS
       (.validation-item-title svg, .action-btn .btn-icon svg) so one rule
       governs them all. */
    const ICON = {
        error: '❌',
        warning: '⚠️',
        success: '✅',
        document: '📄',
        download: '⬇️'
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Colours one tag: name, then each attribute name / equals / quoted value.
     * Everything it does not recognise falls through as punctuation, so a
     * half-typed tag still renders rather than disappearing.
     */
    function highlightTag(raw) {
        const open = /^(<\/?)([A-Za-z_][\w.:-]*)/.exec(raw);
        if (!open) {
            return '<span class="x-punc">' + escapeHtml(raw) + '</span>';
        }

        let html = '<span class="x-punc">' + escapeHtml(open[1]) + '</span>' +
                   '<span class="x-tag">' + escapeHtml(open[2]) + '</span>';

        const rest = raw.slice(open[0].length);
        const attr = /([A-Za-z_][\w.:-]*)(\s*=\s*)("[^"]*"|'[^']*')/g;
        let last = 0;
        let match;

        while ((match = attr.exec(rest)) !== null) {
            html += escapeHtml(rest.slice(last, match.index));
            html += '<span class="x-attr">' + escapeHtml(match[1]) + '</span>';
            html += '<span class="x-punc">' + escapeHtml(match[2]) + '</span>';
            html += '<span class="x-val">' + escapeHtml(match[3]) + '</span>';
            last = match.index + match[0].length;
        }

        html += '<span class="x-punc">' + escapeHtml(rest.slice(last)) + '</span>';
        return html;
    }

    /**
     * A deliberately forgiving XML scanner: it colours what it is being shown
     * while it is still being typed, so every construct also matches when its
     * terminator is missing. It is not a parser and makes no claim about
     * well-formedness - that is what the Validate button is for.
     */
    function highlightXml(source) {
        const token = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<[?!][\s\S]*?(?:>|$)|<\/?[A-Za-z_][\w.:-]*(?:"[^"]*"|'[^']*'|[^<>])*?(?:>|$)/g;
        let html = '';
        let last = 0;
        let match;

        while ((match = token.exec(source)) !== null) {
            html += escapeHtml(source.slice(last, match.index));

            const raw = match[0];
            if (raw.indexOf('<!--') === 0) {
                html += '<span class="x-comment">' + escapeHtml(raw) + '</span>';
            } else if (raw.indexOf('<![CDATA[') === 0 || raw.indexOf('<?') === 0 || raw.indexOf('<!') === 0) {
                html += '<span class="x-meta">' + escapeHtml(raw) + '</span>';
            } else {
                html += highlightTag(raw);
            }

            last = token.lastIndex;
            if (match.index === token.lastIndex) {
                token.lastIndex += 1;  // never spin on a zero-length match
            }
        }

        return html + escapeHtml(source.slice(last));
    }


    // A VESID is punctuation-separated (eu.peppol.bis3:invoice:2023.11) while the
    // readable name is words. Flattening every separator to a space lets one
    // query cross both, so "bis3 invoice" and "peppol 2023.11" work.
    function normalizeForSearch(value) {
        return String(value == null ? '' : value)
            .toLowerCase()
            .replace(/[:._\-()\/,]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function searchTokens(query) {
        return normalizeForSearch(query).split(' ').filter(Boolean);
    }

    /**
     * Ranks a rule against the query. Every token must be present - that is the
     * filter - and the score only decides the order in which survivors are
     * shown. Exact identifiers first, then things the query starts, then whole
     * word hits, then anything else; a current rule always outranks a
     * deprecated one that scored the same.
     */
    function scoreRule(rule, tokens, query) {
        const haystack = rule._haystack;
        for (let i = 0; i < tokens.length; i += 1) {
            if (haystack.indexOf(tokens[i]) === -1) {
                return -1;
            }
        }

        const flatQuery = tokens.join(' ');
        let score = 10;

        if (rule._vesid === query || rule._name === query) {
            score = 100;
        } else if (rule._name.indexOf(flatQuery) === 0 || rule._vesid.indexOf(flatQuery) === 0) {
            score = 70;
        } else if (haystack.indexOf(flatQuery) !== -1) {
            score = 50;
        } else if (tokens.every((t) => new RegExp('(^|\\s)' + escapeRegExp(t)).test(haystack))) {
            score = 30;
        }

        return rule.deprecated ? score - 5 : score;
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Wraps every token hit in <mark>. Ranges are collected on the raw string
     * and merged before anything is emitted, so overlapping tokens cannot
     * produce nested marks or double-escaped text.
     */
    function markMatches(text, tokens) {
        const raw = String(text == null ? '' : text);
        if (!tokens.length) {
            return escapeHtml(raw);
        }

        const hay = raw.toLowerCase();
        const ranges = [];

        tokens.forEach((token) => {
            let from = 0;
            for (;;) {
                const at = hay.indexOf(token, from);
                if (at === -1) {
                    break;
                }
                ranges.push([at, at + token.length]);
                from = at + token.length;
            }
        });

        if (!ranges.length) {
            return escapeHtml(raw);
        }

        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [ranges[0]];
        for (let i = 1; i < ranges.length; i += 1) {
            const last = merged[merged.length - 1];
            if (ranges[i][0] <= last[1]) {
                last[1] = Math.max(last[1], ranges[i][1]);
            } else {
                merged.push(ranges[i]);
            }
        }

        let html = '';
        let at = 0;
        merged.forEach((range) => {
            html += escapeHtml(raw.slice(at, range[0]));
            html += '<mark>' + escapeHtml(raw.slice(range[0], range[1])) + '</mark>';
            at = range[1];
        });
        return html + escapeHtml(raw.slice(at));
    }

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
            this.renderHighlight(this.dom.pasteContent ? this.dom.pasteContent.value : '');
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
                pasteHighlight: document.getElementById('pasteHighlight'),
                textareaWrapper: document.querySelector('.textarea-wrapper')
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
                pasteContent.addEventListener('keydown', (event) => this.handleEditorKeydown(event));
            }

            if (pasteContent) {
                pasteContent.addEventListener('scroll', () => this.syncEditorScroll());
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
                ruleSelectTrigger.addEventListener('keydown', (event) => this.handleTriggerKeydown(event));
            }

            if (ruleSearch) {
                ruleSearch.addEventListener('keydown', (event) => this.handleSearchKeydown(event));
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
                    this.dom.fileText.classList.add('has-file');
                }

                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    const content = loadEvent.target.result;
                    this.state.pasteContentValue = content;
                    this.state.currentXmlContent = content;
                    if (this.dom.pasteContent) {
                        this.dom.pasteContent.value = content;
                    }
                    this.renderHighlight(content);
                    this.updateLineNumbers();
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
                this.dom.fileText.classList.remove('has-file');
            }
            this.checkFormValidity();
        }

        handlePasteContentChange() {
            const content = this.dom.pasteContent ? this.dom.pasteContent.value : '';
            this.state.pasteContentValue = content;
            this.renderHighlight(content);
            this.updateLineNumbers();
            this.checkFormValidity();
        }

        syncEditorScroll() {
            const textarea = this.dom.pasteContent;
            if (!textarea) {
                return;
            }
            if (this.dom.pasteHighlight) {
                this.dom.pasteHighlight.scrollTop = textarea.scrollTop;
                this.dom.pasteHighlight.scrollLeft = textarea.scrollLeft;
            }
            if (this.dom.lineNumbers) {
                this.dom.lineNumbers.scrollTop = textarea.scrollTop;
            }
        }

        // Typing must never wait on the highlighter. Small documents - which is
        // almost every invoice - repaint inline because it is imperceptible.
        // Larger ones repaint once the typing pauses, so a long IDoc stays
        // responsive under the keys. Past HIGHLIGHT_LIMIT the layer holds plain
        // escaped text and the editor simply stops being coloured: slow is worse
        // than uncoloured, and the payload cap is 5 MB anyway.
        renderHighlight(source) {
            if (!this.dom.pasteHighlight) {
                return;
            }

            const text = source || '';
            window.clearTimeout(this.state.highlightTimer);

            if (text.length <= HIGHLIGHT_INLINE_LIMIT) {
                this.paintHighlight(text);
                return;
            }

            this.state.highlightTimer = window.setTimeout(() => this.paintHighlight(text), 150);
        }

        paintHighlight(text) {
            const layer = this.dom.pasteHighlight;
            if (!layer) {
                return;
            }

            const html = text.length > HIGHLIGHT_LIMIT ? escapeHtml(text) : highlightXml(text);

            // The trailing newline keeps the last line scrollable into view, the
            // same way a textarea reserves it.
            layer.innerHTML = html + '\n';
            this.syncEditorScroll();
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
                    this.dom.pasteContentGroup.classList.remove('is-hidden');
                }
                if (this.dom.fileUploadGroup) {
                    this.dom.fileUploadGroup.classList.add('is-hidden');
                }
                if (this.dom.pasteContent) {
                    this.dom.pasteContent.value = this.state.pasteContentValue;
                }
                this.renderHighlight(this.state.pasteContentValue);
                this.updateLineNumbers();
                if (pasteTab) {
                    pasteTab.classList.add('active');
                }
                if (fileTab) {
                    fileTab.classList.remove('active');
                }
            } else if (this.dom.fileMethod && this.dom.fileMethod.checked) {
                if (this.dom.pasteContentGroup) {
                    this.dom.pasteContentGroup.classList.add('is-hidden');
                }
                if (this.dom.fileUploadGroup) {
                    this.dom.fileUploadGroup.classList.remove('is-hidden');
                }

                if (this.dom.fileText) {
                    if (this.state.uploadedFileName) {
                        this.dom.fileText.textContent = this.state.uploadedFileName;
                        this.dom.fileText.classList.add('has-file');
                    } else {
                        this.dom.fileText.textContent = 'Select XML file';
                        this.dom.fileText.classList.remove('has-file');
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

        // In a code pane Tab is indentation, not "leave this field". Shift+Tab and
        // Escape still move focus on, so the textarea is not a keyboard trap.
        handleEditorKeydown(event) {
            if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            event.preventDefault();

            const textarea = event.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const indent = '  ';

            textarea.value = textarea.value.slice(0, start) + indent + textarea.value.slice(end);
            textarea.selectionStart = textarea.selectionEnd = start + indent.length;
            this.handlePasteContentChange();
        }

        updateLineNumbers() {
            const textarea = this.dom.pasteContent;
            const lineNumbers = this.dom.lineNumbers;

            if (!textarea || !lineNumbers) {
                return;
            }

            const lines = textarea.value.split('\n').length;
            const scrollTop = textarea.scrollTop;
            /* One number per line of content, and nothing below it - which is
               what every code editor does, and the only shape that is safe here.
               The floor used to be a flat 15 (the textarea's old rows="15"), and
               filling the visible pane instead looked tidier but created a
               feedback loop: the gutter grew to fill the pane, and the gutter's
               own content then became the pane's height, so the pane could never
               shrink again and the Validate button was pushed off the bottom. */
            const targetLineCount = Math.max(lines, 1);

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

        // Enter/Space open the list the way a native select does; Down opens it and
        // steps straight into the first option, which is what people try first.
        handleTriggerKeydown(event) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                this.toggleDropdown();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!this.state.isDropdownOpen) {
                    this.openDropdown();
                }
                this.moveActiveOption(1);
                return;
            }
            if (event.key === 'Escape' && this.state.isDropdownOpen) {
                event.preventDefault();
                this.closeDropdown();
            }
        }

        // Focus stays in the search box while the arrows move a highlight through
        // the list - aria-activedescendant is what lets those be two different
        // things. Typing to narrow and arrowing to pick then work together.
        handleSearchKeydown(event) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.moveActiveOption(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.moveActiveOption(-1);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                this.commitActiveOption();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeDropdown();
                if (this.dom.ruleSelectTrigger) {
                    this.dom.ruleSelectTrigger.focus();
                }
            }
        }

        visibleOptions() {
            return this.dom.ruleList
                ? Array.from(this.dom.ruleList.querySelectorAll('.rule-item'))
                : [];
        }

        setActiveOption(index) {
            const options = this.visibleOptions();
            options.forEach((option) => option.classList.remove('is-active'));

            if (index < 0 || index >= options.length) {
                this.state.activeOptionIndex = -1;
                if (this.dom.ruleSearch) {
                    this.dom.ruleSearch.removeAttribute('aria-activedescendant');
                }
                return;
            }

            const option = options[index];
            option.classList.add('is-active');
            option.scrollIntoView({ block: 'nearest' });
            this.state.activeOptionIndex = index;
            if (this.dom.ruleSearch) {
                this.dom.ruleSearch.setAttribute('aria-activedescendant', option.id);
            }
        }

        moveActiveOption(step) {
            const options = this.visibleOptions();
            if (!options.length) {
                return;
            }
            const current = typeof this.state.activeOptionIndex === 'number'
                ? this.state.activeOptionIndex
                : -1;
            let next = current + step;
            if (next < 0) {
                next = options.length - 1;
            } else if (next >= options.length) {
                next = 0;
            }
            this.setActiveOption(next);
        }

        commitActiveOption() {
            const options = this.visibleOptions();
            const index = this.state.activeOptionIndex;
            const option = index >= 0 ? options[index] : options[0];
            if (!option) {
                return;
            }
            const vesid = option.dataset.vesid;
            const rule = this.state.filteredRules.find((candidate) => candidate.vesid === vesid) ||
                this.state.allRules.find((candidate) => candidate.vesid === vesid);
            if (rule) {
                this.selectRule(rule);
                if (this.dom.ruleSelectTrigger) {
                    this.dom.ruleSelectTrigger.focus();
                }
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
                this.dom.ruleSelectTrigger.setAttribute('aria-expanded', 'true');
            }
            if (this.dom.ruleDropdown) {
                this.dom.ruleDropdown.classList.remove('is-hidden');
            }
            if (this.dom.ruleSearch) {
                this.dom.ruleSearch.focus();
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
                this.dom.ruleSelectTrigger.setAttribute('aria-expanded', 'false');
            }
            this.setActiveOption(-1);
            if (this.dom.ruleDropdown) {
                this.dom.ruleDropdown.classList.add('is-hidden');
            }
            if (this.dom.ruleSearch) {
                this.dom.ruleSearch.value = '';
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
                    this.indexRules();
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

        // Precomputed so a 500-rule list is not re-lowercased on every keystroke.
        indexRules() {
            this.state.allRules.forEach((rule) => {
                const name = rule.readableName || rule.name || rule.vesid || '';
                rule._name = normalizeForSearch(name);
                rule._vesid = normalizeForSearch(rule.vesid || '');
                rule._haystack = rule._name + ' ' + rule._vesid;
            });
        }

        applyFilters(searchTerm) {
            let rules = [...this.state.allRules];
            const tokens = searchTokens(searchTerm);
            this.state.searchTokens = tokens;

            if (tokens.length) {
                const query = tokens.join(' ');
                rules = rules
                    .map((rule) => ({ rule, score: scoreRule(rule, tokens, query) }))
                    .filter((entry) => entry.score >= 0)
                    // Only reorder when there is something to rank by; with no
                    // query the service's own order is the meaningful one.
                    .sort((a, b) => b.score - a.score || a.rule._name.localeCompare(b.rule._name))
                    .map((entry) => entry.rule);
            }

            if (this.dom.hideDeprecatedRules && this.dom.hideDeprecatedRules.checked) {
                rules = rules.filter((rule) => !rule.deprecated);
            }

            this.state.filteredRules = rules;
            this.renderRuleList(rules);
            this.setActiveOption(-1);
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

            rules.forEach((rule, index) => {
                const item = document.createElement('div');
                const isSelected = selectedRuleValue === rule.vesid;
                item.className = `rule-item ${rule.deprecated ? 'deprecated' : ''} ${isSelected ? 'selected' : ''}`;
                item.dataset.vesid = rule.vesid;
                item.id = `rule-option-${index}`;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', String(isSelected));

                const readableName = rule.readableName || rule.name || rule.vesid;
                const vesid = rule.vesid;

                const tokens = this.state.searchTokens || [];
                item.innerHTML = `
                    <div class="rule-item-name">${markMatches(readableName, tokens)}</div>
                    <div class="rule-item-vesid">${markMatches(vesid, tokens)}</div>
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
                    // content carried over from an upload keeps its own name in the report
                    formData.append('file', blob, this.state.uploadedFileName || 'pasted-content.xml');
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
                    btnLoader.classList.remove('is-hidden');
                }
            } else {
                this.dom.submitBtn.disabled = false;
                if (btnText) {
                    btnText.textContent = 'Validate';
                }
                if (btnLoader) {
                    btnLoader.classList.add('is-hidden');
                }
                this.checkFormValidity();
            }
        }

        displayResults(result) {
            if (!this.dom.resultSection || !this.dom.errorSection || !this.dom.resultContent) {
                return;
            }

            this.dom.errorSection.classList.add('is-hidden');
            this.dom.resultSection.classList.remove('is-hidden');

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
                        <span class="btn-icon">${ICON.document}</span>
                        <span>Show/Hide JSON Result</span>
                    </button>
                    <div class="download-buttons">
                        <button class="action-btn download-btn" id="downloadJsonBtn">
                            <span class="btn-icon">${ICON.download}</span>
                            <span>Download JSON Result</span>
                        </button>
                        <button class="action-btn download-btn" id="downloadXmlBtn">
                            <span class="btn-icon">${ICON.download}</span>
                            <span>Download XML File</span>
                        </button>
                    </div>
                </div>
                <div id="jsonViewer" class="json-viewer is-hidden">
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
                return { className: 'error', icon: ICON.error, isError: true, isWarning: false };
            }
            if (level.includes('WARNING') || level === 'WARNING' || level.includes('WARN')) {
                return { className: 'warning', icon: ICON.warning, isError: false, isWarning: true };
            }
            return { className: 'success', icon: ICON.success, isError: false, isWarning: false };
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

            this.dom.resultSection.classList.add('is-hidden');
            this.dom.errorSection.classList.remove('is-hidden');
            this.dom.errorContent.innerHTML = `
                <div class="validation-item error">
                    <div class="validation-item-title">${ICON.error} Error</div>
                    <div class="validation-item-message">${this.escapeHtml(message)}</div>
                </div>
            `;

            this.dom.errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        hideResults() {
            if (this.dom.resultSection) {
                this.dom.resultSection.classList.add('is-hidden');
            }
            if (this.dom.errorSection) {
                this.dom.errorSection.classList.add('is-hidden');
            }
        }

        toggleJsonViewer() {
            const jsonViewer = this.dom.resultContent ? this.dom.resultContent.querySelector('#jsonViewer') : null;
            if (!jsonViewer) {
                return;
            }
            jsonViewer.classList.toggle('is-hidden');
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
