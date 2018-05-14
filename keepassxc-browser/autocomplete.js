'use strict'

var kpxcAutocomplete = {};
kpxcAutocomplete.elements = [];
const keyCode = {};
keyCode.BACKSPACE = 8;
keyCode.ENTER = 13;
keyCode.ESC = 27;
keyCode.UP = 38;
keyCode.DOWN = 40;

kpxcAutocomplete.create = function(input) {
    let _index = -1;

    input.addEventListener('click', function(e) {
        if (input.value !== '') {
            input.select();
        }
        showList(input);
    });

    input.addEventListener('keydown', keyDown);

    function showList(input) {
        closeList();
        const div = kpxcUI.createElement('div', 'kpxcAutocomplete-items', {'id': 'kpxcAutocomplete-list'});

        // Element position
        const rect = input.getBoundingClientRect();
        div.style.top = String((rect.top + document.body.scrollTop) + input.offsetHeight) + 'px';
        div.style.left = String((rect.left + document.body.scrollLeft)) + 'px';
        div.style.minWidth = String(input.offsetWidth) + 'px';
        document.body.append(div);

        for (const c of kpxcAutocomplete.elements) {
            const item = document.createElement('div');
            item.innerHTML += c.label;
            item.innerHTML += '<input type=\"hidden\" value=\"' + c.value + '\">';
            item.addEventListener('click', function(e) {
                input.value = this.getElementsByTagName('input')[0].value;
                fillPassword(input.value);
                closeList();
            });

            // These events prevent the double hover effect if both keyboard and mouse are used
            item.addEventListener('mouseover', function(e) {
                removeItem(getAllItems());
                item.classList.add('kpxcAutocomplete-active');
                _index = Array.from(div.childNodes).indexOf(item);
            });
            item.addEventListener('mouseout', function(e) {
                item.classList.remove('kpxcAutocomplete-active');
            });

            div.appendChild(item);
        }
    };

    function activateItem(item) {
        if (!item) {
            return;
        }

        removeItem(item);
        if (_index >= item.length) {
            _index = 0;
        }

        if (_index < 0) {
            _index = item.length - 1;
        }

        if (item[_index] !== undefined) {
            item[_index].classList.add('kpxcAutocomplete-active');
        }
    };

    function removeItem(items) {
        for (const item of items) {
            item.classList.remove('kpxcAutocomplete-active');
        }
    };

    function closeList(elem) {
        const items = document.getElementsByClassName('kpxcAutocomplete-items');
        for (const item of items) {
            if (elem !== item && input) {
                item.parentNode.removeChild(item);
            }
        }
    };

    function getAllItems() {
        const list = document.getElementById('kpxcAutocomplete-list');
        if (!list) {
            return [];
        }
        return list.getElementsByTagName('div');
    };

    function keyDown(e) {
        const item = getAllItems();
        if (e.keyCode === keyCode.DOWN) {
            ++_index;
            activateItem(item);
        } else if (e.keyCode === keyCode.UP) {
             --_index;
            activateItem(item);
        } else if (e.keyCode === keyCode.ENTER) {
            if (input.value === '') {
                e.preventDefault();
            }

            if (_index >= 0 && item && item[_index] !== undefined) {
                item[_index].click();
            }
        } else if (e.keyCode === keyCode.ESC) {
            closeList();
        } else if (e.keyCode === keyCode.BACKSPACE && input.value === '') {
            // Show menu when input field has no value and backspace is pressed
            _index = -1;
            showList(input);
        }
    };

    function fillPassword(value) {
        const fieldId = input.getAttribute('data-kpxc-id');
        cipFields.prepareId(fieldId);
        const combination = cipFields.getCombination('username', fieldId);

        combination.loginId = fieldId;
        _loginId = fieldId;

        cip.fillInCredentials(combination, true, false);
        input.setAttribute('fetched', true);
    };

    // Detect click outside autocomplete
    document.addEventListener('click', function(e) {
        const list = document.getElementById('kpxcAutocomplete-list');
        if (!list) {
            return;
        }

        if (e.target !== input) {
            closeList(e.target);
        }
    });
};