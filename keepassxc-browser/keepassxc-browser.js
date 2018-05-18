'use strict';

// contains already called method names
var _called = {};
_called.retrieveCredentials = false;
_called.clearLogins = false;
_called.manualFillRequested = 'none';
let _loginId = -1;

// Count of detected form fields on the page
var _detectedFields = 0;

// Element id's containing input fields detected by MutationObserver
var _observerIds = [];

browser.runtime.onMessage.addListener(function(req, sender, callback) {
    if ('action' in req) {
        if (req.action === 'fill_user_pass_with_specific_login') {
            if (cip.credentials[req.id]) {
                let combination = null;
                if (cip.u) {
                    cip.setValueWithChange(cip.u, cip.credentials[req.id].login);
                    combination = cipFields.getCombination('username', cip.u.getAttribute('data-kpxc-id'));
                    _loginId = req.id;
                    cip.u.focus();
                }
                if (cip.p) {
                    cip.setValueWithChange(cip.p, cip.credentials[req.id].password);
                    _loginId = req.id;
                    combination = cipFields.getCombination('password', cip.p.getAttribute('data-kpxc-id'));
                }

                let list = [];
                if (cip.fillInStringFields(combination.fields, cip.credentials[req.id].stringFields, list)) {
                    cipForm.destroy(false, {'password': list.list[0], 'username': list.list[1]});
                }
            }
        } else if (req.action === 'fill_user_pass') {
            _called.manualFillRequested = 'both';
            cip.receiveCredentialsIfNecessary().then((response) => {
                cip.fillInFromActiveElement(false);
            });
        } else if (req.action === 'fill_pass_only') {
            _called.manualFillRequested = 'pass';
            cip.receiveCredentialsIfNecessary().then((response) => {
                cip.fillInFromActiveElement(false, true); // passOnly to true
            });
        } else if (req.action === 'fill_totp') {
            cip.receiveCredentialsIfNecessary().then((response) => {
                cip.fillInFromActiveElementTOTPOnly(false);
            });
        } else if (req.action === 'activate_password_generator') {
            cip.initPasswordGenerator(cipFields.getAllFields());
        } else if (req.action === 'remember_credentials') {
            cip.contextMenuRememberCredentials();
        } else if (req.action === 'choose_credential_fields') {
            cipDefine.init();
        } else if (req.action === 'clear_credentials') {
            cipEvents.clearCredentials();
            callback();
        } else if (req.action === 'activated_tab') {
            cipEvents.triggerActivatedTab();
            callback();
        } else if (req.action === 'redetect_fields') {
            browser.runtime.sendMessage({
                action: 'load_settings',
            }).then((response) => {
                cip.settings = response;
                cip.initCredentialFields(true);
            });
        } else if (req.action === 'ignore-site') {
            cip.ignoreSite(req.args);
        }
        else if (req.action === 'check_database_hash' && 'hash' in req) {
            cip.detectDatabaseChange(req.hash);
        }
        else if (req.action === 'check_database_hash' && 'hash' in req) {
            cip.detectDatabaseChange(req.hash);
        }
        else if (req.action === 'ignore-site') {
            cip.ignoreSite(req.args);
        }
    }
});

function _f(fieldId) {
    const inputs = document.querySelectorAll('input[data-kpxc-id=\''+fieldId+'\']');
    return inputs.length > 0 ? inputs[0] : null;
}

function _fs(fieldId) {
    const inputs = document.querySelectorAll('input[data-kpxc-id=\''+fieldId+'\'], select[data-kpxc-id=\''+fieldId+'\']');
    return inputs.length > 0 ? inputs[0] : null;
}


var cipForm = {};

cipForm.init = function(form, credentialFields) {
    if (!form.getAttribute('cipForm-initialized') && (credentialFields.password || credentialFields.username)) {
        form.setAttribute('cipForm-initialized', true);
        cipForm.setInputFields(form, credentialFields);
        form.addEventListener('submit', cipForm.onSubmit);
    }
};

cipForm.destroy = function(form, credentialFields) {
    if (form === false && credentialFields) {
        const field = _f(credentialFields.password) || _f(credentialFields.username);
        if (field) {
            form = field.closest('form');
        }
    }

    if (form && form.length > 0) {
        form.onsubmit = null;
    }
};

cipForm.setInputFields = function(form, credentialFields) {
    form.setAttribute('cipUsername', credentialFields.username);
    form.setAttribute('cipPassword', credentialFields.password);
};

cipForm.onSubmit = function() {
    const usernameId = this.getAttribute('cipUsername');
    const passwordId = this.getAttribute('cipPassword');

    let usernameValue = '';
    let passwordValue = '';

    const usernameField = _f(usernameId);
    const passwordField = _f(passwordId);

    if (usernameField) {
        usernameValue = usernameField.value;
    }
    if (passwordField) {
        passwordValue = passwordField.value;
    }

    cip.rememberCredentials(usernameValue, passwordValue);
};


var cipFields = {};

cipFields.inputQueryPattern = 'input[type=\'text\'], input[type=\'email\'], input[type=\'password\'], input[type=\'tel\'], input[type=\'number\'], input:not([type])';
// unique number as new IDs for input fields
cipFields.uniqueNumber = 342845638;
// objects with combination of username + password fields
cipFields.combinations = [];

cipFields.setUniqueId = function(field) {
    if (field && !field.getAttribute('data-kpxc-id')) {
        // use ID of field if it is unique
        // yes, it should be, but there are many bad developers outside...
        const fieldId = field.getAttribute('id');
        if (fieldId) {
            const foundIds = document.querySelectorAll('input#' + cipFields.prepareId(fieldId));
            if (foundIds.length === 1) {
                field.setAttribute('data-kpxc-id', fieldId);
                return;
            }
        }

        // create own ID if no ID is set for this field
        cipFields.uniqueNumber += 1;
        field.setAttribute('data-kpxc-id', 'kpxcpw'+String(cipFields.uniqueNumber));
    }
};

cipFields.prepareId = function(id) {
    return id.replace(/[:#.,\[\]\(\)' "]/g, function(m) { return '\\'+m; });
};

// Check aria-hidden attribute by looping the parent elements of input field
cipFields.getAriaHidden = function(field) {
    let parents = [];
    while (field.parentElement) {
        parents.push(field = field.parentElement)
    }

    for (const p of parents) {
        const val = p.getAttribute('aria-hidden');
        if (val) {
            return val;
        }
    }
    return 'false';
};

cipFields.getOverflowHidden = function(field) {
    let parents = [];
    while (field.parentElement) {
        parents.push(field = field.parentElement)
    }

    for (const p of parents) {
        if (p.style.overflow === 'hidden') {
            return true;
        }
    }
    return false;
};

cipFields.isVisible = function(field) {
    return !!(field.offsetWidth || field.offsetHeight || field.getClientRects().length);
};

cipFields.getAllFields = function() {
    let fields = [];
    const inputs = document.querySelectorAll(cipFields.inputQueryPattern);
    for (const i of inputs) {
        const ariaHidden = cipFields.getAriaHidden(i);
        const overflowHidden = cipFields.getOverflowHidden(i);

        if (cipFields.isVisible(i) && i.style.visibility !== 'hidden' && i.style.visibility !== 'collapsed' && ariaHidden === 'false') {
            cipFields.setUniqueId(i);
            fields.push(i);
        }
    }

    _detectedFields = fields.length;
    return fields;
};

cipFields.getHiddenFieldCount = function() {
    let count = 0;
    const fields = document.querySelectorAll(cipField.inputQueryPattern);
    for (f of fields) {
        if (!cipFields.isVisible(f)) {
            count += 1;
        }
    }

    return count;
};

cipFields.prepareVisibleFieldsWithID = function(pattern) {
    const patterns = document.querySelectorAll(pattern);
    for (const i of patterns) {
        if (cipFields.isVisible(i) && i.style.visibility !== 'hidden' && i.style.visibility !== 'collapsed') {
           cipFields.setUniqueId(i);
        }
    }
};

cipFields.getAllCombinations = function(inputs) {
    let fields = [];
    let uField = null;

    for (const i of inputs) {
        if (i) {
            if (i.getAttribute('type') && i.getAttribute('type').toLowerCase() === 'password') {
                const uId = (!uField || uField.length < 1) ? null : cipFields.prepareId(uField.getAttribute('data-kpxc-id'));

                const combination = {
                    username: uId,
                    password: cipFields.prepareId(i.getAttribute('data-kpxc-id'))
                };
                fields.push(combination);

                // reset selected username field
                uField = null;
            }
            else {
                // username field
                uField = i;
            }
        }
    }

    // If only username field found, add it to the array
    if (fields.length === 0 && uField) {
        const combination = {
            username: uField.getAttribute('data-kpxc-id'),
            password: null
        };
        fields.push(combination);
    }

    return fields;
};

cipFields.getCombination = function(givenType, fieldId) {
    if (cipFields.combinations.length === 0) {
        if (cipFields.useDefinedCredentialFields()) {
            return cipFields.combinations[0];
        }
    }
    // use defined credential fields (already loaded into combinations)
    if (cip.settings['defined-credential-fields'] && cip.settings['defined-credential-fields'][document.location.href]) {
        return cipFields.combinations[0];
    }

    for (let c of cipFields.combinations) {
        if (c[givenType] === fieldId) {
            return c;
        }
    }

    // find new combination
    let combination = {
        username: null,
        password: null
    };

    let newCombi = false;
    if (givenType === 'username') {
        const passwordField = cipFields.getPasswordField(fieldId, true);
        let passwordId = null;
        if (passwordField && passwordField.value.length > 0) {
            passwordId = cipFields.prepareId(passwordField.getAttribute('data-kpxc-id'));
        }
        combination = {
            username: fieldId,
            password: passwordId
        };
        newCombi = true;
    }
    else if (givenType === 'password') {
        const usernameField = cipFields.getUsernameField(fieldId, true);
        let usernameId = null;
        if (usernameField && usernameField.value.length > 0) {
            usernameId = cipFields.prepareId(usernameField.getAttribute('data-kpxc-id'));
        }
        combination = {
            username: usernameId,
            password: fieldId
        };
        newCombi = true;
    }

    if (combination.username || combination.password) {
        cipFields.combinations.push(combination);
    }

    if (combination.username) {
        if (cip.credentials.length > 0) {
            cip.preparePageForMultipleCredentials(cip.credentials);
        }
    }

    if (newCombi) {
        combination.isNew = true;
    }
    return combination;
};

/**
* return the username field or null if it not exists
*/
cipFields.getUsernameField = function(passwordId, checkDisabled) {
    const passwordField = _f(passwordId);
    if (!passwordField) {
        return null;
    }

    //const form = passwordField.closest('form')[0];
    const form = passwordField.closest('form');
    let usernameField = null;

    // search all inputs on this one form
    if (form) {
        const inputs = form.querySelectorAll(cipFields.inputQueryPattern);
        for (const i of inputs) {
            cipFields.setUniqueId(i);
            if (i.getAttribute('data-kpxc-id') === passwordId) {
                return false;
            }

            if (i.getAttribute('type') && i.getAttribute('type').toLowerCase() === 'password') {
                // continue
                return true;
            }

            usernameField = i;
        }
    }
    // search all inputs on page
    else {
        const inputs = cipFields.getAllFields();
        cip.initPasswordGenerator(inputs);
        for (const i of inputs) {
            if (i.getAttribute('data-kpxc-id') === passwordId) {
                break;
            }

            if (i.getAttribute('type') && i.getAttribute('type').toLowerCase() === 'password') {
                continue;
            }

            usernameField = i;
        }
    }

    if (usernameField && !checkDisabled) {
        const usernameId = usernameField.getAttribute('data-kpxc-id');
        // check if usernameField is already used by another combination
        for (const c of cipFields.combinations) {
            if (c.username === usernameId) {
                usernameField = null;
                break;
            }
        }
    }

    cipFields.setUniqueId(usernameField);
    return usernameField;
};

/**
* return the password field or null if it not exists
*/
cipFields.getPasswordField = function(usernameId, checkDisabled) {
    const usernameField = _f(usernameId);
    if (!usernameField) {
        return null;
    }

    //const form = usernameField.closest('form')[0];
    const form = usernameField.closest('form');
    let passwordField = null;

    // search all inputs on this one form
    if (form) {
        const inputs = form.querySelectorAll('input[type=\'password\']');
        if (inputs.length > 0) {
            passwordField = inputs[0];
        }
        if (passwordField && passwordField.length < 1) {
            passwordField = null;
        }

        if (cip.settings.usePasswordGenerator) {
            kpxcPassword.init();
            kpxcPassword.initField(passwordField);
        }
    }
    // search all inputs on page
    else {
        const inputs = cipFields.getAllFields();
        cip.initPasswordGenerator(inputs);

        let active = false;
        for (const i of inputs) {
            if (i.getAttribute('data-kpxc-id') === usernameId) {
                active = true;
            }
            if (active && i.getAttribute('type') && i.getAttribute('type').toLowerCase() === 'password') {
                passwordField = i;
                break;
            }
        }
    }

    if (passwordField && !checkDisabled) {
        const passwordId = passwordField.getAttribute('data-kpxc-id');
        // check if passwordField is already used by another combination
        for (const c of cipFields.combinations) {
            if (c.password === passwordId) {
                passwordField = null;
                break;
            }
        }
    }

    cipFields.setUniqueId(passwordField);

    return passwordField;
};

cipFields.prepareCombinations = function(combinations) {
    for (const c of combinations) {
        const pwField = _f(c.password);
        // needed for auto-complete: don't overwrite manually filled-in password field
        if (pwField && !pwField.getAttribute('cipFields-onChange')) {
            pwField.setAttribute('cipFields-onChange', true);
            pwField.onchange = function() {
                this.setAttribute('unchanged', false);
            }
        }

        // initialize form-submit for remembering credentials
        const fieldId = c.password || c.username;
        const field = _f(fieldId);
        if (field) {
            const form = field.closest('form');
            if (form && form.length > 0) {
                cipForm.init(form, c);
            }
        }
    }
};

cipFields.useDefinedCredentialFields = function() {
    if (cip.settings['defined-credential-fields'] && cip.settings['defined-credential-fields'][document.location.href]) {
        const creds = cip.settings['defined-credential-fields'][document.location.href];

        let found = _f(creds.username) || _f(creds.password);
        for (const i of creds.fields) {
            if (_fs(i)) {
                found = true;
                break;
            }
        }

        if (found) {
            let fields = {
                username: creds.username,
                password: creds.password,
                fields: creds.fields
            };
            cipFields.combinations = [];
            cipFields.combinations.push(fields);

            return true;
        }
    }

    return false;
};

MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

// Detects DOM changes in the document
let observer = new MutationObserver(function(mutations, observer) {
    if (document.visibilityState === 'hidden') {
        return;
    }

    for (const mut of mutations) {
        // skip text nodes
        if (mut.target.nodeType === Node.TEXT_NODE) {
            continue;
        }

        // Check if the added element has any inputs
        const inputs = mut.target.querySelectorAll(cipFields.inputQueryPattern);

        // If only password field is shown it's enough to have one field visible for initCredentialFields
        const neededLength = _detectedFields === 1 ? 0 : 1;
        if (inputs.length > neededLength && !_observerIds.includes(mut.target.id)) {
            // Save target element id for preventing multiple calls to initCredentialsFields()
            _observerIds.push(mut.target.id);
            cip.initCredentialFields(true);
        }
    }
});

// define what element should be observed by the observer
// and what types of mutations trigger the callback
observer.observe(document, {
    subtree: true,
    attributes: true,
    childList: true,
    characterData: true
});

var cip = {};
cip.settings = {};
cip.u = null;
cip.p = null;
cip.url = null;
cip.submitUrl = null;
cip.credentials = [];

const initcb = function() {
    browser.runtime.sendMessage({
        action: 'load_settings',
    }).then((response) => {
        cip.settings = response;
        cip.initCredentialFields();
    });
};

if (document.readyState === 'complete' || (document.readyState !== 'loading' && !document.documentElement.doScroll)) {
    initcb();
} else {
    document.addEventListener('DOMContentLoaded', initcb);
}

cip.init = function() {
    initcb();
};

// Switch credentials if database is changed or closed
cip.detectDatabaseChange = function(response) {
    if (document.visibilityState !== 'hidden') {
        if (response.new === 'no-hash' && response.old !== 'no-hash') {
            cipEvents.clearCredentials();

            browser.runtime.sendMessage({
                action: 'page_clear_logins'
            });

            // Switch back to default popup
            browser.runtime.sendMessage({
                action: 'get_status',
                args: [ true ]    // Set polling to true, this is an internal function call
            });
        } else if (response.new !== 'no-hash' && response.new !== response.old) {
                _called.retrieveCredentials = false;
                browser.runtime.sendMessage({
                    action: 'load_settings',
                }).then((response) => {
                    cip.settings = response;
                    cip.initCredentialFields(true);

                    // If user has requested a manual fill through context menu the actual credential filling
                    // is handled here when the opened database has been regognized. It's not a pretty hack.
                    if (_called.manualFillRequested && _called.manualFillRequested !== 'none') {
                        cip.fillInFromActiveElement(false, _called.manualFillRequested === 'pass');
                        _called.manualFillRequested = 'none';
                    }
                });
        }
    }
};

cip.initCredentialFields = function(forceCall) {
    if (_called.initCredentialFields && !forceCall) {
        return;
    }
    _called.initCredentialFields = true;

    browser.runtime.sendMessage({ 'action': 'page_clear_logins', args: [_called.clearLogins] }).then(() => {
        _called.clearLogins = true;
        const inputs = cipFields.getAllFields();
        if (inputs.length === 0) {
            return;
        }

        cipFields.prepareVisibleFieldsWithID('select');
        cip.initPasswordGenerator(inputs);

        if (!cipFields.useDefinedCredentialFields()) {
            // get all combinations of username + password fields
            cipFields.combinations = cipFields.getAllCombinations(inputs);
        }
        cipFields.prepareCombinations(cipFields.combinations);

        if (cipFields.combinations.length === 0 && inputs.length === 0) {
            browser.runtime.sendMessage({
                action: 'show_default_browseraction'
            });
            return;
        }

        cip.url = document.location.origin;
        cip.submitUrl = cip.getFormActionUrl(cipFields.combinations[0]);

        // Get submitUrl for a single input
        if (!cip.submitUrl && cipFields.combinations.length === 1 && inputs.length === 1) {
            cip.submitUrl = cip.getFormActionUrlFromSingleInput(inputs[0]);
        } 

        if (cip.settings.autoRetrieveCredentials && _called.retrieveCredentials === false && (cip.url && cip.submitUrl)) {
            //_called.retrieveCredentials = true;
            browser.runtime.sendMessage({
                action: 'retrieve_credentials',
                args: [ cip.url, cip.submitUrl ]
            }).then(cip.retrieveCredentialsCallback).catch((e) => {
                console.log(e);
            });
        }
    });
};

cip.initPasswordGenerator = function(inputs) {
    if (cip.settings.usePasswordGenerator) {
        kpxcPassword.init();

        for (let i = 0; i < inputs.length; i++) {
            if (inputs[i] && inputs[i].getAttribute('type') && inputs[i].getAttribute('type').toLowerCase() === 'password') {
                kpxcPassword.initField(inputs[i], inputs, i);
            }
        }
    }
};

cip.receiveCredentialsIfNecessary = function() {
    return new Promise((resolve, reject) => {
        if (cip.credentials.length === 0 && _called.retrieveCredentials === false) {
            browser.runtime.sendMessage({
                action: 'retrieve_credentials',
                args: [ cip.url, cip.submitUrl, false, true ] // Sets triggerUnlock to true
            }).then((credentials) => {
                // If the database was locked, this is scope never met. In these cases the response is met at cip.detectDatabaseChange
                _called.manualFillRequested = 'none';
                cip.retrieveCredentialsCallback(credentials, false);
                resolve(credentials);
            });
        } else {
            resolve(cip.credentials);
        }
    });
};

cip.retrieveCredentialsCallback = function(credentials, dontAutoFillIn) {
    if (cipFields.combinations.length > 0) {
        cip.u = _f(cipFields.combinations[0].username);
        cip.p = _f(cipFields.combinations[0].password);
    }

    if (credentials && credentials.length > 0) {
        cip.credentials = credentials;
        cip.prepareFieldsForCredentials(!Boolean(dontAutoFillIn));
        _called.retrieveCredentials = true;
    }
};

cip.prepareFieldsForCredentials = function(autoFillInForSingle) {
    // only one login for this site
    if (autoFillInForSingle && cip.settings.autoFillSingleEntry && cip.credentials.length === 1) {
        let combination = null;
        if (!cip.p && !cip.u && cipFields.combinations.length > 0) {
            cip.u = _f(cipFields.combinations[0].username);
            cip.p = _f(cipFields.combinations[0].password);
            combination = cipFields.combinations[0];
        }
        if (cip.u) {
            cip.setValueWithChange(cip.u, cip.credentials[0].login);
            combination = cipFields.getCombination('username', cip.u);
        }
        if (cip.p) {
            cip.setValueWithChange(cip.p, cip.credentials[0].password);
            combination = cipFields.getCombination('password', cip.p);
        }

        if (combination) {
            let list = [];
            if (cip.fillInStringFields(combination.fields, cip.credentials[0].stringFields, list)) {
                cipForm.destroy(false, {'password': list.list[0], 'username': list.list[1]});
            }
        }

        // generate popup-list of usernames + descriptions
        browser.runtime.sendMessage({
            action: 'popup_login',
            args: [[cip.credentials[0].login + ' (' + cip.credentials[0].name + ')']]
        });
    }
    //multiple logins for this site
    else if (cip.credentials.length > 1 || (cip.credentials.length > 0 && (!cip.settings.autoFillSingleEntry || !autoFillInForSingle))) {
        cip.preparePageForMultipleCredentials(cip.credentials);
    }
};

cip.preparePageForMultipleCredentials = function(credentials) {
    // add usernames + descriptions to autocomplete-list and popup-list
    let usernames = [];
    kpxcAutocomplete.elements = [];
    let visibleLogin;
    for (let i = 0; i < credentials.length; i++) {
        visibleLogin = (credentials[i].login.length > 0) ? credentials[i].login : '- no username -';
        usernames.push(visibleLogin + ' (' + credentials[i].name + ')');
        const item = {
            label: visibleLogin + ' (' + credentials[i].name + ')',
            value: credentials[i].login,
            loginId: i
        };
        kpxcAutocomplete.elements.push(item);
    }

    // generate popup-list of usernames + descriptions
    browser.runtime.sendMessage({
        action: 'popup_login',
        args: [usernames]
    });

    // initialize autocomplete for username fields
    if (cip.settings.autoCompleteUsernames) {
        for (const i of cipFields.combinations) {
            // Both username and password fields are visible
            if (_detectedFields >= 2) {
                if (_f(i.username)) {
                    kpxcAutocomplete.create(_f(i.username));
                }
            } else if (_detectedFields == 1) {
                if (_f(i.username)) {
                    kpxcAutocomplete.create(_f(i.username));
                }
                if (_f(i.password)) {
                    kpxcAutocomplete.create(_f(i.password));
                }
            }
        }
    }
};

cip.getFormActionUrl = function(combination) {
    if (!combination) {
        return null;
    }

    const field = _f(combination.password) || _f(combination.username);
    if (field === null) {
        return null;
    }

    const form = field.closest('form');
    let action = null;

    if (form && form.length > 0) {
        action = form[0].action;
    }

    if (typeof(action) !== 'string' || action === '') {
        action = document.location.origin + document.location.pathname;
    }

    return action;
};

cip.getFormActionUrlFromSingleInput = function(field) {
    if (!field) {
        return null;
    }

    let action = field.formAction;

    if (typeof(action) !== 'string' || action === '') {
        action = document.location.origin + document.location.pathname;
    }

    return action;
};

cip.fillInCredentials = function(combination, onlyPassword, suppressWarnings) {
    const action = cip.getFormActionUrl(combination);
    const u = _f(combination.username);
    const p = _f(combination.password);

    if (combination.isNew) {
        // initialize form-submit for remembering credentials
        const fieldId = combination.password || combination.username;
        const field = _f(fieldId);
        if (field) {
            const form2 = field.closest('form');
            if (form2 && form2.length > 0) {
                cipForm.init(form2, combination);
            }
        }
    }

    if (u) {
        cip.u = u;
    }
    if (p) {
        cip.p = p;
    }

    if (cip.url === document.location.origin && cip.submitUrl === action && cip.credentials.length > 0) {
        cip.fillIn(combination, onlyPassword, suppressWarnings);
    }
    else {
        cip.url = document.location.origin;
        cip.submitUrl = action;

        browser.runtime.sendMessage({
            action: 'retrieve_credentials',
            args: [ cip.url, cip.submitUrl, false, true ]
        }).then((credentials) => {
            cip.retrieveCredentialsCallback(credentials, true);
            cip.fillIn(combination, onlyPassword, suppressWarnings);
        });
    }
};

cip.fillInFromActiveElement = function(suppressWarnings, passOnly = false) {
    const el = document.activeElement;
    if (el.tagName.toLowerCase() !== 'input') {
        if (cipFields.combinations.length > 0) {
            cip.fillInCredentials(cipFields.combinations[0], false, suppressWarnings);
        }
        return;
    }

    cipFields.setUniqueId(el);
    const fieldId = cipFields.prepareId(el.getAttribute('data-kpxc-id'));
    let combination = null;
    if (el.getAttribute('type') === 'password') {
        combination = cipFields.getCombination('password', fieldId);
    }
    else {
        combination = cipFields.getCombination('username', fieldId);
    }

    if (passOnly) {
        if (!_f(combination.password)) {
            const message = 'Error:\nUnable to find a password field';
            browser.runtime.sendMessage({
                action: 'show_notification',
                args: [message]
            });
            return;
        }
    }

    delete combination.loginId;

    cip.fillInCredentials(combination, passOnly, suppressWarnings);
};

cip.fillInFromActiveElementTOTPOnly = function(suppressWarnings) {
    const el = document.activeElement;
    cipFields.setUniqueId(el);
    const fieldId = cipFields.prepareId(el.getAttribute('data-kpxc-id'));
    const pos = _loginId;

    if (pos >= 0 && cip.credentials[pos]) {
        const sf = _fs(fieldId);
        if (cip.credentials[pos].stringFields && cip.credentials[pos].stringFields.length > 0) {
            const sFields = cip.credentials[pos].stringFields;
            for (const s of sFields) {
                const val = s["KPH: {TOTP}"];
                if (val) {
                    cip.setValue(sf, val);
                }
            }
        } else if (cip.credentials[pos].totp && cip.credentials[pos].totp.length > 0) {
            cip.setValue(sf, cip.credentials[pos].totp);
        }
    }
};

cip.setValue = function(field, value) {
    if (field.matches('select')) {
        value = value.toLowerCase().trim();
        const options = field.querySelectorAll('option');
        for (const o of options) {
            if (o.test().toLowerCase().trim() === value) {
                cip.setValueWithChange(field, o.value);
                return false;
            }
        }
    }
    else {
        cip.setValueWithChange(field, value);
    }
};

cip.fillInStringFields = function(fields, stringFields, filledInFields) {
    let filledIn = false;

    filledInFields.list = [];
    if (fields && stringFields && fields.length > 0 && stringFields.length > 0) {
        for (let i = 0; i < fields.length; i++) {
            const sf = _fs(fields[i]);
            const stringFieldValue = Object.values(stringFields[i]);
            if (sf && stringFieldValue[0]) {
                cip.setValue(sf, stringFieldValue[0]);
                filledInFields.list.push(fields[i]);
                filledIn = true;
            }
        }
    }

    return filledIn;
};

cip.setValueWithChange = function(field, value) {
    if (cip.settings.respectMaxLength === true) {
        const attribute_maxlength = field.getAttribute('maxlength');
        if (attribute_maxlength && !isNaN(attribute_maxlength) && attribute_maxlength > 0) {
            value = value.substr(0, attribute_maxlength);
        }
    }

    field.value = value;
    field.dispatchEvent(new Event('input', {'bubbles': true}));
    field.dispatchEvent(new Event('change', {'bubbles': true}));
};

cip.fillIn = function(combination, onlyPassword, suppressWarnings) {
    // no credentials available
    if (cip.credentials.length === 0 && !suppressWarnings) {
        const message = 'Error:\nNo logins found.';
        browser.runtime.sendMessage({
            action: 'show_notification',
            args: [message]
        });
        return;
    }

    const uField = _f(combination.username);
    const pField = _f(combination.password);

    // exactly one pair of credentials available
    if (cip.credentials.length === 1) {
        let filledIn = false;
        if (uField && !onlyPassword) {
            cip.setValueWithChange(uField, cip.credentials[0].login);
            _loginId = 0;
            filledIn = true;
        }
        if (pField) {
            pField.setAttribute('type', 'password');
            cip.setValueWithChange(pField, cip.credentials[0].password);
            pField.setAttribute('unchanged', true);
            _loginId = 0;
            filledIn = true;
        }

        let list = [];
        if (cip.fillInStringFields(combination.fields, cip.credentials[0].stringFields, list)) {
            cipForm.destroy(false, {'password': list.list[0], 'username': list.list[1]});
            filledIn = true;
        }

        if (!filledIn) {
            if (!suppressWarnings) {
                const message = 'Error:\nCannot find fields to fill in.';
                browser.runtime.sendMessage({
                    action: 'show_notification',
                    args: [message]
                });
            }
        }
    }
    // specific login id given
    else if (combination.loginId !== undefined && cip.credentials[combination.loginId]) {
        let filledIn = false;
        if (uField) {
            cip.setValueWithChange(uField, cip.credentials[combination.loginId].login);
            _loginId = combination.loginId;
            filledIn = true;
        }

        if (pField) {
            cip.setValueWithChange(pField, cip.credentials[combination.loginId].password);
            pField.setAttribute('unchanged', true);
            _loginId = combination.loginId;
            filledIn = true;
        }

        let list = [];
        if (cip.fillInStringFields(combination.fields, cip.credentials[combination.loginId].stringFields, list)) {
            cipForm.destroy(false, {'password': list.list[0], 'username': list.list[1]});
            filledIn = true;
        }

        if (!filledIn) {
            if (!suppressWarnings) {
                const message = 'Error:\nCannot find fields to fill in.';
                browser.runtime.sendMessage({
                    action: 'show_notification',
                    args: [message]
                });
            }
        }
    }
    // multiple credentials available
    else {
        // check if only one password for given username exists
        let countPasswords = 0;

        if (uField) {
            let valPassword = '';
            let valUsername = '';
            let valStringFields = [];
            const valQueryUsername = uField.value.toLowerCase();

            // find passwords to given username (even those with empty username)
            for (const c of cip.credentials) {
                if (c.login.toLowerCase() === valQueryUsername) {
                    countPasswords += 1;
                    valPassword = c.password;
                    valUsername = c.login;
                    valStringFields = c.stringFields;
                }
            }

            // for the correct notification message: 0 = no logins, X > 1 = too many logins
            if (countPasswords === 0) {
                countPasswords = cip.credentials.length;
            }

            // only one mapping username found
            if (countPasswords === 1) {
                if (!onlyPassword) {
                    cip.setValueWithChange(uField, valUsername);
                }

                if (pField) {
                    cip.setValueWithChange(pField, valPassword);
                    pField.setAttribute('unchanged', true);
                }

                let list = [];
                if (cip.fillInStringFields(combination.fields, valStringFields, list)) {
                    cipForm.destroy(false, {'password': list.list[0], 'username': list.list[1]});
                }
            }

            // user has to select correct credentials by himself
            if (countPasswords > 1) {
                if (!suppressWarnings) {
                    const target = onlyPassword ? pField : uField;
                    kpxcAutocomplete.create(target);
                    target.focus();
                }
            }
            else if (countPasswords < 1) {
                if (!suppressWarnings) {
                    const message = 'Error:\nNo credentials for given username found.';
                    browser.runtime.sendMessage({
                        action: 'show_notification',
                        args: [message]
                    });
                }
            }
        }
        else {
            if (!suppressWarnings) {
                const target = onlyPassword ? pField : uField;
                kpxcAutocomplete.create(target);
                target.focus();
            }
        }
    }
};

cip.contextMenuRememberCredentials = function() {
    const el = document.activeElement;
    if (el.tagName.toLowerCase() !== 'input') {
        return;
    }

    cipFields.setUniqueId(el);
    const fieldId = cipFields.prepareId(el.getAttribute('data-kpxc-id'));
    let combination = null;
    if (el.getAttribute('type') === 'password') {
        combination = cipFields.getCombination('password', fieldId);
    }
    else {
        combination = cipFields.getCombination('username', fieldId);
    }

    let usernameValue = '';
    let passwordValue = '';

    const usernameField = _f(combination.username);
    const passwordField = _f(combination.password);

    if (usernameField) {
        usernameValue = usernameField.value;
    }
    if (passwordField) {
        passwordValue = passwordField.value;
    }

    if (!cip.rememberCredentials(usernameValue, passwordValue)) {
        const message = 'Error:\nCould not detect changed credentials.';
        browser.runtime.sendMessage({
            action: 'show_notification',
            args: [message]
        });
    }
};

cip.rememberCredentials = function(usernameValue, passwordValue) {
    // no password given or field cleaned by a site-running script
    // --> no password to save
    if (passwordValue === '') {
        return false;
    }

    let usernameExists = false;
    let nothingChanged = false;

    for (const c of cip.credentials) {
        if (c.login === usernameValue && c.password === passwordValue) {
            nothingChanged = true;
            break;
        }

        if (c.login === usernameValue) {
            usernameExists = true;
        }
    }

    if (!nothingChanged) {
        if (!usernameExists) {
            for (const c of cip.credentials) {
                if (c.login === usernameValue) {
                    usernameExists = true;
                    break;
                }
            }
        }
        let credentialsList = [];
        for (const c of cip.credentials) {
            credentialsList.push({
                login: c.login,
                name: c.name,
                uuid: c.uuid
            });
        }

        let url = this.action;
        if (!url) {
            url = cip.settings.saveDomainOnly ? document.location.origin : document.location.href;
            if (url.indexOf('?') > 0) {
                url = url.substring(0, url.indexOf('?'));
                if (url.length < document.location.origin.length) {
                    url = document.location.origin;
                }
            }
        }

        browser.runtime.sendMessage({
            action: 'set_remember_credentials',
            args: [usernameValue, passwordValue, url, usernameExists, credentialsList]
        });

        return true;
    }

    return false;
};

cip.ignoreSite = function(sites) {
    if (!sites || sites.length === 0) {
        return;
    }

    const site = sites[0];
    if (!cip.settings['ignoredSites']) {
        cip.settings['ignoredSites'] = {};
    }

    cip.settings['ignoredSites'][site] = {
        url: site
    };

    browser.runtime.sendMessage({
        action: 'save_settings',
        args: [cip.settings]
    });
};


var cipEvents = {};

cipEvents.clearCredentials = function() {
    cip.credentials = [];
    kpxcAutocomplete.elements = [];
    _called.retrieveCredentials = false;

    if (cip.settings.autoCompleteUsernames) {
        for (const c of cipFields.combinations) {
            const uField = _f(c.username);
            if (uField) {
                if (uField.classList.contains('ui-autocomplete-input')) {
                    uField.autocomplete('destroy');
                }
            }
        }
    }
};

cipEvents.triggerActivatedTab = function() {
    // doesn't run a second time because of _called.initCredentialFields set to true
    cip.init();

    // initCredentialFields calls also "retrieve_credentials", to prevent it
    // check of init() was already called
    if (_called.initCredentialFields && (cip.url && cip.submitUrl) && cip.settings.autoRetrieveCredentials) {
        browser.runtime.sendMessage({
            action: 'retrieve_credentials',
            args: [ cip.url, cip.submitUrl ]
        }).then(cip.retrieveCredentialsCallback).catch((e) => {
            console.log(e);
        });
    }
};
