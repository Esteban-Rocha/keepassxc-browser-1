'use strict';

var kpxcPassword = {};
kpxcPassword.observedIcons = [];
kpxcPassword.observingLock = false;
kpxcPassword.created = false;
kpxcPassword.selected = null;
kpxcPassword.startPosX = 0;
kpxcPassword.startPosY = 0;
kpxcPassword.diffX = 0;
kpxcPassword.diffY = 0;
kpxcPassword.dialog = null;
kpxcPassword.titleBar = null;

kpxcPassword.init = function() {
    if ('initPasswordGenerator' in _called) {
        return;
    }

    _called.initPasswordGenerator = true;

    window.setInterval(function() {
        kpxcPassword.checkObservedElements();
    }, 400);
};

kpxcPassword.initField = function(field, inputs, pos) {
    if (!field) {
        return;
    }
    if (field.getAttribute('kpxc-password-generator')) {
        return;
    }

    field.setAttribute('kpxc-password-generator', true);

    kpxcPassword.createIcon(field);

    let found = false;
    if (inputs) {
        for (let i = pos + 1; i < inputs.length; i++) {
            if (inputs[i] && inputs[i].getAttribute('type') && inputs[i].getAttribute('type').toLowerCase() === 'password') {
                field.setAttribute('kpxc-genpw-next-field-id', inputs[i].getAttribute('kpxc-id'));
                field.setAttribute('kpxc-genpw-next-is-password-field', (i === 0));
                found = true;
                break;
            }
        }
    }

    field.setAttribute('kpxc-genpw-next-field-exists', found);
};

kpxcPassword.createIcon = function(field) {
    const className = (isFirefox() ? 'key-moz' : 'key');
    const size = (field.offsetHeight > 28) ? 24 : 16;
    let offset = Math.floor((field.offsetHeight - size) / 3);
    offset = (offset < 0) ? 0 : offset;

    const icon = kpxcUI.createElement('div', 'kpxc kpxc-genpw-icon ' + className,
        {'title': 'Generate password', 'size': size, 'offset': offset, 'kpxc-genpw-field-id': field.getAttribute('kpxc-id')});
    icon.style.zIndex = '9999';
    icon.style.width = String(size) + 'px';
    icon.style.height = String(size) + 'px';

    icon.addEventListener('click', function(e) {
        e.preventDefault();

        if (!cipFields.isVisible(field)) {
            document.body.removeChild(icon);
            field.removeAttribute('kpxc-password-generator');
            return;
        }

        kpxcPassword.createDialog();
        kpxcPassword.openDialog();
       
        // Adjust the dialog location
        if (kpxcPassword.dialog) {
            kpxcPassword.dialog.style.top = String(icon.offsetTop + icon.offsetHeight) + 'px';
            kpxcPassword.dialog.style.left = icon.style.left;

            kpxcPassword.dialog.setAttribute('kpxc-genpw-field-id', field.getAttribute('kpxc-id'));
            kpxcPassword.dialog.setAttribute('kpxc-genpw-next-field-id', field.getAttribute('kpxc-genpw-next-field-id'));
            kpxcPassword.dialog.setAttribute('kpxc-genpw-next-is-password-field', field.getAttribute('kpxc-genpw-next-is-password-field'));

            const fieldExists = Boolean(field.getAttribute('kpxc-genpw-next-field-exists'));
            let checkbox = $('kpxc-genpw-checkbox-next-field');
            if (checkbox) {
                checkbox.setAttribute('checked', fieldExists);
                checkbox.setAttribute('disabled', !fieldExists);
            }
        }
    });

    kpxcPassword.setIconPosition(icon, field);
    
    kpxcPassword.observedIcons.push(icon);
    document.body.appendChild(icon);
};

kpxcPassword.setIconPosition = function(icon, field) {
    const rect = field.getBoundingClientRect();
    const offset = Number(icon.getAttribute('offset'));
    const size = Number(icon.getAttribute('size'));
   
    icon.style.top = String((rect.top + document.body.scrollTop) + offset + 1) + 'px';
    icon.style.left = String((rect.left + document.body.scrollLeft) + field.offsetWidth - size - offset) + 'px';
};

kpxcPassword.createDialog = function() {
    if (kpxcPassword.created) {
        return;
    }
    kpxcPassword.created = true;    

    const dialog = kpxcUI.createElement('div', 'kpxc');
    const container = kpxcUI.createElement('div', 'w3-container');
    const card = kpxcUI.createElement('div', 'w3-card-4 w3-round', {'id': 'kpxc-pw-dialog'});
    card.style.display = 'none';
    card.style.zIndex = '2147483646';

    const titleCellRow = kpxcUI.createElement('div', 'w3-cell-row');
    const firstTitleCell = kpxcUI.createElement('div', 'w3-cell');
    const secondTitleCell = kpxcUI.createElement('div', 'w3-cell w3-center w3-cell-middle', {'id': 'ui-close'});
    const closeButton = kpxcUI.createElement('div', '', {}, 'x');
    closeButton.onclick = function(e) { kpxcPassword.openDialog(); };

    const titleBar = kpxcUI.createElement('header', 'w3-green w3-padding-small w3-small w3-bold',
        {'id': 'ui-titlebar'}, 'Password Generator');
    firstTitleCell.append(titleBar);
    secondTitleCell.append(closeButton);
    titleCellRow.append(firstTitleCell);
    titleCellRow.append(secondTitleCell);

    const inputs = kpxcUI.createElement('div', 'w3-small w3-padding-small');
    const input = kpxcUI.createElement('input', 'w3-input w3-border w3-round-small w3-tiny',
        {'id': 'kpxc-genpw-textfield-password', 'placeholder': 'Generated password', 'type': 'text'});
    inputs.append(input);

    const cellRow = kpxcUI.createElement('div', 'w3-cell-row');
    const firstCell = kpxcUI.createElement('div', 'w3-cell');
    const checkboxInput = kpxcUI.createElement('input', 'w3-check kpxc-genpw-checkbox',
        {'id': 'kpxc-genpw-checkbox-next-field', 'disabled': 'disabled', 'type': 'checkbox'});
    firstCell.append(checkboxInput);

    const checkboxLabel = kpxcUI.createElement('label', 'kpxc-genpw-label w3-tiny', {}, 'also fill in the next password-field');
    firstCell.append(checkboxLabel);

    const secondCell = kpxcUI.createElement('div', 'w3-cell w3-cell-top');
    const bitDiv = kpxcUI.createElement('div', 'w3-right-align w3-text-gray w3-tiny',
        {'id': 'kpxc-genpw-quality'}, '??? Bits');
    secondCell.append(bitDiv);

    cellRow.append(firstCell);
    cellRow.append(secondCell);
    inputs.append(cellRow);

    const buttonStyle = 'w3-btn w3-white w3-border w3-round w3-tiny';
    const buttons = kpxcUI.createElement('div', 'w3-container w3-bar w3-center');
    const generateButton = kpxcUI.createElement('button', buttonStyle, {'id': 'kpxc-genpw-btn-generate'}, 'Generate');
    const copyButton = kpxcUI.createElement('button', buttonStyle, {'id': 'kpxc-genpw-btn-clipboard'}, 'Copy');
    const fillButton = kpxcUI.createElement('button', buttonStyle, {'id': 'kpxc-genpw-btn-fillin'}, 'Fill &amp; copy');

    generateButton.onclick = function(e) { kpxcPassword.generate(e); };
    copyButton.onclick = function(e) { kpxcPassword.copy(e); };
    fillButton.onclick = function(e) { kpxcPassword.fill(e); };

    buttons.append(generateButton);
    buttons.append(copyButton);
    buttons.append(fillButton);

    card.append(titleCellRow);
    card.append(inputs);
    card.append(buttons);

    container.append(card);
    dialog.append(container);
    document.body.append(dialog);

    kpxcPassword.dialog = $('kpxc-pw-dialog');
    kpxcPassword.titleBar = $('ui-titlebar');
    kpxcPassword.titleBar.onmousedown = function(e) { kpxcPassword.mouseDown(e) };

    kpxcPassword.generate();
};

kpxcPassword.mouseDown = function(e) {
    kpxcPassword.selected = kpxcPassword.titleBar;
    kpxcPassword.startPosX = e.clientX;
    kpxcPassword.startPosY = e.clientY;
    kpxcPassword.diffX = kpxcPassword.startPosX - kpxcPassword.dialog.offsetLeft;
    kpxcPassword.diffY = kpxcPassword.startPosY - kpxcPassword.dialog.offsetTop;
    return false;
};

document.onclick = function(e) {
    // TODO (closes the dialog when clicked outside of it)
    /*if (kpxcPassword.dialog.style.display !== 'none') {

        //console.log('click pos x: ' + e.clientX + ', y: ' + e.clientY);

        const dialogEndX = kpxcPassword.dialog.offsetLeft + kpxcPassword.dialog.offsetWidth;
        //console.log('dialogStartX: ' + dialog.offsetLeft + ', dialogEndX: ' + dialogEndX);

        const dialogEndY = kpxcPassword.dialog.offsetTop + kpxcPassword.dialog.offsetHeight;
        //console.log('dialogStartY: ' + dialog.offsetTop + ' dialogEndY: ' + dialogEndY);

        if ((e.clientX < kpxcPassword.dialog.offsetLeft || e.clientX > dialogEndX) || (e.clientY < kpxcPassword.dialog.offsetTop || e.clientY > dialogEndY)) {
            //kpxcPassword.openDialog();
        }
    }*/
};

kpxcPassword.openDialog = function() {
    kpxcPassword.dialog.style.display = kpxcPassword.dialog.style.display === 'none' ? 'block' : 'none';
};

kpxcPassword.generate = function(e) {
    if (e) {
        e.preventDefault();
    }

    browser.runtime.sendMessage({
        action: 'generate_password'
    }).then(kpxcPassword.callbackGeneratedPassword).catch((e) => {
        console.log(e);
    });
};

kpxcPassword.copy = function(e) {
    e.preventDefault();
    if (kpxcPassword.copyPasswordToClipboard()) {
        kpxcPassword.greenButton('kpxc-genpw-btn-clipboard');
        kpxcPassword.whiteButton('kpxc-genpw-btn-fillin');
    }
};

kpxcPassword.fill = function(e) {
    e.preventDefault();

    let field = null;
    const inputs = document.querySelectorAll('input[type=\'password\']');
    for (const i of inputs) {
        if (i.getAttribute('data-kpxc-id')) {
            field = i;
            break;
        }
    }

    if (field) {
        let password = $('kpxc-genpw-textfield-password');
        if (field.getAttribute('maxlength')) {
            if (password.value.length > field.getAttribute('maxlength')) {
                const message = 'Error:\nThe generated password is longer than the allowed length!';
                browser.runtime.sendMessage({
                    action: 'show_notification',
                    args: [message]
                });
                return;
            }
        }

        field.value = password.value;
        if ($('kpxc-genpw-checkbox-next-field').checked) {
            if (field.getAttribute('kpxc-genpw-checkbox-next-field')) {
                const nextFieldId = field.getAttribute('kpxc-genpw-next-field-id');
                const nextFields = document.querySelectorAll('input[data-kpxc-id=\''+nextFieldId+'\']');
                if (nextFields) {
                    nextFields[0].value = password.value;
                }
            }
        }

        if (kpxcPassword.copyPasswordToClipboard()) {
            kpxcPassword.greenButton('kpxc-genpw-btn-fillin');
            kpxcPassword.whiteButton('kpxc-genpw-btn-clipboard');
        }
    }
};

kpxcPassword.copyPasswordToClipboard = function() {
    $('kpxc-genpw-textfield-password').select();
    try {
        return document.execCommand('copy');
    }
    catch (err) {
        console.log('Could not copy password to clipboard: ' + err);
    }
    return false;
};

kpxcPassword.callbackGeneratedPassword = function(entries) {
    if (entries && entries.length >= 1) {
        const errorMessage = $('kpxc-genpw-error');
        if (errorMessage) {
            kpxcPassword.enableButtons();

            $('kpxc-genpw-checkbox-next-field').parentElement.style.display = 'block';
            $('kpxc-genpw-quality').style.display = 'block';

            const input = $('kpxc-genpw-textfield-password');
            input.style.display = 'block';
            errorMessage.remove();
        }

        kpxcPassword.whiteButton('kpxc-genpw-btn-fillin');
        kpxcPassword.whiteButton('kpxc-genpw-btn-clipboard');
        $('kpxc-genpw-textfield-password').value = entries[0].password;
        $('kpxc-genpw-quality').textContent = isNaN(entries[0].login) ? '??? Bits' : entries[0].login + ' Bits';
    } else {
        if (document.querySelectorAll('div#kpxc-genpw-error').length === 0) {
            $('kpxc-genpw-checkbox-next-field').parentElement.style.display = 'none';
            $('kpxc-genpw-quality').style.display = 'none';

            const input = $('kpxc-genpw-textfield-password');
            input.style.display = 'none';

            const errorMessage = kpxcUI.createElement('div', 'w3-center', {'id': 'kpxc-genpw-error'}, 'Cannot receive generated password.<br />Is KeePassXC or database opened?<br />');
            input.parentElement.append(errorMessage);

            kpxcPassword.disableButtons();
        }
    }
};

kpxcPassword.onRequestPassword = function() {
    browser.runtime.sendMessage({
        action: 'generate_password'
    }).then(kpxcPassword.callbackGeneratedPassword);
};

kpxcPassword.checkObservedElements = function() {
    if (kpxcPassword.observingLock) {
        return;
    }

    kpxcPassword.observingLock = true;
    kpxcPassword.observedIcons.forEach(function(iconField, index) {
        if (iconField && iconField.length === 1) {
            const fieldId = iconField.getAttribute('kpxc-genpw-field-id');
            const fields = document.querySelectorAll('input[data-kpxc-id=\''+fieldId+'\']');
            const field = fields.length > 0 ? fields[0] : null;
            if (!field || field.length !== 1) {
                iconField.remove();
                kpxcPassword.observedIcons.splice(index, 1);
            }
            else if (!cipFields.isVisible(field)) {
                iconField.hide();
            }
            else if (cipFields.isVisible(field)) {
                iconField.show();
                kpxcPassword.setIconPosition(iconField, field);
                field.setAttribute('kpxc-password-generator', true);
            }
        } else {
            kpxcPassword.observedIcons.splice(index, 1);
        }
    });
    kpxcPassword.observingLock = false;
};

kpxcPassword.greenButton = function(button) {
    $(button).classList.remove('w3-white');
    $(button).classList.add('w3-green');
};

kpxcPassword.whiteButton = function(button) {
    $(button).classList.remove('w3-green');
    $(button).classList.add('w3-white');
};

kpxcPassword.enableButtons = function() {
    $('kpxc-genpw-btn-generate').innerHTML = 'Generate';
    $('kpxc-genpw-btn-clipboard').style.display = 'inline-block';
    $('kpxc-genpw-btn-fillin').style.display = 'inline-block';
};

kpxcPassword.disableButtons = function() {
    $('kpxc-genpw-btn-generate').innerHTML = 'Try again';
    $('kpxc-genpw-btn-clipboard').style.display = 'none';
    $('kpxc-genpw-btn-fillin').style.display = 'none';
};
