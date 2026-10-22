/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageBugsGetReadyHandler: () => (/* binding */ pageBugsGetReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_tags__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);



function pageBugsGetReadyHandler () {
    const objectId = $('#object_pk').data('pk')
    const permRemoveTag = $('#object_pk').data('perm-remove-tag') === 'True'

    // bind everything in tags table
    ;(0,_static_js_tags__WEBPACK_IMPORTED_MODULE_0__.tagsCard)('Bug', objectId, { bugs: objectId }, permRemoveTag)

    // executions tree view
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.treeViewBind)()
}


/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addTag: () => (/* binding */ addTag),
/* harmony export */   tagsCard: () => (/* binding */ tagsCard)
/* harmony export */ });
/* harmony import */ var _jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);



/*
    Applies tag to the chosen model

    @model - string - model name which accepts tags. There must
        be a 'MM.add_tag' RPC function for this to work!
    @objectId - int - PK of the object that will be tagged
    @tagInput - jQuery object - usually an <input> element which
        provides the value used for tagging
    @toTable - DataTable object - the table which displays the results
*/
function addTag (model, objectId, tagInput, toTable) {
    const tagName = tagInput.value

    if (tagName.length > 0) {
        (0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(model + '.add_tag', [objectId, tagName], function (data) {
            toTable.row.add({ name: tagName }).draw()
            $(tagInput).val('')
        })
    }
}

/*
    Displays the tags table inside a card and binds all buttons
    and actions for it.

    @model - string - model name which accepts tags. There must
        be a 'MM.add_tag' RPC function for this to work!
    @objectId - int - PK of the object that will be tagged
    @displayFilter - dict - passed directly to `Tag.filter` to display
        tags for @objectId
    @permRemove - bool - if we have permission to remove tags

*/
function tagsCard (model, objectId, displayFilter, permRemove) {
    // load the tags table
    const tagsTable = $('#tags').DataTable({
        ajax: function (data, callbackF, settings) {
            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.dataTableJsonRPC)('Tag.filter', displayFilter, callbackF, function (data, callback) {
                // b/c tags are now annotated with case, run, plan IDs there are duplicate names.
                // Filter them out by only looking at Tag.id uniqueness!
                data = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.arrayToDict)(data)
                callbackF({ data: Object.values(data) })
            })
        },
        columns: [
            { data: 'name' },
            {
                data: null,
                sortable: false,
                render: function (data, type, full, meta) {
                    if (permRemove) {
                        return '<a href="#tags" class="remove-tag" data-name="' + data.name + '"><span class="pficon-error-circle-o hidden-print"></span></a>'
                    }
                    return ''
                }
            }
        ],
        dom: 't',
        // show all tags b/c the pager & info controls are hidden by dom:'t'
        // and PatternFly 3 defaults DataTables to 20 rows per page
        paging: false,
        language: {
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            zeroRecords: 'No records found'
        },
        order: [[0, 'asc']]
    })

    // remove tags button
    tagsTable.on('draw', function () {
        $('.remove-tag').off('click')
        $('.remove-tag').click(function () {
            const tr = $(this).parents('tr')

            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(model + '.remove_tag', [objectId, $(this).data('name')], function (data) {
                tagsTable.row($(tr)).remove().draw()
            })
        })
    })

    // add tag button and Enter key
    $('#add-tag').click(function () {
        addTag(model, objectId, $('#id_tags')[0], tagsTable)
    })

    $('#id_tags').keyup(function (event) {
        if (event.keyCode === 13) {
            addTag(model, objectId, $('#id_tags')[0], tagsTable)
        };
    })

    // tag autocomplete
    $('#id_tags.typeahead').typeahead({
        minLength: 3,
        highlight: true
    }, {
        name: 'tags-autocomplete',
        // will display up to X results even if more were returned
        limit: 100,
        async: true,
        display: function (element) {
            return element.name
        },
        source: function (query, processSync, processAsync) {
            (0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Tag.filter', { name__icontains: query }, function (data) {
                // b/c tags are now annotated with case, run, plan IDs there are duplicate names.
                // Filter them out by only looking at Tag.id uniqueness!
                data = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.arrayToDict)(data)
                return processAsync(Object.values(data))
            })
        }
    })
}


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   dataTableJsonRPC: () => (/* binding */ dataTableJsonRPC),
/* harmony export */   jsonRPC: () => (/* binding */ jsonRPC),
/* harmony export */   testCaseSummaryAutoComplete: () => (/* binding */ testCaseSummaryAutoComplete),
/* harmony export */   testPlanAutoComplete: () => (/* binding */ testPlanAutoComplete)
/* harmony export */ });
// JSON-RPC client inspired by
// https://stackoverflow.com/questions/8147211/jquery-jsonrpc-2-0-call-via-ajax-gets-correct-response-but-does-not-work
function jsonRPC (rpcMethod, rpcParams, callback, isSync, errorCallback) {
    // .filter() args are passed as dictionary but other args,
    // e.g. for .add_tag() are passed as a list of positional values
    if (!Array.isArray(rpcParams)) {
        rpcParams = [rpcParams]
    }

    $.ajax({
        url: '/json-rpc/',
        async: isSync !== true,
        data: JSON.stringify({
            jsonrpc: '2.0',
            method: rpcMethod,
            params: rpcParams,
            id: 'jsonrpc'
        }), // id is needed !!
        // see "Request object" at https://www.jsonrpc.org/specification
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        success: function (result) {
            if (result.error) {
                if (errorCallback) {
                    errorCallback(result.error.message)
                } else {
                    alert(result.error.message)
                }
            } else {
                callback(result.result)
            }
        },
        error: function (err, status, thrown) {
            console.log('*** jsonRPC ERROR: ' + err + ' STATUS: ' + status + ' ' + thrown)

            if (errorCallback) {
                errorCallback(thrown || status)
            }
        }
    })
}

// used by DataTables to convert a list of objects to a dict
// suitable for loading data into the table
function dataTableJsonRPC (rpcMethod, rpcParams, callbackF, preProcessData) {
    const internalCallback = function (data) {
    // used to collect additional information about columns via ForeignKeys
        if (preProcessData !== undefined) {
            preProcessData(data, callbackF)
        } else {
            callbackF({ data })
        }
    }

    jsonRPC(rpcMethod, rpcParams, internalCallback)
}

function testPlanAutoComplete (selector, planCache) {
    $(`${selector}.typeahead`).typeahead({
        minLength: 1,
        highlight: true
    }, {
        name: 'plans-autocomplete',
        // will display up to X results even if more were returned
        limit: 100,
        async: true,
        display: function (element) {
            const displayName = 'TP-' + element.id + ': ' + element.name
            planCache[displayName] = element
            return displayName
        },
        source: function (query, processSync, processAsync) {
            // accepts "TP-1234" or "tp-1234" or "1234"
            query = query.toLowerCase().replace('tp-', '')
            if (query === '') {
                return
            }

            let rpcQuery = { pk: query }

            // or arbitrary string
            if (isNaN(query)) {
                if (query.length >= 3) {
                    rpcQuery = { name__icontains: query }
                } else {
                    return
                }
            }

            jsonRPC('TestPlan.filter', rpcQuery, function (data) {
                return processAsync(data)
            })
        }
    })
}

function testCaseSummaryAutoComplete (selector) {
    function openTestCase ($suggestion) {
        const suggestion = $suggestion.data('tt-selectable-object')
        window.open(`/case/${suggestion.id}/`, '_blank')
        input.typeahead('close')
    }

    const input = $(`${selector}.typeahead`)
    if (input.length === 0) {
        return
    }

    // remember exactly what the user typed so that navigating the suggestions
    // with the keyboard never replaces it
    let typed = input.val() || ''
    input.on('input', function () {
        typed = this.value
    }).on('keydown', function (event) {
        // Enter opens the highlighted suggestion instead of submitting the form
        if (event.key !== 'Enter') {
            return
        }

        const active = wrapper.find('.tt-suggestion.tt-cursor').first()
        if (active.length) {
            event.preventDefault()
            openTestCase(active)
        }
    }).typeahead({
        minLength: 3,
        highlight: true
    }, {
        name: 'testcase-summaries-autocomplete',
        limit: 10,
        async: true,
        display: function (element) {
            return `TC-${element.id}: ${element.summary}`
        },
        source: function (query, processSync, processAsync) {
            jsonRPC('TestCase.filter', { summary__icontains: query }, function (data) {
                return processAsync(data)
            })
        }
    }).on('typeahead:beforeselect', function (event) {
        // selecting a suggestion must not replace the typed summary
        event.preventDefault()
    }).on('typeahead:beforeautocomplete', function (event) {
        // Tab or the right-arrow key must not insert a suggestion
        event.preventDefault()
    }).on('typeahead:cursorchange', function () {
        // Up/Down move the highlight but keep the typed summary
        $(this).val(typed)
    })

    // override the default inline-block style
    const wrapper = input.closest('span.twitter-typeahead')
    wrapper.css('display', 'block')
    wrapper.find('.tt-menu').css('width', '100%')

    // clicking a suggestion opens the existing test case in a new window
    wrapper.on('click', '.tt-suggestion', function () {
        openTestCase($(this))
    })

    // clicking outside of the input & dropdown closes the menu
    $(document).on('click', function (event) {
        if (!wrapper.is(event.target) && wrapper.has(event.target).length === 0) {
            input.typeahead('close')
        }
    })
}


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   advancedSearchAndAddTestCases: () => (/* binding */ advancedSearchAndAddTestCases),
/* harmony export */   animate: () => (/* binding */ animate),
/* harmony export */   arrayToDict: () => (/* binding */ arrayToDict),
/* harmony export */   bindDeleteCommentButton: () => (/* binding */ bindDeleteCommentButton),
/* harmony export */   changeDropdownSelectedItem: () => (/* binding */ changeDropdownSelectedItem),
/* harmony export */   currentTimeWithTimezone: () => (/* binding */ currentTimeWithTimezone),
/* harmony export */   discoverNestedTestPlans: () => (/* binding */ discoverNestedTestPlans),
/* harmony export */   escapeHTML: () => (/* binding */ escapeHTML),
/* harmony export */   findSelectorsToShowAndHide: () => (/* binding */ findSelectorsToShowAndHide),
/* harmony export */   findSelectorsToShowAndHideFromAPIData: () => (/* binding */ findSelectorsToShowAndHideFromAPIData),
/* harmony export */   markdown2HTML: () => (/* binding */ markdown2HTML),
/* harmony export */   populateBuild: () => (/* binding */ populateBuild),
/* harmony export */   populateVersion: () => (/* binding */ populateVersion),
/* harmony export */   quickSearchAndAddTestCase: () => (/* binding */ quickSearchAndAddTestCase),
/* harmony export */   renderCommentHTML: () => (/* binding */ renderCommentHTML),
/* harmony export */   renderCommentsForObject: () => (/* binding */ renderCommentsForObject),
/* harmony export */   selectedVisibleCheckboxes: () => (/* binding */ selectedVisibleCheckboxes),
/* harmony export */   showOrHideMultipleRows: () => (/* binding */ showOrHideMultipleRows),
/* harmony export */   showPopup: () => (/* binding */ showPopup),
/* harmony export */   splitByComma: () => (/* binding */ splitByComma),
/* harmony export */   treeViewBind: () => (/* binding */ treeViewBind),
/* harmony export */   unescapeHTML: () => (/* binding */ unescapeHTML),
/* harmony export */   updateBuildSelectFromVersion: () => (/* binding */ updateBuildSelectFromVersion),
/* harmony export */   updateCategorySelectFromProduct: () => (/* binding */ updateCategorySelectFromProduct),
/* harmony export */   updateComponentSelectFromProduct: () => (/* binding */ updateComponentSelectFromProduct),
/* harmony export */   updateParamsToSearchTags: () => (/* binding */ updateParamsToSearchTags),
/* harmony export */   updateSelect: () => (/* binding */ updateSelect),
/* harmony export */   updateTestPlanSelectFromProduct: () => (/* binding */ updateTestPlanSelectFromProduct),
/* harmony export */   updateVersionSelectFromProduct: () => (/* binding */ updateVersionSelectFromProduct)
/* harmony export */ });
/* harmony import */ var _jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);


/*
    Used to update a select when something else changes.
*/
function updateSelect (data, selector, idAttr, valueAttr, groupAttr) {
    const _selectTag = $(selector)[0]
    let newOptions = ''
    let currentGroup = ''
    const isMultiple = _selectTag.attributes.getNamedItem('multiple') !== null

    // in some cases using single select, the 1st <option> element is ---
    // which must always be there to indicate nothing selected
    if (!isMultiple && _selectTag.options.length) {
        newOptions = _selectTag.options[0].outerHTML
    }

    data.forEach(function (element) {
        if (isMultiple && groupAttr != null && currentGroup !== element[groupAttr]) {
            if (currentGroup !== '') {
                // for all but the first time group changes, add a closing optgroup tag
                newOptions += '</optgroup>'
            }
            newOptions += '<optgroup label="' + element[groupAttr] + '">'
            currentGroup = element[groupAttr]
        }

        newOptions += '<option value="' + element[idAttr] + '">' + element[valueAttr] + '</option>'
    })

    // add a final closing optgroup tag if opening tag present
    if (newOptions.indexOf('optgroup') > -1) {
        newOptions += '</optgroup>'
    }

    _selectTag.innerHTML = newOptions

    if ($('body').selectpicker) {
        $(selector).selectpicker('refresh')
    }
}

/*
    Used for on-change event handlers
*/
function updateVersionSelectFromProduct (idProduct, idVersion) {
    const updateVersionSelectCallback = function (data) {
        updateSelect(data, idVersion, 'id', 'value', 'product__name')

        // trigger on-change handler, possibly updating build
        $(idVersion).change()
    }

    let productIds = $(idProduct).val()

    if (productIds && productIds.length) {
        if (!Array.isArray(productIds)) {
            productIds = [productIds]
        }

        ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Version.filter', { product__in: productIds }, updateVersionSelectCallback)
    } else {
        updateVersionSelectCallback([])
    }
}

function populateVersion (idProduct, idVersion, addIdVersion, addIdBuild) {
    const productId = $(idProduct).val()

    if (productId === null) {
        $(addIdVersion).addClass('disabled')
        $(addIdBuild).addClass('disabled')
    } else {
        $(addIdVersion).removeClass('disabled')
        $(addIdBuild).removeClass('disabled')
    }

    const safeProductId = encodeURIComponent(productId === null ? '' : String(productId))
    const href = $(addIdVersion)[0].href
    $(addIdVersion)[0].href = href.slice(0, href.indexOf('&product'))
    $(addIdVersion)[0].href += `&product=${safeProductId}`
    $(idVersion).find('option').remove()
    updateVersionSelectFromProduct(idProduct, idVersion)
}

/*
    Used for on-change event handlers
*/
function updateBuildSelectFromVersion (keepFirst) {
    const updateCallback = function (data) {
        updateSelect(data, '#id_build', 'id', 'name', 'version__value')
    }

    if (keepFirst === true) {
    // pass
    } else {
        $('#id_build').find('option').remove()
    }

    let versionIds = $('#id_version').val()
    if (versionIds && versionIds.length) {
        if (!Array.isArray(versionIds)) {
            versionIds = [versionIds]
        }

        ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Build.filter', { version__in: versionIds }, updateCallback)
    } else {
        updateCallback([])
    }
}

function populateBuild () {
    const productId = $('#id_product').val()
    const versionId = $('#id_version').val()

    if (versionId === null) {
        $('#add_id_build').addClass('disabled')
    } else {
        $('#add_id_build').removeClass('disabled')
    }

    const safeVersionId = encodeURIComponent(versionId === null ? '' : String(versionId))
    const safeProductId = encodeURIComponent(productId === null ? '' : String(productId))
    const href = $('#add_id_build')[0].href
    $('#add_id_build')[0].href = href.slice(0, href.indexOf('&version'))
    $('#add_id_build')[0].href += `&version=${safeVersionId}&product=${safeProductId}`
    updateBuildSelectFromVersion()
}
/*
    Used for on-change event handlers
*/
function updateCategorySelectFromProduct () {
    const updateCallback = function (data) {
        updateSelect(data, '#id_category', 'id', 'name')
    }

    const productId = $('#id_product').val()
    if (productId) {
        (0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Category.filter', { product: productId }, updateCallback)
    } else {
        updateCallback([])
    }
}

/*
    Used for on-change event handlers
*/
function updateComponentSelectFromProduct () {
    const updateCallback = function (data) {
        data = arrayToDict(data)
        updateSelect(Object.values(data), '#id_component', 'id', 'name')
    }

    const productId = $('#id_product').val()
    if (productId) {
        (0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Component.filter', { product: productId }, updateCallback)
    } else {
        updateCallback([])
    }
}

/*
    Split the input string by comma and return
    a list of trimmed values
*/
function splitByComma (input) {
    const result = []

    input.split(',').forEach(function (element) {
        element = element.trim()
        if (element) {
            result.push(element)
        }
    })
    return result
}

/*
    Given a params dictionary and a selector update
    the dictionary so we can search by tags!
    Used in search.js
*/
function updateParamsToSearchTags (selector, params) {
    const tagList = splitByComma($(selector).val())

    if (tagList.length > 0) {
        params.tag__name__in = tagList
    };
}

/*
    Replaces HTML characters for display in DataTables

    backslash(\), quotes('), double quotes (")
    https://github.com/kiwitcms/Kiwi/issues/78

    angle brackets (<>)
    https://github.com/kiwitcms/Kiwi/issues/234
*/
function escapeHTML (unsafe) {
    return unsafe.replace(/[&<>"']/g, function (m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#039;'
        })[m]
    })
}

function unescapeHTML (html) {
    return html
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, '\'')
    // always keep the ampersand escape last
    // to avoid chain unescape of nested values, see
    // https://github.com/kiwitcms/Kiwi/issues/2800
        .replace(/&amp;/g, '&')
}

function treeViewBind (selector = '.tree-list-view-pf') {
    // collapse all child rows
    $(selector).find('.list-group-item-container').addClass('hidden')

    // unbind previous events b/c this function is now reentrant
    // click the list-view heading then expand a row
    $(selector).find('.list-group-item-header').off('click').click(function (event) {
        if (!$(event.target).is('button, a, input, .fa-ellipsis-v')) {
            const $this = $(this)
            $this.find('.fa-angle-right').toggleClass('fa-angle-down')
            const $itemContainer = $this.siblings('.list-group-item-container')
            if ($itemContainer.children().length) {
                $itemContainer.toggleClass('hidden')
            }
        }
    })
}

function animate (target, handler, time = 500) {
    target.fadeOut(time, handler).fadeIn(time)
}

function currentTimeWithTimezone (timeZone) {
    return moment().tz(timeZone).format('YYYY-MM-DD HH:mm:ss')
}

/* render Markdown & assign it to selector */
function markdown2HTML (input, selector) {
    // first display raw input in case user is not logged in and
    // Markdown.render returns 403 forbidden
    $(selector).html(input)

    ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Markdown.render', unescapeHTML(input), function (result) {
        $(selector).html(unescapeHTML(result))
    })
}

function renderCommentHTML (index, comment, template, bindDeleteFunc) {
    const newNode = $(template.content.cloneNode(true))

    newNode.find('.js-comment-container').attr('data-comment-id', comment.id)
    newNode.find('.index').html(`#${index}`)
    newNode.find('.user').html(comment.user_name)
    newNode.find('.date').html(comment.submit_date)
    markdown2HTML(comment.comment, newNode.find('.comment')[0])

    if (bindDeleteFunc) {
        bindDeleteFunc(newNode)
    }

    return newNode
}

function bindDeleteCommentButton (objId, deleteMethod, canDelete, parentNode) {
    if (canDelete) {
        parentNode.find('.js-comment-delete-btn').click(function (event) {
            const commentId = $(event.target).parents('.js-comment-container').data('comment-id')
            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(deleteMethod, [objId, commentId], function (result) {
                $(event.target).parents('.js-comment-container').hide()
            })

            return false
        })
    } else {
        parentNode.find('.js-comment-delete-btn').hide()
    }
}

function renderCommentsForObject (objId, getMethod, deleteMethod, canDelete, parentNode) {
    parentNode.empty()
    const commentTemplate = $('template#comment-template')[0]

    ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(getMethod, [objId], comments => {
        comments.forEach((comment, index) => parentNode.append(renderCommentHTML(index + 1, comment, commentTemplate)))

        bindDeleteCommentButton(objId, deleteMethod, canDelete, parentNode)
    })
}

function showPopup (href) {
    if (href.indexOf('?') === -1) {
        href += '?nonav=1'
    } else {
        href += '&nonav=1'
    }

    const win = window.open(href, 'popup page', 'width=1024,height=612')
    win.focus()

    return win
}

// used in testplans/get.html and testruns/get.html
// objId - PK of the object we're adding to
// rpcMethod - must accept [pk, case_id] - the method used to do the work
// href - URL of the search page
// errorMessage - message to display in case of RPC errors
function advancedSearchAndAddTestCases (objId, rpcMethod, href, errorMessage) {
    window.addTestCases = function (testCaseIDs, sender) {
        let rpcErrors = 0

        // close the popup
        sender.close()

        if (testCaseIDs) {
            // monkey-patch the alert() function
            const oldAlert = window.alert
            alert = window.alert = function (message) {
                rpcErrors += 1
            }

            // add the selected test cases
            testCaseIDs.forEach(function (testCase) {
                ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(rpcMethod, [objId, testCase], function (result) {}, true)
            })

            // revert monkey-patch
            alert = window.alert = oldAlert
        }

        if (rpcErrors) {
            alert(errorMessage)
        }

        // something was added so reload the page
        if (rpcErrors < testCaseIDs.length) {
            window.location.reload(true)
            // TODO: figure out how to reload above and add the new value to the page
        }
    }

    if (href.indexOf('?') === -1) {
        href += '?allow_select=1'
    } else {
        href += '&allow_select=1'
    }

    showPopup(href)

    return false
}

// used in both testplans/get.html and testruns/get.html to initialize and
// handle the quicksearch widget
// objId - PK of the object we're adding to
// pageCallback - function which performs the actual RPC call of adding
//                the selected TC to objId and refreshes the page
// cache - cache of previous values fetched for typeahead
// initialQuery - an initial RPC query that is AND'ed to the internal conditions
//                for example: filter only CONFIRMED TCs.
function quickSearchAndAddTestCase (objId, pageCallback, cache, initialQuery = {}) {
    // + button
    $('#btn-add-case').click(function () {
        pageCallback(objId)

        return false
    })

    // Enter key
    $('#search-testcase').keyup(function (event) {
        if (event.keyCode === 13) {
            pageCallback(objId)

            return false
        };
    })

    // autocomplete
    $('#search-testcase.typeahead').typeahead({
        minLength: 1,
        highlight: true
    }, {
        name: 'testcases-autocomplete',
        // will display up to X results even if more were returned
        limit: 100,
        async: true,
        display: function (element) {
            const displayName = `TC-${element.id}: ${element.summary}`
            cache[displayName] = element
            return displayName
        },
        source: function (query, processSync, processAsync) {
            // accepts "TC-1234" or "tc-1234" or "1234"
            query = query.toLowerCase().replace('tc-', '')
            if (query === '') {
                return
            }

            let rpcQuery = { pk: query }

            // or arbitrary string
            if (isNaN(query)) {
                if (query.length >= 3) {
                    rpcQuery = { summary__icontains: query }
                } else {
                    return
                }
            }

            // merge initial query for more filtering if specified
            rpcQuery = Object.assign({}, rpcQuery, initialQuery)

            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.filter', rpcQuery, function (data) {
                return processAsync(data)
            })
        }
    })
}

// on dropdown change update the label of the button and set new selected list item
function changeDropdownSelectedItem (dropDownSelector, buttonSelector, target, focusTarget) {
    $(`${buttonSelector}`)[0].innerHTML = target.innerText + '<span class="caret"></span>'

    // remove selected class
    $(`${dropDownSelector} li`).each(function (index, el) {
        el.className = ''
    })

    // target is a tag
    target.parentElement.className = 'selected'

    // close the parent menu
    $(target).parents('.open').toggleClass('open')

    // clear the text & the current filter
    if (focusTarget) {
        focusTarget.val('').keyup().focus()
    }

    // don't follow links
    return false
}

function arrayToDict (arr) {
    return arr.reduce(function (map, obj) {
        map[obj.id] = obj
        return map
    }, {})
}

function updateTestPlanSelectFromProduct (
    extraQuery = {},
    preProcessData = (data, callbackF) => { callbackF(data) }
) {
    const internalCallback = function (data = []) {
        preProcessData(data, (data) => {
            updateSelect(data, '#id_test_plan', 'id', 'name', 'product__name')
        })
    }

    let productIds = $('#id_product').val()

    if (productIds === '') {
        internalCallback()
        return
    } else if (!Array.isArray(productIds)) {
        productIds = [productIds]
    }

    if (!productIds.length) {
        internalCallback()
    } else {
        const query = { product__in: productIds }
        Object.assign(query, extraQuery)
        ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.filter', query, internalCallback)
    }
}

// usage: 'Hello {0}, your order {1} has been shipped.'.format('John', 10001)
function formatString (template, ...args) {
    return template.replace(/{([0-9]+)}/g, function (match, index) {
        return typeof args[index] === 'undefined' ? match : args[index]
    })
}

// returns 2 arrays with selectors that need to be either shown or hidden
// return values will be used as multiple-selector for jQuery
// see https://api.jquery.com/multiple-selector/
function findSelectorsToShowAndHide (inputData, filterBy, filterValue, selectorStr) {
    const hideMe = []
    const showMe = []

    inputData.forEach(function (element) {
        if (element[filterBy] !== undefined && element[filterBy].toString().toLowerCase().indexOf(filterValue) > -1) {
            showMe.push(formatString(selectorStr, element.id))
        } else {
            hideMe.push(formatString(selectorStr, element.id))
        }
    })

    return {
        hide: hideMe,
        show: showMe
    }
}

// similar to the function above, however it operates on API data returned by
// calls to .filter() API methods. Needs all data as input to be able to calculate
// which rows should not be visible
function findSelectorsToShowAndHideFromAPIData (allData, filteredData, selectorStr) {
    const hideMe = []
    const showMe = []

    // these need to be hidden
    const filteredPKs = filteredData.map(element => element.id)
    allData.forEach(element => {
        if (filteredPKs.indexOf(element.id) === -1) {
            hideMe.push(formatString(selectorStr, element.id))
        }
    })

    // these will remain visible
    filteredData.forEach(element => {
        showMe.push(formatString(selectorStr, element.id))
    })

    return {
        hide: hideMe,
        show: showMe
    }
}

// update the screen in one swoop trying to perform
// as little display updates as possible
function showOrHideMultipleRows (rootSelector, rows) {
    // initial state is that everything is hidden

    if (rows.show.length <= rows.hide.length) {
        $(rows.show.join(',')).show()
    } else {
        /* eslint-disable indent */
        $('body')
            .find(rootSelector)
                .show()
            .end()
            .find(rows.hide.join(','))
                .hide()
            .end()
        /* eslint-enable */
    }
}

function selectedVisibleCheckboxes (selector, warningMessage) {
    const selected = $(selector).filter(':checked').filter(':visible')

    if (!selected.length && warningMessage) {
        alert(warningMessage)
    }

    return selected
}

function discoverNestedTestPlans (inputData, callbackF) {
    const prefix = '&nbsp;&nbsp;&nbsp;&nbsp;'
    const result = []

    inputData.forEach((parent) => {
        result.push(parent)

        if (parent.children__count > 0) {
            (0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.tree', parent.id, (children) => {
                children.forEach((child) => {
                    if (child.tree_depth > 0) {
                        child.name = prefix.repeat(child.tree_depth) + child.name
                        // TestPlan.tree() method doesn't return product name!
                        // Also note that entries in the Select are ordered by Product
                        // and if the child has a different product than the parent
                        // that would break the ordering scheme! That's why explicitly
                        // set the value even if it can be a bit inaccurate sometimes.
                        child.product__name = parent.product__name
                        result.push(child)
                    }
                })
            }, true)
        }
    })

    callbackF(result)
}


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageBugsMutableReadyHandler: () => (/* binding */ pageBugsMutableReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);


function pageBugsMutableReadyHandler () {
    $('#add_id_product').click(function () {
        return showRelatedObjectPopup(this)
    })

    $('#add_id_version').click(function () {
        return showRelatedObjectPopup(this)
    })

    $('#add_id_build').click(function () {
        return showRelatedObjectPopup(this)
    })

    $('#add_id_severity').click(function () {
        return showRelatedObjectPopup(this)
    })

    document.getElementById('id_product').onchange = function () {
        $('#id_product').selectpicker('refresh')
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_0__.populateVersion)('#id_product', '#id_version', '#add_id_version', '#add_id_build')
    }

    document.getElementById('id_version').onchange = function () {
        $('#id_version').selectpicker('refresh')
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_0__.populateBuild)()
    }

    document.getElementById('id_build').onchange = function () {
        $('#id_build').selectpicker('refresh')
    }

    document.getElementById('id_severity').onchange = function () {
        $('#id_severity').selectpicker('refresh')
    }

    // initialize at the end b/c we rely on .change() event to initialize builds
    if ($('#id_version').find('option').length === 0) {
        (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_0__.populateVersion)('#id_product', '#id_version', '#add_id_version', '#add_id_build')
    }
}


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageBugsSearchReadyHandler: () => (/* binding */ pageBugsSearchReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4);





function pageBugsSearchReadyHandler () {
    (0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after')

    const table = $('#resultsTable').DataTable({
        pageLength: $('#navbar').data('defaultpagesize'),
        ajax: function (data, callback, settings) {
            const params = {}

            if ($('#id_summary').val()) {
                params.summary__icontains = $('#id_summary').val()
            }

            if ($('#id_severity').val()) {
                params.severity = $('#id_severity').val()
            };

            if ($('#id_product').val()) {
                params.product = $('#id_product').val()
            };

            if ($('#id_version').val()) {
                params.version = $('#id_version').val()
            };

            if ($('#id_build').val()) {
                params.build = $('#id_build').val()
            };

            if ($('#id_reporter').val()) {
                params.reporter__username__startswith = $('#id_reporter').val()
            };

            if ($('#id_assignee').val()) {
                params.assignee__username__startswith = $('#id_assignee').val()
            };

            if ($('#id_before').val()) {
                params.created_at__lte = $('#id_before').data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            if ($('#id_after').val()) {
                params.created_at__gte = $('#id_after').data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            params.status = $('#id_status').is(':checked')

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.dataTableJsonRPC)('Bug.filter', params, callback)
        },
        columns: [
            { data: 'pk' },
            {
                data: null,
                render: function (data, type, full, meta) {
                    if (data.severity__name) {
                        return `<span class="${data.severity__icon}" style="color: ${data.severity__color}"></span> ${data.severity__name}`
                    }

                    return ''
                }
            },
            {
                data: null,
                render: function (data, type, full, meta) {
                    return '<a href="/bugs/' + data.pk + '/" target="_parent">' + (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.escapeHTML)(data.summary) + '</a>'
                }
            },
            { data: 'created_at' },
            { data: 'product__name' },
            { data: 'version__value' },
            { data: 'build__name' },
            { data: 'reporter__username' },
            { data: 'assignee__username' }
        ],
        dom: 'Biptip',
        buttons: _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__.exportButtons,
        language: {
            info: $('#main-element').data('trans-x-records-found'),
            infoEmpty: $('#main-element').data('trans-no-records-found'),
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            thousands: '',
            zeroRecords: $('#main-element').data('trans-no-records-found')
        },
        order: [[0, 'asc']]
    })

    $('#btn_search').click(function () {
        table.ajax.reload()
        return false // so we don't actually send the form
    })

    $('#id_product').change(function () {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateVersionSelectFromProduct)('#id_product', '#id_version')
    })

    $('#id_version').change(function () {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateBuildSelectFromVersion)(true)
    })
}


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initializeDateTimePicker: () => (/* binding */ initializeDateTimePicker)
/* harmony export */ });
function initializeDateTimePicker (selector) {
    $(selector).datetimepicker({
        locale: $('html').attr('lang'),
        format: 'YYYY-MM-DD',
        allowInputToggle: true,
        showTodayButton: true,
        icons: {
            today: 'today-button-pf'
        }
    })
};


/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   exportButtons: () => (/* binding */ exportButtons)
/* harmony export */ });
const exportButtons = [
    {
        extend: 'csv',
        exportOptions: {
            columns: ':visible:not(.noVis)'
        },
        text: '<i class="fa fa-th-list" aria-hidden="true"></i>',
        titleAttr: 'CSV'
    },
    {
        extend: 'excel',
        exportOptions: {
            columns: ':visible:not(.noVis)'
        },
        text: '<i class="fa fa-file-excel-o" aria-hidden="true"></i>',
        titleAttr: 'Excel'
    },
    {
        extend: 'pdf',
        exportOptions: {
            columns: ':visible:not(.noVis)'
        },
        text: '<i class="fa fa-file-pdf-o" aria-hidden="true"></i>',
        titleAttr: 'PDF'
    },
    {
        extend: 'print',
        exportOptions: {
            columns: ':visible:not(.noVis)'
        },
        text: '<i class="fa fa-print" aria-hidden="true"></i>',
        titleAttr: 'Print'
    },
    {
        extend: 'colvis',
        collectionLayout: 'fixed columns',
        columns: ':not(.noVis)',
        text: '<i class="fa fa-eye" aria-hidden="true"></i>',
        titleAttr: 'Column visibility'
    }
]


/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestcasesGetReadyHandler: () => (/* binding */ pageTestcasesGetReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_bugs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(10);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _static_js_properties__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(11);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4);
/* harmony import */ var _static_js_tags__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2);






const planCache = {}

function addComponent (objectId, _input, toTable) {
    const _name = _input.value

    if (_name.length > 0) {
        (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestCase.add_component', [objectId, _name], function (data) {
            if (data !== undefined) {
                toTable.row.add({ name: data.name, id: data.id }).draw()
                $(_input).val('')
            } else {
                $(_input).parents('div.input-group').addClass('has-error')
            }
        })
    }
}

function addTestPlanToTestCase (caseId, plansTable) {
    const planName = $('#input-add-plan')[0].value
    const plan = planCache[planName]

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestPlan.add_case', [plan.id, caseId], function (data) {
        plansTable.row.add({
            id: plan.id,
            name: plan.name,
            author__username: plan.author__username,
            type__name: plan.type__name,
            product__name: plan.product__name
        }).draw()
        $('#input-add-plan').val('')
    })
}

function initAddPlan (caseId, plansTable) {
    // + button
    $('#btn-add-plan').click(function () {
        addTestPlanToTestCase(caseId, plansTable)
    })

    // Enter key
    $('#input-add-plan').keyup(function (event) {
        if (event.keyCode === 13) {
            addTestPlanToTestCase(caseId, plansTable)
        };
    })

    // autocomplete
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.testPlanAutoComplete)('#input-add-plan', planCache)
}

function pageTestcasesGetReadyHandler () {
    const caseId = $('#test_case_pk').data('pk')
    const productId = $('#product_pk').data('pk')
    const permRemoveTag = $('#test_case_pk').data('perm-remove-tag') === 'True'
    const permRemoveComponent = $('#test_case_pk').data('perm-remove-component') === 'True'
    const permRemovePlan = $('#test_case_pk').data('perm-remove-plan') === 'True'

    ;(0,_static_js_properties__WEBPACK_IMPORTED_MODULE_2__.propertiesCard)(caseId, 'case', 'TestCase.properties', 'TestCase.add_property', 'TestCase.remove_property')

    // bind everything in tags table
    ;(0,_static_js_tags__WEBPACK_IMPORTED_MODULE_4__.tagsCard)('TestCase', caseId, { case: caseId }, permRemoveTag)

    // components table
    const componentsTable = $('#components').DataTable({
        ajax: function (data, callback, settings) {
            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.dataTableJsonRPC)('Component.filter', [{ cases: caseId }], callback)
        },
        columns: [
            { data: 'name' },
            {
                data: 'id',
                sortable: false,
                render: function (data, type, full, meta) {
                    if (permRemoveComponent) {
                        return '<a href="#components" class="remove-component" data-pk="' + data + '"><span class="pficon-error-circle-o"></span></a>'
                    }
                    return ''
                }
            }
        ],
        dom: 't',
        language: {
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            zeroRecords: 'No records found'
        },
        order: [[0, 'asc']]
    })

    // remove component button
    componentsTable.on('draw', function () {
        $('.remove-component').off('click')
        $('.remove-component').click(function () {
            const tr = $(this).parents('tr')

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestCase.remove_component', [caseId, $(this).data('pk')], function (data) {
                componentsTable.row($(tr)).remove().draw()
            })
        })
    })

    // add component button and Enter key
    $('#add-component').click(function () {
        addComponent(caseId, $('#id_components')[0], componentsTable)
    })

    $('#id_components').keyup(function (event) {
        if (event.keyCode === 13) {
            addComponent(caseId, $('#id_components')[0], componentsTable)
        };
    })

    // components autocomplete
    $('#id_components.typeahead').typeahead({
        minLength: 3,
        highlight: true
    }, {
        name: 'components-autocomplete',
        // will display up to X results even if more were returned
        limit: 100,
        async: true,
        display: function (element) {
            return element.name
        },
        source: function (query, processSync, processAsync) {
            (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Component.filter', { name__icontains: query, product: productId }, function (data) {
                data = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.arrayToDict)(data)
                return processAsync(Object.values(data))
            })
        }
    })

    // testplans table
    const plansTable = $('#plans').DataTable({
        ajax: function (data, callback, settings) {
            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.dataTableJsonRPC)('TestPlan.filter', { cases: caseId }, callback)
        },
        columns: [
            { data: 'id' },
            {
                data: null,
                render: function (data, type, full, meta) {
                    return '<a href="/plan/' + data.id + '/">' + (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.escapeHTML)(data.name) + '</a>'
                }
            },
            { data: 'author__username' },
            { data: 'type__name' },
            { data: 'product__name' },
            {
                data: null,
                sortable: false,
                render: function (data, type, full, meta) {
                    if (permRemovePlan) {
                        return '<a href="#plans" class="remove-plan" data-pk="' + data.id + '"><span class="pficon-error-circle-o"></span></a>'
                    }
                    return ''
                }
            }
        ],
        dom: 't',
        language: {
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            zeroRecords: 'No records found'
        },
        order: [[0, 'asc']]
    })

    // remove plan button
    plansTable.on('draw', function () {
        $('.remove-plan').off('click')
        $('.remove-plan').click(function () {
            const tr = $(this).parents('tr')

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestPlan.remove_case', [$(this).data('pk'), caseId], function (data) {
                plansTable.row($(tr)).remove().draw()
            })
        })
    })

    // bind add TP to TC widget
    initAddPlan(caseId, plansTable)

    // bugs table
    ;(0,_static_js_bugs__WEBPACK_IMPORTED_MODULE_0__.loadBugs)('.bugs', {
        execution__case: caseId,
        is_defect: true
    })

    // executions treeview
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.treeViewBind)()
}


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   assignPopoverData: () => (/* binding */ assignPopoverData),
/* harmony export */   fetchBugDetails: () => (/* binding */ fetchBugDetails),
/* harmony export */   loadBugs: () => (/* binding */ loadBugs)
/* harmony export */ });
/* harmony import */ var _jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);


const bugDetailsCache = {}

function loadBugs (selector, filter) {
    const noRecordsFoundText = $('.bugs-table').data('no-records-found-text')

    $(selector).DataTable({
        ajax: (data, callback, settings) => {
            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.dataTableJsonRPC)('TestExecution.get_links', filter, callback)
        },
        columns: [
            {
                data: null,
                render: (data, type, full, meta) => `<a href="${data.url}" class="bug-url">${data.url}</a>`
            },
            {
                data: null,
                render: (data, type, full, meta) => `<a href="#bugs" data-toggle="popover" data-html="true"
                        data-content="undefined" data-trigger="focus" data-placement="top">
                        <span class="fa fa-info-circle"></span>
                        </a>`
            }
        ],
        dom: 't',
        language: {
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            zeroRecords: noRecordsFoundText
        },
        order: [[0, 'asc']]
    })

    $(selector).on('draw.dt', () => {
        $(selector).find('[data-toggle=popover]')
            .popovers()
            .on('show.bs.popover', (element) => {
                fetchBugDetails(
                    $(element.target).parents('tr').find('.bug-url')[0],
                    element.target)
            })
    })

    $('[data-toggle=popover]')
        .popovers()
        .on('show.bs.popover', (element) => {
            fetchBugDetails(
                $(element.target).parents('.list-view-pf-body').find('.bug-url')[0],
                element.target
            )
        })
}

function fetchBugDetails (source, popover, cache = bugDetailsCache) {
    if (source.href in cache) {
        assignPopoverData(source, popover, cache[source.href])
        return
    }

    ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Bug.details', [source.href], data => {
        cache[source.href] = data
        assignPopoverData(source, popover, data)
    }, true)
}

function assignPopoverData (source, popover, data) {
    source.title = data.title
    $(popover).attr('data-original-title', data.title)
    $(popover).attr('data-content', data.description)
}


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addPropertyValue: () => (/* binding */ addPropertyValue),
/* harmony export */   displayProperties: () => (/* binding */ displayProperties),
/* harmony export */   propertiesCard: () => (/* binding */ propertiesCard)
/* harmony export */ });
/* harmony import */ var _jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);



// https://gist.github.com/iperelivskiy/4110988#gistcomment-2697447
// used only to hash strings to get unique IDs for href targets
function funhash (s) {
    let h = 0xdeadbeef
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 2654435761)
    }
    return (h ^ h >>> 16) >>> 0
}

function displayProperties (objectId, objectAttrName, viewMethod, removeMethod) {
    const container = $('#properties-accordion')
    const propertyTemplate = $('#property-fragment')[0].content
    const valueTemplate = $(propertyTemplate).find('template')[0].content
    const shownProperties = []
    let property = null

    const query = {}
    query[objectAttrName] = objectId

    ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(viewMethod, query, data => {
        data.forEach(element => {
            if (!shownProperties.includes(element.name)) {
                property = $(propertyTemplate.cloneNode(true))
                property.find('.js-property-name').html(element.name)

                const collapseId = 'collapse' + funhash(element.name)
                property.find('.js-property-name').attr('href', `#${collapseId}`)
                property.find('.js-panel-collapse').attr('id', collapseId)
                property.find('.js-remove-property').attr(`data-${objectAttrName}_id`, element[objectAttrName])
                property.find('.js-remove-property').attr('data-property-name', element.name)
                property.find('template').remove()

                container.find('.js-insert-here').append(property)
                shownProperties.push(element.name)
            }

            const value = $(valueTemplate.cloneNode(true))
            value.find('.js-property-value').text(element.value)
            value.find('.js-remove-value').attr('data-id', element.id)
            container.find('.js-panel-body').last().append(value)
        })

        $('.js-remove-property').click(function () {
            const sender = $(this)
            const query = { name: sender.data('property-name') }
            query[objectAttrName] = sender.data(`${objectAttrName}_id`)

            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(removeMethod, query, function (data) {
                sender.parents('.panel').first().fadeOut(500)
            }
            )
            return false
        })

        $('.js-remove-value').click(function () {
            const sender = $(this)
            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(removeMethod, { pk: sender.data('id') }, function (data) {
                sender.parent().fadeOut(500)
            })
            return false
        })
    })
}

function addPropertyValue (objectId, objectAttrName, viewMethod, addMethod, removeMethod) {
    const nameValue = $('#property-value-input').val().split('=')

    ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(
        addMethod,
        [objectId, nameValue[0].trim(), nameValue[1].trim()],
        function (data) {
            ;(0,_utils__WEBPACK_IMPORTED_MODULE_1__.animate)($('.js-insert-here'), function () {
                $('#property-value-input').val('')
                $('.js-insert-here').empty()

                displayProperties(objectId, objectAttrName, viewMethod, removeMethod)
            })
        }
    )
}

// binds everything in this card
function propertiesCard (objectId, objectAttrName, viewMethod, addMethod, removeMethod) {
    displayProperties(objectId, objectAttrName, viewMethod, removeMethod)

    $('.js-add-property-value').click(function () {
        addPropertyValue(objectId, objectAttrName, viewMethod, addMethod, removeMethod)
        return false
    })

    $('#property-value-input').keyup(function (event) {
        if (event.keyCode === 13) {
            addPropertyValue(objectId, objectAttrName, viewMethod, addMethod, removeMethod)
        }
    })
}


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestcasesMutableReadyHandler: () => (/* binding */ pageTestcasesMutableReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);



function pageTestcasesMutableReadyHandler () {
    $('#id_template').change(function () {
        window.markdownEditor.codemirror.setValue($(this).val())
    })

    $('#add_id_template').click(function () {
        // note: will not refresh the selected value
        return showRelatedObjectPopup(this)
    })

    if ($('#id_category').find('option').length === 0) {
        populateProductCategory()
    }

    $('#add_id_product').click(function () {
        return showRelatedObjectPopup(this)
    })

    $('#add_id_category').click(function () {
        return showRelatedObjectPopup(this)
    })

    document.getElementById('id_product').onchange = function () {
        $('#id_product').selectpicker('refresh')
        populateProductCategory()
    }

    document.getElementById('id_category').onchange = function () {
        $('#id_category').selectpicker('refresh')
    }

    $('.duration-picker').durationPicker({
        translations: {
            day: $('html').data('trans-day'),
            days: $('html').data('trans-days'),

            hour: $('html').data('trans-hour'),
            hours: $('html').data('trans-hours'),

            minute: $('html').data('trans-minute'),
            minutes: $('html').data('trans-minutes'),

            second: $('html').data('trans-second'),
            seconds: $('html').data('trans-seconds')
        },

        showDays: true,
        showHours: true,
        showMinutes: true,
        showSeconds: true
    })

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.testCaseSummaryAutoComplete)('#id_summary')
}

function populateProductCategory () {
    const productId = $('#id_product').val()

    if (productId === null) {
        $('#add_id_category').addClass('disabled')
    } else {
        $('#add_id_category').removeClass('disabled')
    }

    const safeProductId = encodeURIComponent(productId === null ? '' : String(productId))
    const href = $('#add_id_category')[0].href
    $('#add_id_category')[0].href = href.slice(0, href.indexOf('&product'))
    $('#add_id_category')[0].href += `&product=${safeProductId}`
    $('#id_category').find('option').remove()
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_0__.updateCategorySelectFromProduct)()
}


/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestcasesSearchReadyHandler: () => (/* binding */ pageTestcasesSearchReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4);





function preProcessData (data, callbackF) {
    const caseIds = []
    data.forEach(function (element) {
        caseIds.push(element.id)
    })

    // get tags for all objects
    const tagsPerCase = {}
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Tag.filter', { case__in: caseIds }, function (tags) {
        tags.forEach(function (element) {
            if (tagsPerCase[element.case] === undefined) {
                tagsPerCase[element.case] = []
            }

            // push only if unique
            if (tagsPerCase[element.case].indexOf(element.name) === -1) {
                tagsPerCase[element.case].push(element.name)
            }
        })

        // get components for all objects
        const componentsPerCase = {}
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Component.filter', { cases__in: caseIds }, function (components) {
            components.forEach(function (element) {
                if (componentsPerCase[element.cases] === undefined) {
                    componentsPerCase[element.cases] = []
                }

                // push only if unique
                if (componentsPerCase[element.cases].indexOf(element.name) === -1) {
                    componentsPerCase[element.cases].push(element.name)
                }
            })

            // augment data set with additional info
            data.forEach(function (element) {
                if (element.id in tagsPerCase) {
                    element.tag_names = tagsPerCase[element.id]
                } else {
                    element.tag_names = []
                }

                if (element.id in componentsPerCase) {
                    element.component_names = componentsPerCase[element.id]
                } else {
                    element.component_names = []
                }
            })

            callbackF({ data }) // renders everything
        })
    })
}

function pageTestcasesSearchReadyHandler () {
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after')

    const table = $('#resultsTable').DataTable({
        pageLength: $('#navbar').data('defaultpagesize'),
        ajax: function (data, callbackF, settings) {
            const params = {}

            if ($('#id_summary').val()) {
                params.summary__icontains = $('#id_summary').val()
            }

            if ($('#id_before').val()) {
                params.create_date__lte = $('#id_before').data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            if ($('#id_after').val()) {
                params.create_date__gte = $('#id_after').data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            if ($('#id_product').val() && $('#include_product').is(':checked')) {
                params.category__product = $('#id_product').val()
            };

            if ($('#id_category').val()) {
                params.category = $('#id_category').val()
            };

            if ($('#id_component').val()) {
                params.component = $('#id_component').val()
            };

            if ($('#id_priority').val().length > 0) {
                params.priority__in = $('#id_priority').val()
            };

            if ($('#id_status').val().length > 0) {
                params.case_status__in = $('#id_status').val()
            };

            if ($('#id_author').val()) {
                params.author__username__startswith = $('#id_author').val()
            };

            if ($('#id_default_tester').val()) {
                params.default_tester__username__startswith = $('#id_default_tester').val()
            };

            if ($('#id_run').val()) {
                params.executions__run__in = [$('#id_run').val()]
            };

            const testPlanIds = selectedPlanIds()
            if (testPlanIds.length) {
                params.plan__in = testPlanIds
            }

            if ($('input[name=is_automated]:checked').val() === 'true') {
                params.is_automated = true
            };

            if ($('input[name=is_automated]:checked').val() === 'false') {
                params.is_automated = false
            };

            const text = $('#id_text').val()
            if (text) {
                params.text__icontains = text
            };

            (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateParamsToSearchTags)('#id_tag', params)

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.dataTableJsonRPC)('TestCase.filter', params, callbackF, preProcessData)
        },
        select: {
            className: 'success',
            style: 'multi',
            selector: 'td > input'
        },
        columns: [
            {
                data: null,
                sortable: false,
                orderable: false,
                target: 1,
                className: 'js-select-checkbox noVis',
                render: function (data, type, full, meta) {
                    return `<input type="checkbox" value="${data.id}" name="row-check">`
                }
            },
            { data: 'id' },
            {
                data: null,
                render: function (data, type, full, meta) {
                    return '<a href="/case/' + data.id + '/" target="_parent">' + (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.escapeHTML)(data.summary) + '</a>'
                }
            },
            { data: 'create_date' },
            { data: 'history_date' },
            { data: 'category__name' },
            { data: 'component_names' },
            { data: 'priority__value' },
            { data: 'case_status__name' },
            { data: 'is_automated' },
            { data: 'author__username' },
            { data: 'default_tester__username' },
            { data: 'tag_names' }
        ],
        dom: 'Biptip',
        buttons: _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__.exportButtons,
        language: {
            info: $('#main-element').data('trans-x-records-found'),
            infoEmpty: $('#main-element').data('trans-no-records-found'),
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            thousands: '',
            zeroRecords: $('#main-element').data('trans-no-records-found')
        },
        order: [[1, 'asc']]
    })

    // hide the select checkboxes if not in use
    if (window.location.href.indexOf('allow_select') === -1) {
        table.on('draw.dt', function () {
            $('.js-select-checkbox').hide()
        })
    }

    const selectAllButton = $('#check-all')

    selectAllButton.click(function () {
        const rowCheckboxInputButton = $("input:checkbox[name='row-check']")
        const isChecked = selectAllButton.prop('checked')
        rowCheckboxInputButton.prop('checked', isChecked)
        isChecked ? table.rows().select() : table.rows().deselect()
    })

    table.on('select', function (e, dt, type, indexes) {
        if (type === 'row') {
            const totalRows = $("input:checkbox[name='row-check']").length
            const selectedRows = $("input:checkbox[name='row-check']:checked").length
            selectAllButton.prop('checked', totalRows === selectedRows)
        }
    })

    table.on('deselect', function (e, dt, type, indexes) {
        if (type === 'row') {
            selectAllButton.prop('checked', false)
        }
    })

    $('#select-btn').click(function (event) {
        event.preventDefault()
        const testCaseIDs = []

        table.rows({ selected: true }).data().each(function (selected) {
            testCaseIDs.push(selected.id)
        })

        if (testCaseIDs && window.opener) {
            window.opener.addTestCases(testCaseIDs, window)
        }

        return false
    })

    $('#btn_search').click(function () {
        table.ajax.reload()
        return false // so we don't actually send the form
    })

    $('#id_product').change(function () {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateComponentSelectFromProduct)()
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateCategorySelectFromProduct)()
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateTestPlanSelectFromProduct)({ parent: null }, _static_js_utils__WEBPACK_IMPORTED_MODULE_3__.discoverNestedTestPlans)
    })

    if (window.location.href.indexOf('product') > -1) {
        $('#id_product').change()
    }
}

function selectedPlanIds () {
    const selectedIds = $('#id_test_plan').val()
    const childIds = []

    // search for children of each selected TP
    if ($('#id_include_child_tps').is(':checked')) {
        for (const id of selectedIds) {
            const option = $(`#id_test_plan option[value="${id}"]`)[0]

            // scan all DOM elements after the selected one for child test plans
            // b/c they are rendered as subsequent <options> with different
            // leading space indentation
            let sibling = option.nextElementSibling
            const indentation = option.text.search(/\S|$/)

            while (sibling !== null && sibling.text.search(/\S|$/) > indentation) {
                // everything that starts with a space is considered a child TP
                childIds.push(sibling.value)
                sibling = sibling.nextElementSibling
            }
        }
    }

    return selectedIds.concat(childIds)
}


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestplansCloneReadyHandler: () => (/* binding */ pageTestplansCloneReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);
// Copyright (c) 2026 Alexander Todorov <atodorov@otb.bg>

// Licensed under the GPL 2.0 or later: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html




function syncOtherProductSelects (current, productId, productName) {
    $('select.js-product').not(current).each(function (index, select) {
        select.add(new Option(productName, productId))
        $(select).selectpicker('refresh')
    })
}

function syncOtherVersionSelects (current, productId, versionId, versionName) {
    $('select.js-version').not(current).each(function (index, select) {
        const row = $(select).closest('.js-clone-row')

        if (row.find('select.js-product').val() === productId) {
            select.add(new Option(versionName, versionId))
            $(select).selectpicker('refresh')
        }
    })
}

function rowValues (row) {
    const values = {
        name: row.find('input.js-name').val(),
        product: Number(row.find('select.js-product').val()),
        version: Number(row.find('select.js-version').val()),
        copy_testcases: row.find('input.js-copy-testcases').is(':checked')
    }

    if (row.find('input.js-parent').is(':checked')) {
        values.parent = Number(row.find('input.js-parent').val())
    }

    return values
}

function showRowError (row, message) {
    row.find('.js-clone-error-text').text(message)
    row.find('.js-clone-error').removeClass('hidden')
    $('#js-clone-button').button('reset')
}

function pageTestplansCloneReadyHandler () {
    const dismissAddRelatedObjectPopup = window.dismissAddRelatedObjectPopup

    window.dismissAddRelatedObjectPopup = function (win, newId, newRepr, optgroup) {
        const current = document.getElementById(win.name)

        if (current && $(current).hasClass('js-product')) {
            syncOtherProductSelects(current, newId, newRepr)
        } else if (current && $(current).hasClass('js-version')) {
            const row = $(current).closest('.js-clone-row')
            const productId = row.find('select.js-product').val()

            syncOtherVersionSelects(current, productId, newId, newRepr)
        }

        return dismissAddRelatedObjectPopup.apply(window, arguments)
    }

    $('.js-add-product').click(function () {
        return showRelatedObjectPopup(this)
    })

    $('.js-add-version').click(function () {
        return showRelatedObjectPopup(this)
    })

    // NOTE: use the native onchange property, NOT $(...).change()
    $('select.js-product').each(function () {
        this.onchange = function () {
            $(this).selectpicker('refresh')

            const row = $(this).closest('.js-clone-row')

            ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.populateVersion)(
                row.find('select.js-product'),
                row.find('select.js-version'),
                row.find('.js-add-version')
            )
        }
    })

    $('select.js-version').each(function () {
        this.onchange = function () {
            $(this).selectpicker('refresh')
        }
    })

    const cloneButton = $('#js-clone-button')
    cloneButton.click(function () {
        const isTree = $('#main-element').data('is-tree') === 1
        const rows = $('.js-clone-row').not('.js-cloned')
        // maps the id of a source TestPlan to the id of its clone
        const clonedPlanIds = {}

        const cloneIsDone = function () {
            const newPlanIds = Object.values(clonedPlanIds)

            if (newPlanIds.length < rows.length) {
                return
            }

            const redirectToClonedPlan = function () {
                if (isTree || newPlanIds.length === 1) {
                    window.location.assign(`/plan/${newPlanIds[0]}/`)
                } else {
                    window.location.assign(document.referrer || '/')
                }
            }

            // in tree mode set the parent of every clone, which can only be
            // done once all of the clones have been created.
            if (isTree) {
                let updatedCount = 0

                const updateIsDone = function () {
                    updatedCount += 1

                    if (updatedCount === rows.length) {
                        redirectToClonedPlan()
                    }
                }

                rows.each(function () {
                    const row = $(this)

                    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)(
                        'TestPlan.update',
                        [
                            clonedPlanIds[row.data('plan-id')],
                            { parent: clonedPlanIds[row.attr('data-parent-id')] }
                        ],
                        updateIsDone
                    )
                })

                return
            }

            redirectToClonedPlan()
        }

        if (!rows.length) {
            cloneButton.button('reset')
            return
        }

        cloneButton.button('loading')

        rows.each(function () {
            const row = $(this)
            row.find('.js-clone-error').addClass('hidden')

            const values = rowValues(row)

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.clone', [row.data('plan-id'), values], function (result) {
                clonedPlanIds[row.data('plan-id')] = result.id
                row.addClass('js-cloned')
                row.find('.js-clone-ok').removeClass('hidden')
                cloneIsDone()
            }, false, function (message) {
                showRowError(row, message)
            })
        })
    })
}


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestplansGetReadyHandler: () => (/* binding */ pageTestplansGetReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _static_js_tags__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);
/* harmony import */ var _static_js_simplemde_security_override__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(16);





const expandedTestCaseIds = []
const fadeAnimationTime = 500

const allTestCases = {}
const autocompleteCache = {}

const confirmedStatuses = []

function pageTestplansGetReadyHandler () {
    const testPlanDataElement = $('#test_plan_pk')
    const testPlanId = testPlanDataElement.data('testplan-pk')

    const permissions = {
        'perm-change-testcase': testPlanDataElement.data('perm-change-testcase') === 'True',
        'perm-remove-testcase': testPlanDataElement.data('perm-remove-testcase') === 'True',
        'perm-add-testcase': testPlanDataElement.data('perm-add-testcase') === 'True',
        'perm-add-comment': testPlanDataElement.data('perm-add-comment') === 'True',
        'perm-delete-comment': testPlanDataElement.data('perm-delete-comment') === 'True'
    }

    // bind everything in tags table
    const permRemoveTag = testPlanDataElement.data('perm-remove-tag') === 'True'
    ;(0,_static_js_tags__WEBPACK_IMPORTED_MODULE_1__.tagsCard)('TestPlan', testPlanId, { plan: testPlanId }, permRemoveTag)

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCaseStatus.filter', { is_confirmed: true }, function (statuses) {
    // save for later use
        for (let i = 0; i < statuses.length; i++) {
            confirmedStatuses.push(statuses[i].id)
        }

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.sortkeys', { plan: testPlanId }, function (sortkeys) {
            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.filter', { plan: testPlanId }, function (data) {
                for (let i = 0; i < data.length; i++) {
                    const testCase = data[i]

                    testCase.sortkey = sortkeys[testCase.id]
                    allTestCases[testCase.id] = testCase
                }
                sortTestCases(Object.values(allTestCases), testPlanId, permissions, 'sortkey')

                // drag & reorder needs the initial order of test cases and
                // they may not be fully loaded when sortable() is initialized!
                toolbarEvents(testPlanId, permissions)
            })
        })
    })

    adjustTestPlanFamilyTree()
    collapseDocumentText()
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.quickSearchAndAddTestCase)(testPlanId, addTestCaseToPlan, autocompleteCache)
    $('#btn-search-cases').click(function () {
        return (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.advancedSearchAndAddTestCases)(
            testPlanId, 'TestPlan.add_case', $(this).attr('href'),
            $('#test_plan_pk').data('trans-error-adding-cases')
        )
    })
}

function addTestCaseToPlan (planId) {
    const caseName = $('#search-testcase')[0].value
    const testCase = autocompleteCache[caseName]

    // test case is already present so don't add it
    if (allTestCases[testCase.id]) {
        $('#search-testcase').val('')
        return false
    }

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.add_case', [planId, testCase.id], function (result) {
    // IMPORTANT: the API result includes a 'sortkey' field value!
        window.location.reload(true)

        // TODO: remove the page reload above and add the new case to the list
        // NB: pay attention to drawTestCases() & treeViewBind()
        // NB: also add to allTestCases !!!

        $('#search-testcase').val('')
    })
}

function collapseDocumentText () {
    // for some reason .height() reports a much higher value than
    // reality and the 59% reduction seems to work nicely
    const infoCardHeight = 0.59 * $('#testplan-info').height()

    if ($('#testplan-text').height() > infoCardHeight) {
        $('#testplan-text-collapse-btn').removeClass('hidden')

        $('#testplan-text').css('min-height', infoCardHeight)
        $('#testplan-text').css('height', infoCardHeight)
        $('#testplan-text').css('overflow', 'hidden')

        $('#testplan-text').on('hidden.bs.collapse', function () {
            $('#testplan-text').removeClass('collapse').css({
                height: infoCardHeight
            })
        })
    }
}

function adjustTestPlanFamilyTree () {
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.treeViewBind)('#test-plan-family-tree')

    // remove the > arrows from elements which don't have children
    $('#test-plan-family-tree').find('.list-group-item-container').each(function (index, element) {
        if (!element.innerHTML.trim()) {
            const span = $(element).siblings('.list-group-item-header').find('.list-view-pf-left span')

            span.removeClass('fa-angle-right')
            // this is the exact same width so rows are still aligned
            span.attr('style', 'width:9px')
        }
    })

    // expand all parent elements so that the current one is visible
    $('#test-plan-family-tree').find('.list-group-item.active').each(function (index, element) {
        $(element).parents('.list-group-item-container').each(function (idx, container) {
            $(container).toggleClass('hidden')
            $(container).siblings('.list-group-item-header').find('.fa-angle-right').toggleClass('fa-angle-down')
        })
    })
}

function drawTestCases (testCases, testPlanId, permissions) {
    const container = $('#testcases-list')
    const noCasesTemplate = $('#no_test_cases')
    const testCaseRowDocumentFragment = $('#test_case_row')[0].content

    if (testCases.length > 0) {
        testCases.forEach(function (element) {
            container.append(getTestCaseRowContent(testCaseRowDocumentFragment.cloneNode(true), element, permissions))
        })
        attachEvents(testPlanId, permissions)
    } else {
        container.append(noCasesTemplate[0].innerHTML)
    }

    $('.test-cases-count').html(testCases.length)
}

function redrawSingleRow (testCaseId, testPlanId, permissions) {
    const testCaseRowDocumentFragment = $('#test_case_row')[0].content
    const newRow = getTestCaseRowContent(testCaseRowDocumentFragment.cloneNode(true), allTestCases[testCaseId], permissions)

    // remove from expanded list b/c the comment section may have changed
    expandedTestCaseIds.splice(expandedTestCaseIds.indexOf(testCaseId), 1)

    // replace the element in the dom
    $(`[data-testcase-pk=${testCaseId}]`).replaceWith(newRow)
    attachEvents(testPlanId, permissions)
}

function getTestCaseRowContent (rowContent, testCase, permissions) {
    const row = $(rowContent)

    row[0].firstElementChild.dataset.testcasePk = testCase.id
    row.find('.js-test-case-link').html(`TC-${testCase.id}: ${testCase.summary}`).attr('href', `/case/${testCase.id}/`)
    // todo: TestCaseStatus here isn't translated b/c TestCase.filter uses a
    // custom serializer which needs to be refactored as well
    row.find('.js-test-case-status').html(`${testCase.case_status__name}`)
    row.find('.js-test-case-priority').html(`${testCase.priority__value}`)
    row.find('.js-test-case-category').html(`${testCase.category__name}`)
    row.find('.js-test-case-author').html(`${testCase.author__username}`)
    row.find('.js-test-case-tester').html(`${testCase.default_tester__username || '-'}`)
    row.find('.js-test-case-reviewer').html(`${testCase.reviewer__username || '-'}`)

    // set the links in the kebab menu
    if (permissions['perm-change-testcase']) {
        row.find('.js-test-case-menu-edit')[0].href = `/case/${testCase.id}/edit/`
    }

    if (permissions['perm-add-testcase']) {
        row.find('.js-test-case-menu-clone')[0].href = `/cases/clone/?c=${testCase.id}`
    }

    // apply visual separation between confirmed and not confirmed

    if (!isTestCaseConfirmed(testCase.case_status)) {
        row.find('.list-group-item-header').addClass('bg-danger')

        // add customizable icon as part of #1932
        row.find('.js-test-case-status-icon').addClass('fa-times')

        row.find('.js-test-case-tester-div').toggleClass('hidden')
        row.find('.js-test-case-reviewer-div').toggleClass('hidden')
    } else {
        row.find('.js-test-case-status-icon').addClass('fa-check-square')
    }

    // handle automated icon
    const automationIndicationElement = row.find('.js-test-case-automated')
    let automatedClassToRemove = 'fa-cog'

    if (testCase.is_automated) {
        automatedClassToRemove = 'fa-hand-paper-o'
    }

    automationIndicationElement.parent().attr(
        'title',
        automationIndicationElement.data(testCase.is_automated.toString())
    )
    automationIndicationElement.removeClass(automatedClassToRemove)

    // produce unique IDs for comments textarea and file upload fields
    row.find('textarea')[0].id = `comment-for-testcase-${testCase.id}`
    row.find('input[type="file"]')[0].id = `file-upload-for-testcase-${testCase.id}`

    return row
}

function getTestCaseExpandArea (row, testCase, permissions) {
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.markdown2HTML)(testCase.text, row.find('.js-test-case-expand-text'))
    if (testCase.notes.trim().length > 0) {
        row.find('.js-test-case-expand-notes').html(testCase.notes)
    }

    // draw the attachments
    const uniqueDivCustomId = `js-tc-id-${testCase.id}-attachments`
    // set unique identifier so we know where to draw fetched data
    row.find('.js-test-case-expand-attachments').parent()[0].id = uniqueDivCustomId

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.list_attachments', [testCase.id], function (data) {
    // cannot use instance of row in the callback
        const ulElement = $(`#${uniqueDivCustomId} .js-test-case-expand-attachments`)

        if (data.length === 0) {
            ulElement.children().removeClass('hidden')
            return
        }

        const liElementFragment = $('#attachments-list-item')[0].content

        for (let i = 0; i < data.length; i++) {
            // should create new element for every attachment
            const liElement = liElementFragment.cloneNode(true)
            const attachmentLink = $(liElement).find('a')[0]

            attachmentLink.href = data[i].url
            attachmentLink.innerText = data[i].url.split('/').slice(-1)[0]
            ulElement.append(liElement)
        }
    })

    // load components
    const componentTemplate = row.find('.js-testcase-expand-components').find('template')[0].content
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Component.filter', { cases: testCase.id }, function (result) {
        result.forEach(function (element) {
            const newComponent = componentTemplate.cloneNode(true)
            $(newComponent).find('span').html(element.name)
            row.find('.js-testcase-expand-components').append(newComponent)
        })
    })

    // load tags
    const tagTemplate = row.find('.js-testcase-expand-tags').find('template')[0].content
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Tag.filter', { case: testCase.id }, function (result) {
        const uniqueTags = []

        result.forEach(function (element) {
            if (uniqueTags.indexOf(element.name) === -1) {
                uniqueTags.push(element.name)

                const newTag = tagTemplate.cloneNode(true)
                $(newTag).find('span').html(element.name)
                row.find('.js-testcase-expand-tags').append(newTag)
            }
        })
    })

    // render previous comments
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.renderCommentsForObject)(
        testCase.id,
        'TestCase.comments',
        'TestCase.remove_comment',
        !isTestCaseConfirmed(testCase.case_status) && permissions['perm-delete-comment'],
        row.find('.comments')
    )

    // render comments form
    const commentFormTextArea = row.find('.js-comment-form-textarea')
    if (!isTestCaseConfirmed(testCase.case_status) && permissions['perm-add-comment']) {
        const textArea = row.find('textarea')[0]
        const fileUpload = row.find('input[type="file"]')
        const editor = (0,_static_js_simplemde_security_override__WEBPACK_IMPORTED_MODULE_3__.initSimpleMDE)(textArea, $(fileUpload), textArea.id)

        row.find('.js-post-comment').click(function (event) {
            event.preventDefault()
            const input = editor.value().trim()

            if (input) {
                (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.add_comment', [testCase.id, input], comment => {
                    editor.value('')

                    // show the newly added comment and bind its delete button
                    row.find('.comments').append(
                        (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.renderCommentHTML)(
                            1 + row.find('.js-comment-container').length,
                            comment,
                            $('template#comment-template')[0],
                            function (parentNode) {
                                ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.bindDeleteCommentButton)(
                                    testCase.id,
                                    'TestCase.remove_comment',
                                    permissions['perm-delete-comment'], // b/c we already know it's unconfirmed
                                    parentNode)
                            })
                    )
                })
            }
        })
    } else {
        commentFormTextArea.hide()
    }
}

function attachEvents (testPlanId, permissions) {
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.treeViewBind)('#testcases-list')

    if (permissions['perm-change-testcase']) {
    // update default tester
        $('.js-test-case-menu-tester').click(function (ev) {
            $(this).parents('.dropdown').toggleClass('open')

            const emailOrUsername = window.prompt($('#test_plan_pk').data('trans-username-email-prompt'))
            if (!emailOrUsername) {
                return false
            }

            updateTestCasesViaAPI([getCaseIdFromEvent(ev)], { default_tester: emailOrUsername },
                testPlanId, permissions)

            return false
        })

        $('.js-test-case-menu-priority').click(function (ev) {
            $(this).parents('.dropdown').toggleClass('open')

            updateTestCasesViaAPI([getCaseIdFromEvent(ev)], { priority: ev.target.dataset.id },
                testPlanId, permissions)
            return false
        })

        $('.js-test-case-menu-status').click(function (ev) {
            $(this).parents('.dropdown').toggleClass('open')
            const testCaseId = getCaseIdFromEvent(ev)
            updateTestCasesViaAPI([testCaseId], { case_status: ev.target.dataset.id },
                testPlanId, permissions)
            return false
        })
    }

    if (permissions['perm-remove-testcase']) {
    // delete testcase from the plan
        $('.js-test-case-menu-delete').click(function (ev) {
            $(this).parents('.dropdown').toggleClass('open')
            removeTestCaseFromPlan(testPlanId, getCaseIdFromEvent(ev))

            return false
        })
    }

    // get details and draw expand area only on expand
    $('.js-testcase-row').click(function (ev) {
    // don't trigger row expansion when kebab menu is clicked
        if ($(ev.target).is('button, a, input, .fa-ellipsis-v')) {
            return
        }

        const testCaseId = getCaseIdFromEvent(ev)

        // tc was expanded once, dom is ready
        if (expandedTestCaseIds.indexOf(testCaseId) > -1) {
            return
        }

        const tcRow = $(ev.target).closest(`[data-testcase-pk=${testCaseId}]`)
        expandedTestCaseIds.push(testCaseId)
        getTestCaseExpandArea(tcRow, allTestCases[testCaseId], permissions)
    })

    const inputs = $('.js-testcase-row').find('input')
    inputs.click(function (ev) {
    // stop trigerring row.click()
        ev.stopPropagation()
        const checkbox = $('.js-checkbox-toolbar')[0]

        inputs.each(function (index, tc) {
            checkbox.checked = tc.checked

            if (!checkbox.checked) {
                return false
            }
        })
    })

    function getCaseIdFromEvent (ev) {
        return $(ev.target).closest('.js-testcase-row').data('testcase-pk')
    }
}

function updateTestCasesViaAPI (testCaseIds, updateQuery, testPlanId, permissions) {
    testCaseIds.forEach(function (caseId) {
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.update', [caseId, updateQuery], function (updatedTC) {
            const testCaseRow = $(`.js-testcase-row[data-testcase-pk=${caseId}]`)

            // update internal data
            const sortkey = allTestCases[caseId].sortkey
            allTestCases[caseId] = updatedTC
            // note: updatedTC doesn't have sortkey information
            allTestCases[caseId].sortkey = sortkey

            ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.animate)(testCaseRow, function () {
                redrawSingleRow(caseId, testPlanId, permissions)
            })
        })
    })
}

function removeTestCaseFromPlan (testPlanId, testCaseId) {
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.remove_case', [testPlanId, testCaseId], function () {
        delete allTestCases[testCaseId]

        // fadeOut the row then remove it from the dom, if we remove it directly the user may not see the change
        $(`[data-testcase-pk=${testCaseId}]`).fadeOut(fadeAnimationTime, function () {
            $(this).remove()
        })

        const testCasesCountEl = $('.test-cases-count')
        const count = parseInt(testCasesCountEl[0].innerText)
        testCasesCountEl.html(count - 1)
    })
}

function toolbarEvents (testPlanId, permissions) {
    $('.js-checkbox-toolbar').click(function (ev) {
        const isChecked = ev.target.checked
        const testCaseRows = $('.js-testcase-row').find('input')

        testCaseRows.each(function (index, tc) {
            tc.checked = isChecked
        })
    })

    $('.js-toolbar-filter-options li').click(function (ev) {
        return (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.changeDropdownSelectedItem)(
            '.js-toolbar-filter-options',
            '#input-filter-button',
            ev.target,
            $('#toolbar-filter')
        )
    })

    $('#toolbar-filter').on('keyup', function () {
        const filterValue = $(this).val().toLowerCase()
        const filterBy = $('.js-toolbar-filter-options .selected')[0].dataset.filterType

        filterTestCasesByProperty(
            testPlanId,
            Object.values(allTestCases),
            filterBy,
            filterValue
        )
    })

    $('.js-toolbar-sort-options li').click(function (ev) {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.changeDropdownSelectedItem)('.js-toolbar-sort-options', '#sort-button', ev.target)

        sortTestCases(Object.values(allTestCases), testPlanId, permissions)
        return false
    })

    // handle asc desc icon
    $('.js-toolbar-sorting-order > span').click(function (ev) {
        const icon = $(this)

        icon.siblings('.hidden').removeClass('hidden')
        icon.addClass('hidden')

        sortTestCases(Object.values(allTestCases), testPlanId, permissions)
    })

    // always initialize the sortable list however you can only
    // move items using the handle icon on the left which becomes
    // visible only when the manual sorting button is clicked
    sortable('#testcases-list', {
        handle: '.handle',
        itemSerializer: (serializedItem, sortableContainer) => {
            return parseInt(serializedItem.node.getAttribute('data-testcase-pk'))
        }
    })

    // IMPORTANT: this is not empty b/c sortable() is initialized *after*
    // all of the test cases have been rendered !!!
    const initialOrder = sortable('#testcases-list', 'serialize')[0].items

    $('.js-toolbar-manual-sort').click(function (event) {
        $(this).blur()
        $('.js-toolbar-manual-sort').find('span').toggleClass(['fa-sort', 'fa-check-square'])
        $('.js-testcase-sort-handler, .js-testcase-expand-arrow, .js-testcase-checkbox').toggleClass('hidden')

        const currentOrder = sortable('#testcases-list', 'serialize')[0].items

        // rows have been rearranged and the results must be committed to the DB
        if (currentOrder.join() !== initialOrder.join()) {
            currentOrder.forEach(function (tcPk, index) {
                (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.update_case_order', [testPlanId, tcPk, index * 10], function (result) {})
            })
        }
    })

    $('.js-toolbar-priority').click(function (ev) {
        $(this).parents('.dropdown').toggleClass('open')
        const selectedCases = getSelectedTestCases()

        if (!selectedCases.length) {
            return false
        }

        updateTestCasesViaAPI(selectedCases, { priority: ev.target.dataset.id },
            testPlanId, permissions)

        return false
    })

    $('.js-toolbar-status').click(function (ev) {
        $(this).parents('.dropdown').toggleClass('open')
        const selectedCases = getSelectedTestCases()

        if (!selectedCases.length) {
            return false
        }

        updateTestCasesViaAPI(selectedCases, { case_status: ev.target.dataset.id },
            testPlanId, permissions)
        return false
    })

    $('#default-tester-button').click(function (ev) {
        $(this).parents('.dropdown').toggleClass('open')
        const selectedCases = getSelectedTestCases()

        if (!selectedCases.length) {
            return false
        }

        const emailOrUsername = window.prompt($('#test_plan_pk').data('trans-username-email-prompt'))

        if (!emailOrUsername) {
            return false
        }

        updateTestCasesViaAPI(selectedCases, { default_tester: emailOrUsername },
            testPlanId, permissions)

        return false
    })

    $('#bulk-reviewer-button').click(function (ev) {
        $(this).parents('.dropdown').toggleClass('open')
        const selectedCases = getSelectedTestCases()

        if (!selectedCases.length) {
            return false
        }

        const emailOrUsername = window.prompt($('#test_plan_pk').data('trans-username-email-prompt'))

        if (!emailOrUsername) {
            return false
        }

        updateTestCasesViaAPI(selectedCases, { reviewer: emailOrUsername },
            testPlanId, permissions)

        return false
    })

    $('#delete_button').click(function (ev) {
        $(this).parents('.dropdown').toggleClass('open')
        const selectedCases = getSelectedTestCases()

        if (!selectedCases.length) {
            return false
        }

        const areYouSureText = $('#test_plan_pk').data('trans-are-you-sure')
        if (confirm(areYouSureText)) {
            selectedCases.forEach(function (testCaseId) {
                removeTestCaseFromPlan(testPlanId, testCaseId)
            })
        }

        return false
    })

    $('#bulk-clone-button').click(function () {
        $(this).parents('.dropdown').toggleClass('open')
        const selectedCases = getSelectedTestCases()

        if (!selectedCases.length) {
            return false
        }

        window.location.assign(`/cases/clone?c=${selectedCases.join('&c=')}`)
    })

    $('#testplan-toolbar-newrun').click(function () {
        $(this).parents('.dropdown').toggleClass('open')
        const selectedTestCases = getSelectedTestCases()

        if (!selectedTestCases.length) {
            return false
        }

        for (let i = 0; i < selectedTestCases.length; i++) {
            const status = allTestCases[selectedTestCases[i]].case_status
            if (!isTestCaseConfirmed(status)) {
                alert($('#test_plan_pk').data('trans-cannot-create-testrun'))
                return false
            }
        }

        const newTestRunUrl = $('#test_plan_pk').data('new-testrun-url')
        window.location.assign(`${newTestRunUrl}?c=${selectedTestCases.join('&c=')}`)
        return false
    })
}

function isTestCaseConfirmed (status) {
    return confirmedStatuses.indexOf(Number(status)) > -1
}

function sortTestCases (testCases, testPlanId, permissions, defaultSortBy = undefined) {
    const sortBy = defaultSortBy || $('.js-toolbar-sort-options .selected')[0].dataset.filterType
    const sortOrder = $('.js-toolbar-sorting-order > span:not(.hidden)').data('order')

    $('#testcases-list').html('')

    testCases.sort(function (tc1, tc2) {
        const value1 = tc1[sortBy] || ''
        const value2 = tc2[sortBy] || ''

        if (Number.isInteger(value1) && Number.isInteger(value2)) {
            return (value1 - value2) * sortOrder
        }

        return value1.toString().localeCompare(value2.toString()) * sortOrder
    })

    // put the new order in the DOM
    drawTestCases(testCases, testPlanId, permissions)
}

function getSelectedTestCases () {
    return (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.selectedVisibleCheckboxes)(
        '.js-testcase-row input',
        $('#test_plan_pk').data('trans-no-testcases-selected')
    ).toArray().map(checkbox => $(checkbox).closest('.js-testcase-row').data('testcase-pk'))
}

function filterTestCasesByProperty (planId, testCases, filterBy, filterValue) {
    // no input => show all rows
    if (filterValue.trim().length === 0) {
        $('.js-testcase-row').show()
        $('.test-cases-count').text(testCases.length)
        return
    }

    $('.js-testcase-row').hide()

    if (filterBy === 'component' || filterBy === 'tag') {
        const query = { plan: planId }
        query[`${filterBy}__name__icontains`] = filterValue

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.filter', query, function (filtered) {
            // hide again if a previous async request showed something else
            $('.js-testcase-row').hide()

            const rows = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.findSelectorsToShowAndHideFromAPIData)(testCases, filtered, '[data-testcase-pk={0}]')
            ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.showOrHideMultipleRows)('.js-testcase-row', rows)
            $('.test-cases-count').text(rows.show.length)
        })
    } else {
        const rows = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.findSelectorsToShowAndHide)(testCases, filterBy, filterValue, '[data-testcase-pk={0}]')
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.showOrHideMultipleRows)('.js-testcase-row', rows)
        $('.test-cases-count').text(rows.show.length)
    }
}


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initSimpleMDE: () => (/* binding */ initSimpleMDE)
/* harmony export */ });
/* harmony import */ var _jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);



/*
    Override markdown rendering defaults for Simple MDE.

    This resolves XSS vulnerability which can be exploited
    when previewing malicious text in the editor.

    https://github.com/sparksuite/simplemde-markdown-editor/issues/721
    https://snyk.io/vuln/SNYK-JS-SIMPLEMDE-72570
*/
SimpleMDE.prototype.markdown = function (text) {
    alert('RuntimeError - markdown rendering is now backend side')
}

/*
    textArea - a DOM element, not jQuery one, of a text area
    fileUpload - a jQuery element of a hidden file upload field
    autoSaveId - unique ID for autosave!
*/
function initSimpleMDE (textArea, fileUploadElement, autoSaveId = window.location.toString()) {
    if (!textArea || !fileUploadElement) {
        return null
    }

    const simpleMDE = new SimpleMDE({
        element: textArea,
        autoDownloadFontAwesome: false,
        renderingConfig: {
            codeSyntaxHighlighting: true
        },
        toolbar: [
            'heading', 'bold', 'italic', 'strikethrough', '|',
            'ordered-list', 'unordered-list', 'table', 'horizontal-rule', 'code', 'quote', '|',
            'link',
            {
                // todo: standard shortcut is (Ctrl-Alt-I) but I can't find a way
                // to assign shortcuts to customized buttons
                name: 'image',
                action: () => {
                    fileUploadElement.click()
                },
                className: 'fa fa-picture-o',
                title: 'Insert Image'
            },
            {
                name: 'file',
                action: () => {
                    fileUploadElement.click()
                },
                className: 'fa fa-paperclip',
                title: 'Attach File'
            },
            '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'
        ],
        autosave: {
            enabled: true,
            uniqueId: autoSaveId,
            delay: 5000
        },
        tabSize: 4,
        indentWithTabs: false,
        previewRender: function (plainText) {
            let renderedText

            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Markdown.render', plainText, function (result) {
                renderedText = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.unescapeHTML)(result)
            }, true)

            return renderedText
        }
    })

    fileUploadElement.change(function () {
        const attachment = this.files[0]
        const reader = new FileReader()

        reader.onload = e => {
            const dataUri = e.target.result
            const mimeType = dataUri.split(':')[1]
            const b64content = dataUri.split('base64,')[1]

            ;(0,_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('User.add_attachment', [attachment.name, b64content], data => {
                const cm = simpleMDE.codemirror
                const endPoint = cm.getCursor('end')
                let text = `[${data.filename}](${data.url})\n`

                if (mimeType.startsWith('image')) {
                    text = '!' + text
                }

                cm.replaceSelection(text)
                endPoint.ch += text.length
                cm.setSelection(endPoint, endPoint)
                cm.focus()
            })
        }
        reader.readAsDataURL(attachment)
    })

    return simpleMDE
}


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestplansMutableReadyHandler: () => (/* binding */ pageTestplansMutableReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);



const planCache = {}

/*
    Used in mutable.html and clone.html
*/
function pageTestplansMutableReadyHandler () {
    if ($('#id_version').find('option').length === 0) {
        (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.populateVersion)('#id_product', '#id_version', '#add_id_version', '#add_id_build')
    }

    $('#add_id_product').click(function () {
        return showRelatedObjectPopup(this)
    })

    $('#add_id_version').click(function () {
        return showRelatedObjectPopup(this)
    })

    document.getElementById('id_product').onchange = function () {
        $('#id_product').selectpicker('refresh')
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.populateVersion)('#id_product', '#id_version', '#add_id_version', '#add_id_build')
    }

    document.getElementById('id_version').onchange = function () {
        $('#id_version').selectpicker('refresh')
    }

    // autocomplete for Parent ID
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.testPlanAutoComplete)('#input-select-parent', planCache)

    // NOTE: keydown() instead of keyup() to prevent submitting the form
    $('#input-select-parent').keydown(function (event) {
        if (event.keyCode === 13) {
            const planName = this.value
            const plan = planCache[planName]

            // empty value + Enter clears the existing selection
            const planId = plan !== undefined ? plan.id : null

            $('#id_parent').val(planId)
            $('.js-parent-id-value').text(planId)

            event.preventDefault()
            return false
        };
    })

    // override the default inline-block style
    $('span.twitter-typeahead').css('display', 'block')
}


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestplansSearchReadyHandler: () => (/* binding */ pageTestplansSearchReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4);





let testPlanIdsFromBackend = []
let hiddenChildRows = {}

function preProcessData (data, callbackF) {
    testPlanIdsFromBackend = []
    hiddenChildRows = {}

    data.forEach(function (element) {
        testPlanIdsFromBackend.push(element.id)
    })

    // get tags for all objects
    const tagsPerPlan = {}
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Tag.filter', { plan__in: testPlanIdsFromBackend }, function (tags) {
        tags.forEach(function (element) {
            if (tagsPerPlan[element.plan] === undefined) {
                tagsPerPlan[element.plan] = []
            }

            // push only if unique
            if (tagsPerPlan[element.plan].indexOf(element.name) === -1) {
                tagsPerPlan[element.plan].push(element.name)
            }
        })

        // augment data set with additional info
        data.forEach(function (element) {
            if (element.id in tagsPerPlan) {
                element.tag = tagsPerPlan[element.id]
            } else {
                element.tag = []
            }
        })

        callbackF({ data }) // renders everything
    })
}

function pageTestplansSearchReadyHandler () {
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after')

    const multiCloneButton = {
        text: '<i class="fa fa-clone"> </i>',
        titleAttr: 'Clone',
        action: function (e, dt, node, config) {
            const selectedTestPlans = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.selectedVisibleCheckboxes)(
                '#resultsTable tbody input.row-select',
                $('#main-element').data('trans-no-testplans-selected')
            ).toArray().map(checkbox => $(checkbox).data('plan-id'))

            if (selectedTestPlans.length === 0) {
                return false
            }

            const firstPlan = encodeURIComponent(selectedTestPlans.shift())
            const encodedSelectedTestPlans = selectedTestPlans.map((planId) => encodeURIComponent(planId))
            window.location.assign(`/plan/${firstPlan}/clone/?p=${encodedSelectedTestPlans.join('&p=')}`)
        }
    }

    const rowsNotShownMessage = $('#main-element').data('trans-some-rows-not-shown')
    const table = $('#resultsTable').DataTable({
        pageLength: $('#navbar').data('defaultpagesize'),
        ajax: function (data, callbackF, settings) {
            const params = {}

            if ($('#id_name').val()) {
                params.name__icontains = $('#id_name').val()
            }

            if ($('#id_before').val()) {
                params.create_date__lte = $('#id_before').data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            if ($('#id_after').val()) {
                params.create_date__gte = $('#id_after').data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            if ($('#id_product').val()) {
                params.product = $('#id_product').val()
            };

            if ($('#id_version').val()) {
                params.product_version = $('#id_version').val()
            };

            if ($('#id_type').val()) {
                params.type = $('#id_type').val()
            };

            if ($('#id_author').val()) {
                params.author__username__startswith = $('#id_author').val()
            };

            if ($('#id_default_tester').val()) {
                params.cases__default_tester__username__startswith = $('#id_default_tester').val()
            };

            (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateParamsToSearchTags)('#id_tag', params)

            params.is_active = $('#id_active').is(':checked')

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.dataTableJsonRPC)('TestPlan.filter', params, callbackF, preProcessData)
        },
        columns: [
            {
                data: null,
                orderable: false,
                className: 'noVis',
                render: function (data, type, full, meta) { return `<input type="checkbox" class="row-select" data-plan-id="${data.id}">` }
            },
            {
                data: null,
                defaultContent: '',
                orderable: false,
                className: 'noVis',
                createdCell: function (td, cellData, rowData, rowIndex, colIndex) {
                    if (rowData.children__count > 0) {
                        $(td).addClass('dt-control')
                    }
                }
            },
            { data: 'id' },
            {
                data: null,
                render: function (data, type, full, meta) {
                    let result = '<a href="/plan/' + data.id + '/">' + (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.escapeHTML)(data.name) + '</a>'
                    result = result + ` <span class="pficon pficon-rebalance children-not-shown-message" title="${rowsNotShownMessage}"></span>`
                    if (!data.is_active) {
                        result = '<strike>' + result + '</strike>'
                    }
                    return result
                }
            },
            { data: 'create_date' },
            { data: 'product__name' },
            { data: 'product_version__value' },
            { data: 'type__name' },
            { data: 'author__username' },
            { data: 'tag' }
        ],
        rowCallback: function (row, data, index) {
            $(row).addClass(`test-plan-row-${data.id}`)

            // is this is a child row and it's parent is also in the result set
            // then hide it b/c it will be shown via expansion of the parent row
            if (testPlanIdsFromBackend.indexOf(data.parent) > -1) {
                if (!hiddenChildRows[data.parent]) {
                    hiddenChildRows[data.parent] = []
                }
                hiddenChildRows[data.parent].push(row)
                $(row).hide()
                // WARNING: using .hide() may mess up pagination but makes it
                // very easy to display child rows afterwards! Not a big issue for now.
            }
        },
        drawCallback: function (settings) {
            const data = this.api().data()
            $('.children-not-shown-message').hide()

            data.each(function (row) {
                if (row.children__count) {
                    const selectedChildren = hiddenChildRows[row.id] ? hiddenChildRows[row.id] : []

                    // some children are filtered out, display imbalance icon
                    if (row.children__count > selectedChildren.length) {
                        $(`.test-plan-row-${row.id} .children-not-shown-message`).show()
                    }

                    // all children filtered out, hide +/- button
                    if (selectedChildren.length === 0) {
                        $(`.test-plan-row-${row.id} .dt-control`).toggleClass('dt-control')
                    }
                }
            })
        },
        dom: 'Biptip',
        buttons: [
            multiCloneButton,
            ..._static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__.exportButtons
        ],
        language: {
            info: $('#main-element').data('trans-x-records-found'),
            infoEmpty: $('#main-element').data('trans-no-records-found'),
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            thousands: '',
            zeroRecords: $('#main-element').data('trans-no-records-found')
        },
        order: [[2, 'asc']],
        initComplete: function () {
            $('.js-toolbar-select-all').on('change', function () {
                $('#resultsTable tbody input.row-select:visible').prop('checked', this.checked)
            })
        }
    })

    // Add event listener for opening and closing nested test plans
    $('#resultsTable').on('click', 'td.dt-control', function () {
        const bracket = $(this).find('span')
        const tr = $(this).closest('tr')
        const row = table.row(tr)

        if (row.child.isShown()) {
            hideExpandedChildren(table, row)
            row.child.hide()
            bracket.removeClass('fa-angle-down')
        } else {
            row.child(renderChildrenOf(tr, row.data())).show()
            bracket.addClass('fa-angle-down')
        }
    })

    $('#btn_search').click(function () {
        table.ajax.reload()
        return false // so we don't actually send the form
    })

    $('#id_product').change(function () {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateVersionSelectFromProduct)('#id_product', '#id_version')
    })
}

function hideExpandedChildren (table, parentRow) {
    const children = hiddenChildRows[parentRow.data().id]
    children.forEach(
        function (element) {
            const row = table.row($(element))
            if (row.child.isShown()) {
                row.child.hide()
            }
            if (hiddenChildRows[row.data().id]) {
                hideExpandedChildren(table, row)
            }
        }
    )
}

function renderChildrenOf (parentRow, data) {
    const parentPadding = $(parentRow).find('td').css('padding-left').replace('px', '')
    const childPadding = parseInt(parentPadding) + 5

    // this is an array of previously hidden rows
    const children = hiddenChildRows[data.id]
    $(children).find('td').css('border', '0').css('padding-left', `${childPadding}px`)
    return $(children).show()
}


/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestrunsEnvironmentReadyHandler: () => (/* binding */ pageTestrunsEnvironmentReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_properties__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(11);


function pageTestrunsEnvironmentReadyHandler () {
    const objectId = $('#environment_pk').data('pk')

    ;(0,_static_js_properties__WEBPACK_IMPORTED_MODULE_0__.propertiesCard)(objectId, 'environment', 'Environment.properties', 'Environment.add_property', 'Environment.remove_property')
}


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   bindDeleteLinkButton: () => (/* binding */ bindDeleteLinkButton),
/* harmony export */   pageTestrunsGetReadyHandler: () => (/* binding */ pageTestrunsGetReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_bugs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(10);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _static_js_properties__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(11);
/* harmony import */ var _static_js_tags__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4);
/* harmony import */ var _static_js_simplemde_security_override__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(16);







const allExecutionStatuses = {}
const allExecutions = {}
const expandedExecutionIds = []
const permissions = {
    removeTag: false,
    addComment: false,
    removeComment: false,
    viewHistoricalTestExecution: false
}
const autocompleteCache = {}

function renderAttachmentCounts (query) {
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.count_attachments', query, counts => {
        for (const teId of Object.keys(counts)) {
            const jsAttachments = $(`.test-execution-${teId}`).find('.js-attachments')
            if (!counts[teId].total) {
                jsAttachments.addClass('hidden')
                continue
            }

            jsAttachments.removeClass('hidden')
            jsAttachments.find('.test-execution-attachment-count').text(counts[teId].total)
        }
    })
}

function showLastBugForTe (testExecutionRow, bugUrl) {
    const jsBugs = testExecutionRow.find('.js-bugs')
    jsBugs.removeClass('hidden')

    const lastBugAnchor = jsBugs.find('a')
    lastBugAnchor.attr('href', bugUrl)

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Bug.details', bugUrl, (details) => {
        lastBugAnchor.text(`${details.id} - ${details.status}`)
        lastBugAnchor.attr('title', details.title)
    })
}

function pageTestrunsGetReadyHandler () {
    permissions.removeTag = $('#test_run_pk').data('perm-remove-tag') === 'True'
    permissions.addComment = $('#test_run_pk').data('perm-add-comment') === 'True'
    permissions.removeComment = $('#test_run_pk').data('perm-remove-comment') === 'True'
    permissions.viewHistoricalTestExecution = $('#test_run_pk').data('perm-view-historical-testexecution') === 'True'

    const testRunId = $('#test_run_pk').data('pk')

    ;(0,_static_js_properties__WEBPACK_IMPORTED_MODULE_2__.propertiesCard)(testRunId, 'run', 'TestRun.properties', undefined, undefined)

    $('#start-button').on('click', function () {
        const timeZone = $('#clock').data('time-zone')
        const now = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.currentTimeWithTimezone)(timeZone)

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestRun.update', [testRunId, { start_date: now }], testRun => {
            const startDate = moment(testRun.start_date).format('DD MMM YYYY, HH:mm a')
            $('.start-date').html(startDate)
            $(this).hide()
        })
    })

    $('#stop-button').on('click', function () {
        const timeZone = $('#clock').data('time-zone')
        const now = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.currentTimeWithTimezone)(timeZone)

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestRun.update', [testRunId, { stop_date: now }], testRun => {
            const stopDate = moment(testRun.stop_date).format('DD MMM YYYY, HH:mm a')
            $('.stop-date').html(stopDate)
            $(this).hide()
            $('#test_run_pk').parent('h1').css({ 'text-decoration': 'line-through' })
        })
    })

    $('.js-bulk-create-testrun').click(function () {
        $(this).parents('.dropdown').toggleClass('open')

        const selected = selectedCheckboxes()
        if ($.isEmptyObject(selected)) {
            return false
        }

        const planId = Number($('#test_run_pk').data('plan-pk'))
        window.location.assign(`/runs/new?p=${planId}&c=${selected.caseIds.join('&c=')}`)

        return false
    })

    $('.add-comment-bulk').click(function () {
        $(this).parents('.dropdown').toggleClass('open')

        const selected = selectedCheckboxes()
        if ($.isEmptyObject(selected)) {
            return false
        }

        const enterCommentText = $('#test_run_pk').data('trans-comment')
        const comment = prompt(enterCommentText)
        if (!comment) {
            return false
        }

        selected.executionIds.forEach(executionId => {
            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.add_comment', [executionId, comment], () => {
                reloadRowFor(allExecutions[executionId])
            })
        })

        return false
    })

    $('.add-hyperlink-bulk').click(function () {
        $(this).parents('.dropdown').toggleClass('open')

        const selected = selectedCheckboxes()
        if ($.isEmptyObject(selected)) {
            return false
        }

        return addLinkToExecutions(selected.executionIds)
    })

    $('.remove-execution-bulk').click(function () {
        $(this).parents('.dropdown').toggleClass('open')
        const selected = selectedCheckboxes()
        if ($.isEmptyObject(selected)) {
            return false
        }

        const areYouSureText = $('#test_run_pk').data('trans-are-you-sure')
        if (confirm(areYouSureText)) {
            removeCases(selected.executionIds)
        }

        return false
    })

    $('.change-assignee-bulk').click(function () {
        $(this).parents('.dropdown').toggleClass('open')
        changeAssigneeBulk()

        return false
    })

    $('.change-tested-by-bulk').click(function () {
        $(this).parents('.dropdown').toggleClass('open')
        changeTestedByBulk()

        return false
    })

    $('.update-case-text-bulk').click(function () {
        $(this).parents('.dropdown').toggleClass('open')
        updateCaseText()

        return false
    })

    $('.bulk-change-status').click(function () {
        $(this).parents('.dropdown').toggleClass('open')
        // `this` is the clicked link
        const statusId = $(this).data('status-id')
        changeStatusBulk(statusId)

        // so that we don't follow the link
        return false
    })

    // bind everything in tags table
    ;(0,_static_js_tags__WEBPACK_IMPORTED_MODULE_3__.tagsCard)('TestRun', testRunId, { run: testRunId }, permissions.removeTag)

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecutionStatus.filter', {}, executionStatuses => {
        // convert from list to a dict for easier indexing later
        for (let i = 0; i < executionStatuses.length; i++) {
            allExecutionStatuses[executionStatuses[i].id] = executionStatuses[i]
        }

        const rpcQuery = { run_id: testRunId }

        // if page has URI params then try filtering, e.g. by status
        const filterParams = new URLSearchParams(location.search)
        if (filterParams.has('status_id')) {
            rpcQuery.status_id__in = filterParams.getAll('status_id')
        }

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.filter', rpcQuery, testExecutions => {
            drawPercentBar(testExecutions, false)
            renderTestExecutions(testExecutions)
            renderAdditionalInformation(testRunId)
        })
    })

    $('.bulk-select-checkbox').click(event => {
        const isChecked = event.target.checked
        const testExecutionSelectors = $('#test-executions-container').find('.test-execution-checkbox:visible')

        testExecutionSelectors.each((_index, te) => { te.checked = isChecked })
    })

    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.quickSearchAndAddTestCase)(testRunId, addTestCaseToRun, autocompleteCache, { case_status__is_confirmed: true })
    $('#btn-search-cases').click(function () {
        return (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.advancedSearchAndAddTestCases)(
            testRunId, 'TestRun.add_case', $(this).attr('href'),
            $('#test_run_pk').data('trans-error-adding-cases')
        )
    })

    $('.js-toolbar-filter-options li').click(function (ev) {
        return (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.changeDropdownSelectedItem)(
            '.js-toolbar-filter-options',
            '#input-filter-button',
            ev.target,
            $('#toolbar-filter')
        )
    })

    $('#toolbar-filter').on('keyup', function () {
        const filterValue = $(this).val().toLowerCase()
        const filterBy = $('.js-toolbar-filter-options .selected')[0].dataset.filterType

        filterTestExecutionsByProperty(
            testRunId,
            Object.values(allExecutions),
            filterBy,
            filterValue
        )
    })

    // assigned-to-me button
    document.getElementById('id_assigned_to_me').onchange = () => {
        const isChecked = $('#id_assigned_to_me').is(':checked')
        const filterValue = isChecked ? $('#test_run_pk').data('current-user') : ''

        // update the filter widget which will do the actual filtering
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.changeDropdownSelectedItem)(
            '.js-toolbar-filter-options',
            '#input-filter-button',
            $('.js-toolbar-filter-options [data-filter-type="assignee__username"]').find('a')[0],
            $('#toolbar-filter')
        )
        $('#toolbar-filter').val(filterValue)
        $('#toolbar-filter').keyup()
    }

    // email notifications card
    $('#add-cc').click(() => {
        const username = prompt($('#test_run_pk').data('trans-enter-assignee-name-or-email'))

        if (!username) {
            return false
        }

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestRun.add_cc', [testRunId, username], result => {
            // todo: instead of reloading render this in the form above
            window.location.reload(true)
        })
    })

    $('.js-remove-cc').click((event) => {
        const uid = $(event.target).parent('[data-uid]').data('uid')

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestRun.remove_cc', [testRunId, uid], result => {
            $(event.target).parents('tr').hide()
        })
    })
}

function isFiltered () {
    const filterParams = new URLSearchParams(location.search)
    return $('#toolbar-filter').val() !== '' || filterParams.has('status_id')
}

function filterTestExecutionsByProperty (runId, executions, filterBy, filterValue) {
    // no input => show all rows
    if (filterValue.trim().length === 0) {
        $('.test-execution-element').show()
        $('.test-executions-count').text(executions.length)
        return
    }

    if (filterBy === 'is_automated' && filterValue !== '0' && filterValue !== '1') {
        alert($('#test_run_pk').data('trans-bool-value-required'))
        return
    }

    $('.test-execution-element').hide()

    if (filterBy === 'is_automated' || filterBy === 'priority' || filterBy === 'category') {
        const query = { run: runId }
        if (filterBy === 'is_automated') {
            query.case__is_automated = filterValue
        } else if (filterBy === 'priority') {
            query.case__priority__value__icontains = filterValue
        } else if (filterBy === 'category') {
            query.case__category__name__icontains = filterValue
        }

        // note: querying TEs so that -FromAPIData() can work properly!
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.filter', query, function (filtered) {
            // hide again if a previous async request showed something else
            $('.test-execution-element').hide()

            const rows = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.findSelectorsToShowAndHideFromAPIData)(executions, filtered, '.test-execution-{0}')
            ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.showOrHideMultipleRows)('.test-execution-element', rows)
            $('.test-executions-count').text(rows.show.length)
        })
    } else {
        const rows = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.findSelectorsToShowAndHide)(executions, filterBy, filterValue, '.test-execution-{0}')
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.showOrHideMultipleRows)('.test-execution-element', rows)
        $('.test-executions-count').text(rows.show.length)
    }
}

function addTestCaseToRun (runId) {
    const caseName = $('#search-testcase')[0].value
    const testCase = autocompleteCache[caseName]

    // test case is already present so don't add it
    const allCaseIds = Object.values(allExecutions).map(te => te.case)
    if (allCaseIds.indexOf(testCase.id) > -1) {
        $('#search-testcase').val('')
        return false
    }

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestRun.add_case', [runId, testCase.id], function (result) {
        // IMPORTANT: the API result includes a 'sortkey' field value!
        window.location.reload(true)

        // TODO: remove the page reload above and add the new case to the list
        $('#search-testcase').val('')
    })
}

function selectedCheckboxes () {
    const allSelected = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.selectedVisibleCheckboxes)(
        '.test-execution-checkbox',
        $('#test_run_pk').data('trans-no-executions-selected')
    )

    if (!allSelected.length) {
        return {}
    }

    const testCaseIds = []
    const testExecutionIds = []
    allSelected.each((_index, checkbox) => {
        checkbox = $(checkbox)

        const testExecutionId = checkbox.data('test-execution-id')
        testExecutionIds.push(testExecutionId)

        const testCaseId = checkbox.data('test-execution-case-id')
        testCaseIds.push(testCaseId)
    })

    return {
        caseIds: testCaseIds,
        executionIds: testExecutionIds
    }
}

function drawPercentBar (testExecutions, updateTestRun = false) {
    let positiveCount = 0
    let negativeCount = 0
    const allCount = testExecutions.length
    const statusCount = {}
    Object.values(allExecutionStatuses).forEach(s => (statusCount[s.name] = { count: 0, id: s.id }))

    testExecutions.forEach(testExecution => {
        const executionStatus = allExecutionStatuses[testExecution.status]

        if (executionStatus.weight > 0) {
            positiveCount++
        } else if (executionStatus.weight < 0) {
            negativeCount++
        }

        statusCount[executionStatus.name].count++
    })

    renderProgressBars(positiveCount, negativeCount, allCount)
    renderCountPerStatusList(statusCount)

    if (updateTestRun) {
        // first non-zero status reported => TR is started
        if (positiveCount + negativeCount === 1 && $('.start-date').html().trim().replace('-', '') === '') {
            $('#start-button').click()
            return
        }

        // there are no more neutral executions left => TR is finished; update timestamp
        if (positiveCount + negativeCount === allCount && $('.stop-date').html().trim().replace('-', '') === '') {
            $('#stop-button').click()
        }
    }
}

function renderProgressBars (positiveCount, negativeCount, allCount) {
    const positivePercent = +(positiveCount / allCount * 100).toFixed(2)
    const positiveBar = $('.progress > .progress-completed')
    if (positivePercent) {
        positiveBar.text(`${positivePercent}%`)
    }
    positiveBar.css('width', `${positivePercent}%`)
    positiveBar.attr('aria-valuenow', `${positivePercent}`)

    const negativePercent = +(negativeCount / allCount * 100).toFixed(2)
    const negativeBar = $('.progress > .progress-failed')
    if (negativePercent) {
        negativeBar.text(`${negativePercent}%`)
    }
    negativeBar.css('width', `${negativePercent}%`)
    negativeBar.attr('aria-valuenow', `${negativePercent}`)

    const neutralPercent = +(100 - (negativePercent + positivePercent)).toFixed(2)
    const neutralBar = $('.progress > .progress-bar-remaining')
    if (neutralPercent) {
        neutralBar.text(`${neutralPercent}%`)
    }
    neutralBar.css('width', `${neutralPercent}%`)
    neutralBar.attr('aria-valuenow', `${neutralPercent}`)

    $('.total-execution-count').text(allCount)
}

function renderCountPerStatusList (statusCount) {
    for (const status in statusCount) {
        const statusId = statusCount[status].id

        $(`#count-for-status-${statusId}`).attr('href', `?status_id=${statusId}`).text(statusCount[status].count)
    }
}

function renderTestExecutions (testExecutions) {
    // sort executions by sortkey
    testExecutions.sort(function (te1, te2) {
        return te1.sortkey - te2.sortkey
    })
    const container = $('#test-executions-container')

    testExecutions.forEach(testExecution => {
        container.append(renderTestExecutionRow(testExecution))
    })

    bindEvents()

    $('.test-executions-count').html(testExecutions.length)
}

function bindEvents (selector) {
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.treeViewBind)(selector)

    $('.test-execution-element').click(function (ev) {
    // don't trigger row expansion when kebab menu is clicked
        if ($(ev.target).is('button, a, input, .fa-ellipsis-v')) {
            return
        }

        const tePK = $(ev.target)
            .parents('.test-execution-element')
            .find('.test-execution-checkbox')
            .data('test-execution-id')

        // row was expanded once, dom is ready
        if (expandedExecutionIds.indexOf(tePK) > -1) {
            return
        }
        expandedExecutionIds.push(tePK)

        getExpandArea(allExecutions[tePK])
    })
}

function getExpandArea (testExecution) {
    const container = $(`.test-execution-${testExecution.id}`)

    container.find('.test-execution-information .run-date').html(testExecution.stop_date || '-')
    container.find('.test-execution-information .build').html(testExecution.build__name)
    container.find('.test-execution-information .text-version').html(testExecution.case_text_version)

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestCase.history',
        [testExecution.case, {
            history_id: testExecution.case_text_version
        }], (data) => {
            data.forEach((entry) => {
                ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.markdown2HTML)(entry.text, container.find('.test-execution-text')[0])
                container.find('.test-execution-notes').append(entry.notes)
            })
        })

    const commentsRow = container.find('.comments')
    const simpleMDEinitialized = container.find('.comment-form').data('simple-mde-initialized')
    if (!simpleMDEinitialized) {
        const textArea = container.find('textarea')[0]
        const fileUpload = container.find('input[type="file"]')
        const editor = (0,_static_js_simplemde_security_override__WEBPACK_IMPORTED_MODULE_5__.initSimpleMDE)(textArea, $(fileUpload), textArea.id)
        container.find('.comment-form').data('simple-mde-initialized', true)

        container.find('.post-comment').click(() => {
            const input = editor.value().trim()

            if (input) {
                (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.add_comment', [testExecution.id, input], comment => {
                    editor.value('')

                    commentsRow.append((0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.renderCommentHTML)(
                        1 + container.find('.js-comment-container').length,
                        comment,
                        $('template#comment-template')[0],
                        parentNode => {
                            ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.bindDeleteCommentButton)(
                                testExecution.id,
                                'TestExecution.remove_comment',
                                permissions.removeComment,
                                parentNode)
                        }))
                })
            }
        })

        container.find('.change-status-button').click(function () {
            const statusId = $(this).attr('data-status-id')

            const comment = editor.value().trim()
            addCommentToExecution(testExecution, comment, () => {
                editor.value('')
            })

            const $this = $(this)
            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.update', [testExecution.id, testExecutionUpdateArgs(statusId)], execution => {
                // update TestRun if not filtered
                reloadRowFor(execution, !isFiltered())

                $this.parents('.list-group-item-container').addClass('hidden')
                // click the .list-group-item-header, not the .test-execution-element itself, because otherwise the handler will fail
                $this.parents('.test-execution-element').next().find('.list-group-item-header').click()
            })
        })
    }

    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.renderCommentsForObject)(
        testExecution.id,
        'TestExecution.get_comments',
        'TestExecution.remove_comment',
        permissions.removeComment,
        commentsRow
    )

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.get_links', { execution_id: testExecution.id }, links => {
        const ul = container.find('.test-execution-hyperlinks')
        ul.innerHTML = ''
        links.forEach(link => ul.append(renderLink(link)))
        bindDeleteLinkButton()
    })

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestCase.list_attachments', [testExecution.case], testCaseAttachments => {
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.list_attachments', [testExecution.id], testExecutionAttachments => {
            const attachments = testCaseAttachments.concat(testExecutionAttachments)
            const ul = container.find('.test-case-attachments')

            if (!attachments.length) {
                ul.find('.hidden').removeClass('hidden')
                return
            }

            const liTemplate = $('#attachments-list-item')[0].content

            attachments.forEach(attachment => {
                const li = liTemplate.cloneNode(true)
                const attachmentLink = $(li).find('a')[0]

                attachmentLink.href = attachment.url
                attachmentLink.innerText = attachment.url.split('/').slice(-1)[0]
                ul.append(li)
            })
        })
    })

    if (permissions.viewHistoricalTestExecution) {
        (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.history', testExecution.id, history => {
            const historyContainer = container.find('.history-container')
            history.forEach(h => {
                historyContainer.append(renderHistoryEntry(h))
            })
        })
    }
}

function addCommentToExecution (testExecution, input, handler) {
    if (!input) {
        return
    }

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.add_comment', [testExecution.id, input], handler)
}

function renderAdditionalInformation (testRunId, execution) {
    let linksQuery = { execution__run: testRunId }
    let casesQuery = { executions__run: testRunId }
    let componentQ = { cases__executions__run: testRunId }
    let tagsQ = { case__executions__run: testRunId }
    let propertiesQ = { execution__run: testRunId }
    let attachmentsQ = { run_id: testRunId }
    const planId = Number($('#test_run_pk').data('plan-pk'))

    // if called from reloadRowFor(execution) then filter only for
    // that one row
    if (execution) {
        linksQuery = { execution: execution.id }
        casesQuery = { executions: execution.id }
        componentQ = { cases__executions: execution.id }
        tagsQ = { case__executions: execution.id }
        propertiesQ = { execution: execution.id }
        attachmentsQ = { id: execution.id }
    }

    renderAttachmentCounts(attachmentsQ)

    // update bug icons for all executions
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.get_links', linksQuery, (links) => {
        const withDefects = {}
        links.forEach((link) => {
            if (link.is_defect) {
                withDefects[link.execution] = link
            }
        })
        for (const teId of Object.keys(withDefects)) {
            const lastBug = withDefects[teId]
            showLastBugForTe($(`.test-execution-${teId}`), lastBug.url)
        }
    })

    // update properties display
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.properties', propertiesQ, (props) => {
        const propsPerTe = props.reduce(function (map, obj) {
            if (!(obj.execution in map)) {
                map[obj.execution] = {}
            }
            map[obj.execution][obj.name] = obj.value
            return map
        }, {})

        for (const teId of Object.keys(propsPerTe)) {
            const row = $(`.test-execution-${teId}`)

            // when loading this page filtered by status some TCs do not exist
            // but we don't know about it b/c the above queries are overzealous
            if (!row.length) { continue }

            let propString = ''
            for (const name of Object.keys(propsPerTe[teId])) {
                propString += `${name}: ${propsPerTe[teId][name]}; `
            }

            const propertiesRow = row.find('.js-row-properties')
            propertiesRow.toggleClass('hidden')
            propertiesRow.html(propertiesRow.html() + propString + '<br>')
        }
    })

    // update priority, category & automation status for all executions
    // also tags & components via nested API calls
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Component.filter', componentQ, components => {
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Tag.filter', tagsQ, tags => {
            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestCase.filter', casesQuery, testCases => {
                ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestCase.filter', { plan: planId }, function (casesInPlan) {
                    casesInPlan = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.arrayToDict)(casesInPlan)
                    casesInPlan = Object.keys(casesInPlan).map(id => parseInt(id))

                    for (const testCase of testCases) {
                        let rowSelector = `.test-execution-case-${testCase.id}`
                        // Preferably operate over the exact execution row to prevent
                        // appending new HTML onto existing values, e.g. Tags. See #3367
                        //
                        // Root cause of the bug in #3367 is that some fields contain icons
                        // and pre-existing HTML coming from the template and we can't call .empty()
                        // on them. When such TE is parametrized then there are multiple HTML rows
                        // matching `rowSelector`/`testCase.id`, therefore the UI is appended to many times!
                        if (execution) {
                            rowSelector += `.test-execution-${execution.id}`
                        }
                        const row = $(rowSelector)

                        // when loading this page filtered by status some TCs do not exist
                        // but we don't know about it b/c the above queries are overzealous
                        if (!row.length) { continue }

                        row.find('.test-execution-priority').html(testCase.priority__value)
                        row.find('.test-execution-category').html(testCase.category__name)

                        const isAutomatedElement = row.find('.test-execution-automated')
                        const isAutomatedIcon = testCase.is_automated ? 'fa-cog' : 'fa-hand-paper-o'
                        const isAutomatedAttr = testCase.is_automated ? isAutomatedElement.data('automated') : isAutomatedElement.data('manual')
                        isAutomatedElement.addClass(isAutomatedIcon)
                        isAutomatedElement.attr('title', isAutomatedAttr)

                        // test case isn't part of the parent test plan
                        if (casesInPlan.indexOf(testCase.id) === -1) {
                            row.find('.js-tc-not-in-tp').toggleClass('hidden')
                        }

                        // render tags and components if available
                        testCase.tagNames = []
                        // todo: this is sub-optimal b/c it searches whether tag is attached
                        // to the current testCase and does so for every case in the list
                        for (let i = 0; i < tags.length; i++) {
                            if (tags[i].case === testCase.id && testCase.tagNames.indexOf(tags[i].name) === -1) {
                                testCase.tagNames.push(tags[i].name)
                            }
                        }
                        if (testCase.tagNames.length) {
                            const tagsRow = row.find('.js-row-tags')
                            tagsRow.toggleClass('hidden')
                            tagsRow.html(tagsRow.html() + testCase.tagNames.join(', '))
                        }

                        testCase.componentNames = []
                        // todo: this is sub-optimal b/c it searches whether component is attached
                        // to the current testCase and does so for every case in the list
                        for (let i = 0; i < components.length; i++) {
                            if (components[i].cases === testCase.id) {
                                testCase.componentNames.push(components[i].name)
                            }
                        }
                        if (testCase.componentNames.length) {
                            const componentsRow = row.find('.js-row-components')
                            componentsRow.toggleClass('hidden')
                            componentsRow.html(componentsRow.html() + testCase.componentNames.join(', '))
                        }

                        // update internal data structure
                        const teID = row.find('.test-execution-checkbox').data('test-execution-id')
                        allExecutions[teID].tags = testCase.tagNames
                        allExecutions[teID].components = testCase.componentNames
                    }
                })
            })
        })
    })
}

function renderHistoryEntry (historyEntry) {
    if (!historyEntry.history_change_reason) {
        return ''
    }

    const template = $($('#history-entry')[0].content.cloneNode(true))

    template.find('.history-date').html(historyEntry.history_date)
    template.find('.history-user').html(historyEntry.history_user__username)

    // convert to markdown code block for the diff language
    const changeReason = `\`\`\`diff\n${historyEntry.history_change_reason}\n\`\`\``
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.markdown2HTML)(changeReason, template.find('.history-change-reason')[0])

    return template
}

function renderTestExecutionRow (testExecution) {
    // refresh the internal data structure b/c some fields are used
    // to render the expand area and may have changed via bulk-update meanwhile
    testExecution.status__name = $('#test_run_pk').data(`trans-execution-status-${testExecution.status}`)
    allExecutions[testExecution.id] = testExecution

    const testExecutionRowTemplate = $('#test-execution-row')[0].content
    const template = $(testExecutionRowTemplate.cloneNode(true))

    template.find('.test-execution-checkbox').data('test-execution-id', testExecution.id)
    template.find('.test-execution-checkbox').data('test-execution-case-id', testExecution.case)
    template.find('.test-execution-element').attr('id', `test-execution-${testExecution.id}`)
    template.find('.test-execution-element').addClass(`test-execution-${testExecution.id}`)
    template.find('.test-execution-element').addClass(`test-execution-case-${testExecution.case}`)
    template.find('.test-execution-info').html(`TE-${testExecution.id}/TC-${testExecution.case}:`)
    template.find('.test-execution-info-link').html(testExecution.case__summary)
    template.find('.test-execution-info-link').attr('href', `/case/${testExecution.case}/`)
    template.find('.test-execution-tester').html(testExecution.tested_by__username || '-')
    template.find('.test-execution-asignee').html(testExecution.assignee__username || '-')

    const testExecutionStatus = allExecutionStatuses[testExecution.status]
    template.find('.test-execution-status-icon').addClass(testExecutionStatus.icon).css('color', testExecutionStatus.color)
    template.find('.test-execution-status-name').html(testExecution.status__name).css('color', testExecutionStatus.color)

    template.find('.add-link-button').click(() => addLinkToExecutions([testExecution.id]))
    template.find('.one-click-bug-report-button').click(() => fileBugFromExecution(testExecution))

    // remove from expanded list b/c data may have changed
    expandedExecutionIds.splice(expandedExecutionIds.indexOf(testExecution.id), 1)

    // WARNING: only comments related stuff below
    if (!permissions.addComment) {
        template.find('.comment-form').hide()
        return template
    }

    template.find('textarea')[0].id = `comment-for-testexecution-${testExecution.id}`
    template.find('input[type="file"]')[0].id = `file-upload-for-testexecution-${testExecution.id}`

    return template
}

function changeStatusBulk (statusId) {
    const selected = selectedCheckboxes()
    if ($.isEmptyObject(selected)) {
        return false
    }

    const updateArgs = testExecutionUpdateArgs(statusId)
    selected.executionIds.forEach(executionId => {
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.update', [executionId, updateArgs], execution => {
            // update TestRun if not filtered
            reloadRowFor(execution, !isFiltered())
        })
    })
}

function reloadRowFor (execution, updateTestRun = false) {
    const testExecutionRow = $(`.test-execution-${execution.id}`)
    ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.animate)(testExecutionRow, () => {
        testExecutionRow.replaceWith(renderTestExecutionRow(execution))
        // note: this is here b/c animate() is async and we risk race conditions
        // b/c we use global variables for state. The drawback is that progress
        // will be updated even if statuses aren't changed !!!
        drawPercentBar(Object.values(allExecutions), updateTestRun)
        renderAdditionalInformation(execution.run_id, execution)

        bindEvents(`.test-execution-${execution.id}`)
    })
}

function changeAssigneeBulk () {
    const selected = selectedCheckboxes()
    if ($.isEmptyObject(selected)) {
        return false
    }

    const enterAssigneeText = $('#test_run_pk').data('trans-enter-assignee-name-or-email')
    const assignee = prompt(enterAssigneeText)

    if (!assignee) {
        return false
    }
    selected.executionIds.forEach(executionId => {
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.update', [executionId, { assignee }], execution => {
            reloadRowFor(execution)
        })
    })
}

function changeTestedByBulk () {
    const selected = selectedCheckboxes()
    if ($.isEmptyObject(selected)) {
        return false
    }

    const enterTesterText = $('#test_run_pk').data('trans-enter-tested-by-name-or-email')
    const testedBy = prompt(enterTesterText)

    if (!testedBy) {
        return false
    }
    selected.executionIds.forEach(executionId => {
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.update', [executionId, { tested_by: testedBy }], execution => {
            reloadRowFor(execution)
        })
    })
}

function updateCaseText () {
    const selected = selectedCheckboxes()
    if ($.isEmptyObject(selected)) {
        return false
    }

    selected.executionIds.forEach(executionId =>
        (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.update', [executionId, { case_text_version: 'latest' }], execution => {
            reloadRowFor(execution)
        })
    )
}

function fileBugFromExecution (execution) {
    // remove all previous event handlers
    $('.one-click-bug-report-form').off('submit')

    // this handler must be here, because if we bind it when the page is loaded.
    // we have no way of knowing for what execution ID the form is submitted for.
    $('.one-click-bug-report-form').submit(() => {
        const trackerId = $('.one-click-bug-report-form #id-issue-tracker').val()
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Bug.report', [execution.id, trackerId], result => {
            // close the modal
            $('#one-click-bug-report-modal button.close').click()

            if (result.rc !== 0) {
                alert(result.response)
                return
            }

            reloadRowFor(execution)

            // unescape b/c Issue #1533
            const targetUrl = result.response.replace(/&amp;/g, '&')
            showLastBugForTe($(`.test-execution-${execution.id}`), targetUrl)
            window.open(targetUrl, '_blank')
        })
        return false
    })

    return true // so that the modal is opened
}

function addLinkToExecutions (testExecutionIDs) {
    // remove all previous event handlers
    $('.add-hyperlink-form').off('submit')

    // this handler must be here, because if we bind it when the page is loaded.
    // we have no way of knowing for what execution ID the form is submitted for.
    $('.add-hyperlink-form').submit(() => {
        const url = $('.add-hyperlink-form #id_url').val()
        const name = $('.add-hyperlink-form #id_name').val()
        const isDefect = $('.add-hyperlink-form #defectCheckbox').is(':checked')
        const updateTracker = true

        testExecutionIDs.forEach(testExecutionId => {
            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.add_link', [{
                execution_id: testExecutionId,
                url,
                name,
                is_defect: isDefect
            }, updateTracker], link => {
                const testExecutionRow = $(`div.list-group-item.test-execution-${testExecutionId}`)
                ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.animate)(testExecutionRow, () => {
                    if (link.is_defect) {
                        showLastBugForTe(testExecutionRow, link.url)
                    }
                    const ul = testExecutionRow.find('.test-execution-hyperlinks')
                    ul.append(renderLink(link))
                    bindDeleteLinkButton()
                })
            })
        })

        // clean the values
        $('.add-hyperlink-form #id_name').val('')
        $('.add-hyperlink-form #id_url').val('')
        $('.add-hyperlink-form #defectCheckbox').bootstrapSwitch('state', false)
        $('.add-hyperlink-form #autoUpdateCheckbox').bootstrapSwitch('state', false)

        // close the modal
        $('#add-link-modal button.close').click()

        return false
    })

    return true // so that the modal is opened
}

function renderLink (link) {
    const linkEntryTemplate = $('#link-entry')[0].content
    const template = $(linkEntryTemplate.cloneNode(true))
    if (link.is_defect) {
        template.find('.link-icon').addClass('fa fa-bug')
        const bugTooltip = template.find('.bug-tooltip')
        bugTooltip.css('visibility', 'visible')

        template.find('[data-toggle=popover]')
            .popovers()
            .on('show.bs.popover', () => (0,_static_js_bugs__WEBPACK_IMPORTED_MODULE_0__.fetchBugDetails)({ href: link.url }, bugTooltip))
    }

    const linkUrlEl = template.find('.link-url')
    linkUrlEl.html(link.name || link.url)
    linkUrlEl.attr('href', link.url)
    template.find('.js-remove-linkreference').attr('data-link-id', link.id)
    template.find('li').attr('data-link-id', link.id)

    return template
}

function bindDeleteLinkButton () {
    $('.js-remove-linkreference').click(function (event) {
        const row = $(event.target).parents('li')
        const linkId = $(event.target).parent('.js-remove-linkreference').data('link-id')

        if (linkId) {
            (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.remove_link', { pk: linkId }, () => {
                $(row).fadeOut(500)
            })
        }
        return false
    })
}

function removeCases (executionIds) {
    for (const executionId of executionIds) {
        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('TestExecution.remove', { id: executionId }, () => {
            $(`#test-execution-${executionId}`).remove()

            expandedExecutionIds.splice(expandedExecutionIds.indexOf(executionId), 1)
            delete allExecutions[executionId]

            const testExecutionCountEl = $('.test-executions-count')
            const count = parseInt(testExecutionCountEl[0].innerText)
            testExecutionCountEl.html(count - 1)
        }, true)
    }

    drawPercentBar(Object.values(allExecutions))
}

function testExecutionUpdateArgs (statusId) {
    const statusWeight = allExecutionStatuses[statusId].weight

    const updateArgs = { status: statusId, stop_date: '' }
    if (statusWeight !== 0) {
        const timeZone = $('#clock').data('time-zone')
        updateArgs.stop_date = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_4__.currentTimeWithTimezone)(timeZone)
    }

    return updateArgs
}


/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestrunsMutableReadyHandler: () => (/* binding */ pageTestrunsMutableReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);




function pageTestrunsMutableReadyHandler () {
    (0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_planned_start')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_planned_stop')

    $('#add_id_product').click(function () {
        return showRelatedObjectPopup(this)
    })

    document.getElementById('id_product').onchange = () => {
        $('#id_product').selectpicker('refresh')
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.updateTestPlanSelectFromProduct)({ is_active: true, parent: null }, function (inputData, callbackF) {
            ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.discoverNestedTestPlans)(inputData, callbackF)

            // trigger on-change handler, possibly updating build
            $('#id_test_plan').change()
        })
    }

    document.getElementById('id_test_plan').onchange = () => {
        $('#id_test_plan').selectpicker('refresh')

        const updateCallback = function (data) {
            ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.updateSelect)(data, '#id_build', 'id', 'name')
        }

        const planId = $('#id_test_plan').val()
        if (planId) {
            (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Build.filter', { version__plans: planId, is_active: true }, updateCallback)
        } else {
            updateCallback([])
        }
    }

    document.getElementById('id_build').onchange = function () {
        $('#id_build').selectpicker('refresh')
    }

    $('#add_id_build').click(function () {
        return showRelatedObjectPopup(this)
    })
}


/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTestrunsSearchReadyHandler: () => (/* binding */ pageTestrunsSearchReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4);





function preProcessData (data, callbackF) {
    const runIds = []
    const productIds = []
    data.forEach(function (element) {
        runIds.push(element.id)
        productIds.push(element.build__version__product)
    })

    // get tags for all objects
    const tagsPerRun = {}
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Tag.filter', { run__in: runIds }, function (tags) {
        tags.forEach(function (element) {
            if (tagsPerRun[element.run] === undefined) {
                tagsPerRun[element.run] = []
            }

            // push only if unique
            if (tagsPerRun[element.run].indexOf(element.name) === -1) {
                tagsPerRun[element.run].push(element.name)
            }
        })

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.jsonRPC)('Product.filter', { pk__in: productIds }, function (products) {
            products = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.arrayToDict)(products)

            // augment data set with additional info
            data.forEach(function (element) {
                if (element.id in tagsPerRun) {
                    element.tag = tagsPerRun[element.id]
                } else {
                    element.tag = []
                }
                element.product_name = products[element.build__version__product].name
            })

            callbackF({ data }) // renders everything
        })
    })
}

function pageTestrunsSearchReadyHandler () {
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before_start_date')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after_start_date')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before_stop_date')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after_stop_date')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before_planned_start')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after_planned_start')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before_planned_stop')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after_planned_stop')

    const table = $('#resultsTable').DataTable({
        pageLength: $('#navbar').data('defaultpagesize'),
        ajax: function (data, callbackF, settings) {
            const params = {}

            if ($('#id_summary').val()) {
                params.summary__icontains = $('#id_summary').val()
            }

            if ($('#id_after_start_date').val()) {
                params.start_date__gte = $('#id_after_start_date').data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            if ($('#id_before_start_date').val()) {
                params.start_date__lte = $('#id_before_start_date').data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            if ($('#id_after_stop_date').val()) {
                params.stop_date__gte = $('#id_after_stop_date').data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            if ($('#id_before_stop_date').val()) {
                params.stop_date__lte = $('#id_before_stop_date').data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            if ($('#id_after_planned_start').val()) {
                params.planned_start__gte = $('#id_after_planned_start').data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            if ($('#id_before_planned_start').val()) {
                params.planned_start__lte = $('#id_before_planned_start').data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            if ($('#id_after_planned_stop').val()) {
                params.planned_stop__gte = $('#id_after_planned_stop').data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            if ($('#id_before_planned_stop').val()) {
                params.planned_stop__lte = $('#id_before_planned_stop').data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            if ($('#id_plan').val()) {
                params.plan = $('#id_plan').val()
            }

            if ($('#id_product').val()) {
                params.build__version__product = $('#id_product').val()
            };

            if ($('#id_version').val()) {
                params.build__version = $('#id_version').val()
            };

            if ($('#id_build').val()) {
                params.build = $('#id_build').val()
            };

            if ($('#id_manager').val()) {
                params.manager__username__startswith = $('#id_manager').val()
            };

            if ($('#id_default_tester').val()) {
                params.default_tester__username__startswith = $('#id_default_tester').val()
            };

            (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateParamsToSearchTags)('#id_tag', params)

            params.stop_date__isnull = $('#id_running').is(':checked')

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_1__.dataTableJsonRPC)('TestRun.filter', params, callbackF, preProcessData)
        },
        columns: [
            { data: 'id' },
            {
                data: null,
                render: function (data, type, full, meta) {
                    let result = '<a href="/runs/' + data.id + '/">' + (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.escapeHTML)(data.summary) + '</a>'
                    if (data.stop_date) {
                        result += '<p class="help-block">' + data.stop_date + '</p>'
                    }
                    return result
                }
            },
            {
                data: null,
                render: function (data, type, full, meta) {
                    return '<a href="/plan/' + data.plan + '/">TP-' + data.plan + ': ' + (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.escapeHTML)(data.plan__name) + '</a>'
                }
            },
            { data: 'product_name' },
            { data: 'build__version__value' },
            { data: 'build__name' },
            { data: 'start_date' },
            { data: 'stop_date' },
            { data: 'manager__username' },
            { data: 'default_tester__username' },
            { data: 'tag' }
        ],
        dom: 'Biptip',
        buttons: _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_2__.exportButtons,
        language: {
            info: $('#main-element').data('trans-x-records-found'),
            infoEmpty: $('#main-element').data('trans-no-records-found'),
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            thousands: '',
            zeroRecords: $('#main-element').data('trans-no-records-found')
        },
        order: [[0, 'asc']]
    })

    $('#btn_search').click(function () {
        table.ajax.reload()
        return false // so we don't actually send the form
    })

    $('#id_product').change(function () {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateVersionSelectFromProduct)('#id_product', '#id_version')
    })

    $('#id_version').change(function () {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_3__.updateBuildSelectFromVersion)(true)
    })
}


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageManagementBuildAdminReadyHandler: () => (/* binding */ pageManagementBuildAdminReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);


function pageManagementBuildAdminReadyHandler () {
    const filterParams = new URLSearchParams(window.location.search)

    $('#id_product').change(function () {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_0__.updateVersionSelectFromProduct)('#id_product', '#id_version')
    })
    $('#id_version').change(() => {
        if (filterParams.has('version')) {
            const version = filterParams.get('version')
            $(`#id_version > option[value=${version}]`).attr('selected', true)
        }
    })

    if (filterParams.has('product')) {
        $('#id_product').change()
    }
}


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTelemetryReadyHandler: () => (/* binding */ pageTelemetryReadyHandler)
/* harmony export */ });
/* harmony import */ var _static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);
/* harmony import */ var _testing_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(25);
/* harmony import */ var _testing_breakdown__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(26);
/* harmony import */ var _testing_status_matrix__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(27);
/* harmony import */ var _testing_execution_dashboard__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(28);
/* harmony import */ var _testing_execution_trends__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(29);
/* harmony import */ var _testing_test_case_health__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(30);









function delayedHandler (handlerFunc, microSeconds = 1000) {
    let timer = null

    return function () {
        const context = this; const args = arguments
        clearTimeout(timer)
        timer = window.setTimeout(function () {
            handlerFunc.apply(context, args)
        },
        microSeconds)
    }
}

function pageTelemetryReadyHandler (pageId) {
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_before')
    ;(0,_static_js_datetime_picker__WEBPACK_IMPORTED_MODULE_0__.initializeDateTimePicker)('#id_after')

    const drawChart = {
        'page-telemetry-testing-breakdown': _testing_breakdown__WEBPACK_IMPORTED_MODULE_3__.reloadCharts,
        'page-telemetry-status-matrix': _testing_status_matrix__WEBPACK_IMPORTED_MODULE_4__.drawTable,
        'page-telemetry-execution-dashboard': _testing_execution_dashboard__WEBPACK_IMPORTED_MODULE_5__.drawTable,
        'page-telemetry-execution-trends': _testing_execution_trends__WEBPACK_IMPORTED_MODULE_6__.drawChart,
        'page-telemetry-test-case-health': _testing_test_case_health__WEBPACK_IMPORTED_MODULE_7__.reloadTable
    }[pageId]

    const initializePage = {
        'page-telemetry-testing-breakdown': _testing_breakdown__WEBPACK_IMPORTED_MODULE_3__.initializePage,
        'page-telemetry-status-matrix': _testing_status_matrix__WEBPACK_IMPORTED_MODULE_4__.initializePage,
        'page-telemetry-execution-dashboard': _testing_execution_dashboard__WEBPACK_IMPORTED_MODULE_5__.initializePage,
        'page-telemetry-execution-trends': () => {},
        'page-telemetry-test-case-health': _testing_test_case_health__WEBPACK_IMPORTED_MODULE_7__.initializePage
    }[pageId]

    initializePage()

    ;(0,_testing_utils__WEBPACK_IMPORTED_MODULE_2__.loadInitialProduct)()

    document.getElementById('id_product').onchange = () => {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.updateVersionSelectFromProduct)('#id_product', '#id_version')
        // note: don't pass drawChart as callback to avoid calling it twice
        // b/c update_version_select... triggers .onchange()
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.updateTestPlanSelectFromProduct)({ parent: null }, _static_js_utils__WEBPACK_IMPORTED_MODULE_1__.discoverNestedTestPlans)
    }

    document.getElementById('id_version').onchange = () => {
        drawChart()
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.updateBuildSelectFromVersion)(true)
    }
    document.getElementById('id_build').onchange = drawChart
    document.getElementById('id_test_plan').onchange = drawChart
    $('#id_test_run_summary').on('keyup', delayedHandler(drawChart))

    $('#id_after').on('dp.change', drawChart)
    $('#id_before').on('dp.change', drawChart)

    drawChart()

    // Close multiselect list when selecting an item
    // Iterate over all dropdown lists
    $('select[multiple]').each(function () {
        $(this).on('change', function () {
            $(this).parent('.bootstrap-select').removeClass('open')
        })
    })
}


/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loadInitialProduct: () => (/* binding */ loadInitialProduct),
/* harmony export */   showOnlyRoundNumbers: () => (/* binding */ showOnlyRoundNumbers)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);



function loadInitialProduct (callback = () => {}) {
    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Product.filter', {}, data => {
        ;(0,_static_js_utils__WEBPACK_IMPORTED_MODULE_1__.updateSelect)(data, '#id_product', 'id', 'name', null)
        callback()
    })
}

function showOnlyRoundNumbers (number) {
    return number % 1 === 0 ? number : ''
}


/***/ }),
/* 26 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initializePage: () => (/* binding */ initializePage),
/* harmony export */   reloadCharts: () => (/* binding */ reloadCharts)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(25);



function initializePage () {
    // widget not relevant in this context
    $('#version_and_build').hide()
}

function reloadCharts () {
    const query = {}

    const testPlanIds = $('#id_test_plan').val()
    const productIds = $('#id_product').val()

    if (testPlanIds.length) {
        query.plan__in = testPlanIds
    } else if (productIds.length) {
        query.category__product_id__in = productIds
    }

    const dateBefore = $('#id_before')
    if (dateBefore.val()) {
        query.create_date__lte = dateBefore.data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
    }

    const dateAfter = $('#id_after')
    if (dateAfter.val()) {
        query.create_date__gte = dateAfter.data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
    }

    const testRunSummary = $('#id_test_run_summary').val()
    if (testRunSummary) {
        query.executions__run__summary__icontains = testRunSummary
    }

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Testing.breakdown', query, result => {
        drawAutomatedBar(result.count)
        drawPrioritiesChart(result.priorities)
        drawCategoriesChart(result.categories)
    }, true)
}

function drawAutomatedBar (count) {
    d3.select('#total-count')
        .style('font-weight', 'bold')
        .style('font-size', '18px')
        .text(count.all)

    d3.selectAll('.progress-bar')
        .attr('aria-valuemin', '0')
        .attr('aria-valuemax', '100')

    d3.select('.automated-legend-text > span').remove()
    d3.select('.manual-legend-text > span').remove()

    d3.select('.automated-legend-text')
        .append('span')
        .text(` - ${count.automated}`)

    d3.select('.manual-legend-text')
        .append('span')
        .text(` - ${count.manual}`)

    const automatedPercent = count.automated / count.all * 100

    d3.select('.automated-bar')
        .attr('aria-valuenow', `${automatedPercent}`)
        .attr('title', `${count.automated} Automated`)
        .style('width', `${automatedPercent}%`)

    const manualPercent = count.manual / count.all * 100

    d3.select('.manual-bar')
        .attr('aria-valuenow', `${manualPercent}`)
        .attr('title', `${count.manual} Manual`)
        .style('width', `${manualPercent}%`)
}

function drawPrioritiesChart (priorities) {
    drawChart(priorities, 'priority', '#priorities-chart')
}

function drawCategoriesChart (categories) {
    drawChart(categories, 'category', '#categories-chart')
}

function drawChart (data, type, selector) {
    const categories = new Set()
    const groups = [[]]
    const chartData = []

    Object.values(data).forEach(entry => {
        Object.keys(entry).forEach(key => categories.add(key))
    })

    Object.entries(data).forEach(entry => {
        const group = entry[0]
        groups[0].push(group)

        const dataEntry = [group]

        categories.forEach(cat => {
            let count = entry[1][cat]
            if (!count) {
                count = 0
            }
            dataEntry.push(count)
        })

        chartData.push(dataEntry)
    })

    const chartConfig = $().c3ChartDefaults().getDefaultStackedBarConfig()
    chartConfig.bindto = selector
    chartConfig.axis = {
        x: {
            categories: Array.from(categories),
            type: 'category'
        },
        y: {
            tick: {
                format: _utils__WEBPACK_IMPORTED_MODULE_1__.showOnlyRoundNumbers
            }
        }
    }
    chartConfig.data = {
        columns: chartData,
        groups,
        type: 'bar',
        order: null
    }
    chartConfig.color = {
        pattern: [
            $.pfPaletteColors.blue,
            $.pfPaletteColors.red100
        ]
    }
    chartConfig.grid = {
        show: false
    }

    c3.generate(chartConfig)
}


/***/ }),
/* 27 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   drawTable: () => (/* binding */ drawTable),
/* harmony export */   initializePage: () => (/* binding */ initializePage)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);


let table
const initialColumn = {
    data: null,
    className: 'table-view-pf-actions',
    render: function (data, type, full, meta) {
        const caseId = data.case_id

        return '<span style="padding: 5px;">' +
            `<a href="/case/${caseId}/">TC-${caseId}: ${data.case__summary}</a>` +
            '</span>'
    }
}

function initializePage () {
    document.getElementById('id_order').onchange = drawTable
    document.getElementById('id_include_child_tps').onchange = drawTable

    $('#table').on('draw.dt', function () {
        setMaxHeight($(this))
    })

    $(window).on('resize', function () {
        setMaxHeight($('#table'))
    })
}

function setMaxHeight (t) {
    const maxH = 0.99 * (window.innerHeight - t.position().top)
    t.css('max-height', maxH)
}

function drawTable () {
    $('.js-spinner').show()
    if (table) {
        table.destroy()

        $('table > thead > tr > th:not(.header)').remove()
        $('table > tbody > tr').remove()
    }

    const query = {}

    const productIds = $('#id_product').val()
    if (productIds.length) {
        query.build__version__product__in = productIds
    }

    const versionIds = $('#id_version').val()
    if (versionIds.length) {
        query.build__version__in = versionIds
    }

    const buildIds = $('#id_build').val()
    if (buildIds.length) {
        query.build_id__in = buildIds
    }

    const testPlanIds = $('#id_test_plan').val()
    const includeChildTPs = $('#id_include_child_tps').is(':checked')
    if (testPlanIds.length) {
        query.run__plan__in = testPlanIds

        // note: executed synchronously to avoid race condition between
        // collecting the list of child TPs and drawing the table below
        if (includeChildTPs) {
            (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.filter', { parent__in: testPlanIds }, function (result) {
                result.forEach(function (element) {
                    query.run__plan__in.push(element.id)
                })
            }, true)
        }
    }

    const dateBefore = $('#id_before')
    if (dateBefore.val()) {
        query.stop_date__lte = dateBefore.data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
    }

    const dateAfter = $('#id_after')
    if (dateAfter.val()) {
        query.stop_date__gte = dateAfter.data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
    }

    const testRunSummary = $('#id_test_run_summary').val()
    if (testRunSummary) {
        query.run__summary__icontains = testRunSummary
    }

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Testing.status_matrix', query, data => {
        const tableColumns = [initialColumn]
        const testRunIds = Object.keys(data.runs)

        // reverse the TR-xy order to show newest ones first
        if (!$('#id_order').is(':checked')) {
            testRunIds.reverse()
        }

        testRunIds.forEach(testRunId => {
            const testRunSummary = data.runs[testRunId]
            $('.table > thead > tr').append(`
            <th class="header-test-run">
                <a href="/runs/${testRunId}/">TR-${testRunId}</a>
                <span class="fa pficon-help" data-toggle="tooltip" data-placement="bottom" title="${testRunSummary}"></span>
            </th>`)

            tableColumns.push({
                data: null,
                sortable: false,
                render: renderData(testRunId, testPlanIds, includeChildTPs, data)
            })
        })

        table = $('#table').DataTable({
            columns: tableColumns,
            data: data.cases,
            paging: false,
            ordering: false,
            dom: 't',
            language: {
                loadingRecords: '<div class="spinner spinner-lg"></div>',
                processing: '<div class="spinner spinner-lg"></div>',
                zeroRecords: 'No records found'
            }
        })

        const cells = $('.table > tbody > tr > td:has(.execution-status)')
        Object.entries(cells).forEach(applyStyleToCell)

        // initialize the tooltips by hand, because they are dinamically inserted
        // and not handled by Bootstrap itself
        $('span[data-toggle=tooltip]').tooltip()

        $('.js-spinner').hide()
    })
}

function applyStyleToCell (cell) {
    const cellElement = cell[1]
    if (cellElement) {
        const cellChildren = cellElement.children
        if (cellChildren) {
            const el = cellChildren[0]
            if (el && el.attributes.color) {
                const color = el.attributes.color.nodeValue
                $(cell[1]).attr('style', `border-left: 5px solid ${color}`)
                if (el.attributes['from-parent'].nodeValue === 'true') {
                    $(cell[1]).addClass('danger')
                }
            }
        }
    }
}

function renderData (testRunId, testPlanIds, includeChildTPs, apiData) {
    return (data, type, row, meta) => {
        const execution = apiData.executions[`${data.case_id}-${testRunId}`]

        if (execution) {
            const statusColor = apiData.statusColors[execution.status_id]
            const planId = apiData.plans[testRunId]
            const fromParentTP = includeChildTPs && testPlanIds.includes(planId)
            let iconClass = ''

            if (fromParentTP) {
                iconClass = 'fa fa-arrow-circle-o-up'
            }

            return `<span class="execution-status ${iconClass}" color="${statusColor}" from-parent="${fromParentTP}"> ` +
                `<a href="/runs/${execution.run_id}/#test-execution-${execution.pk}">TE-${execution.pk}</a>` +
                '</span>'
        }
        return ''
    }
}


/***/ }),
/* 28 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   drawTable: () => (/* binding */ drawTable),
/* harmony export */   initializePage: () => (/* binding */ initializePage)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8);
/* harmony import */ var _static_js_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);




function initializePage () {
    document.getElementById('id_include_child_tps').onchange = drawTable
}

function preProcessData (data, callbackF) {
    const caseDict = {}
    const runDict = {}
    data.forEach(function (element) {
        caseDict[element.case] = true
        runDict[element.run] = true
    })
    // remove duplicate IDs to minimize the size of WHERE clause
    const caseIds = Object.keys(caseDict).map(id => parseInt(id))
    const runIds = Object.keys(runDict).map(id => parseInt(id))

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestCase.filter', { pk__in: caseIds }, function (cases) {
        const testerPerCase = {}
        const componentsPerCase = {}
        const priorityPerCase = {}
        const automatedPerCase = {}
        cases.forEach(function (element) {
            testerPerCase[element.id] = element.default_tester__username
            priorityPerCase[element.id] = element.priority__value
            automatedPerCase[element.id] = element.is_automated
        })

        ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Component.filter', { cases__in: caseIds }, function (components) {
            components.forEach(function (component) {
                if (componentsPerCase[component.cases] === undefined) {
                    componentsPerCase[component.cases] = []
                }
                componentsPerCase[component.cases].push(component.name)
            })

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestRun.filter', { pk__in: runIds }, function (runs) {
                const productDict = {}
                runs.forEach(function (run) {
                    productDict[run.build__version__product] = true
                })
                const productIds = Object.keys(productDict).map(id => parseInt(id))

                ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Product.filter', { pk__in: productIds }, function (products) {
                    const productPerRun = {}
                    const productNames = {}
                    const testerPerRun = {}
                    products.forEach(function (product) {
                        productNames[product.id] = product.name
                    })
                    runs.forEach(function (run) {
                        testerPerRun[run.id] = run.default_tester__username
                        productPerRun[run.id] = productNames[run.build__version__product]
                    })

                    // augment data set with additional info
                    data.forEach(function (element) {
                        element.default_tester__from_case = testerPerCase[element.case]
                        element.default_tester__from_run = testerPerRun[element.run]
                        element.product__name = productPerRun[element.run]
                        element.test_case_components = (componentsPerCase[element.case] ?? []).join(', ')
                        element.case__priority = priorityPerCase[element.case]
                        element.case__automated = automatedPerCase[element.case]
                    })

                    callbackF({ data }) // renders everything
                })
            })
        })
    })
}

function drawTable () {
    $('#resultsTable').DataTable({
        pageLength: $('#navbar').data('defaultpagesize'),
        ajax: function (data, callbackF, settings) {
            const query = {}

            const productIds = $('#id_product').val()
            if (productIds.length) {
                query.build__version__product__in = productIds
            }

            const versionIds = $('#id_version').val()
            if (versionIds.length) {
                query.build__version__in = versionIds
            }

            const buildIds = $('#id_build').val()
            if (buildIds.length) {
                query.build__in = buildIds
            }

            const testPlanIds = $('#id_test_plan').val()
            const includeChildTPs = $('#id_include_child_tps').is(':checked')
            if (testPlanIds.length) {
                query.run__plan__in = testPlanIds

                // note: executed synchronously to avoid race condition between
                // collecting the list of child TPs and drawing the table below
                if (includeChildTPs) {
                    (0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('TestPlan.filter', { parent__in: testPlanIds }, function (result) {
                        result.forEach(function (element) {
                            query.run__plan__in.push(element.id)
                        })
                    }, true)
                }
            }

            const dateBefore = $('#id_before')
            if (dateBefore.val()) {
                query.stop_date__lte = dateBefore.data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            const dateAfter = $('#id_after')
            if (dateAfter.val()) {
                query.stop_date__gte = dateAfter.data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            // if page has URI params then try filtering, e.g. by run_id
            const filterParams = new URLSearchParams(location.search)
            if (filterParams.has('run_id')) {
                query.run__in = filterParams.getAll('run_id')
            }

            const testRunSummary = $('#id_test_run_summary').val()
            if (testRunSummary) {
                query.run__summary__icontains = testRunSummary
            }

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.dataTableJsonRPC)('TestExecution.filter', query, callbackF, preProcessData)
        },
        select: {
            className: 'success',
            style: 'multi',
            selector: 'td > input'
        },
        columns: [
            {
                data: null,
                render: function (data, type, full, meta) {
                    return `<a href="/runs/${data.run}/#test-execution-${data.id}">TE-${data.id}</a>`
                }
            },
            {
                data: null,
                render: function (data, type, full, meta) {
                    return `<a href="/case/${data.case}/">TC-${data.case}: ` + (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.escapeHTML)(data.case__summary) + '</a>'
                }
            },
            {
                data: 'case__priority'
            },
            {
                data: 'case__automated'
            },
            {
                data: null,
                render: function (data, type, full, meta) {
                    const statusName = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.escapeHTML)(data.status__name)
                    const statusColor = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.escapeHTML)(data.status__color)
                    const statusIcon = (0,_static_js_utils__WEBPACK_IMPORTED_MODULE_2__.escapeHTML)(data.status__icon)

                    return `<span style="color: ${statusColor}; white-space: nowrap"><span class="${statusIcon}"></span> ${statusName}</span>`
                }
            },
            {
                data: 'product__name'
            },
            {
                data: 'build__name'
            },
            {
                data: 'test_case_components'
            },
            {
                data: 'default_tester__from_case'
            },
            {
                data: 'default_tester__from_run'
            },
            {
                data: 'assignee__username'
            },
            {
                data: 'tested_by__username'
            },
            {
                data: 'start_date'
            },
            {
                data: 'stop_date'
            }
        ],
        dom: 'Biptip',
        buttons: _static_js_datatables_common__WEBPACK_IMPORTED_MODULE_1__.exportButtons,
        language: {
            info: $('#main-element').data('trans-x-records-found'),
            infoEmpty: $('#main-element').data('trans-no-records-found'),
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            thousands: '',
            zeroRecords: $('#main-element').data('trans-no-records-found')
        },
        order: [[1, 'asc']]
    })
}


/***/ }),
/* 29 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   drawChart: () => (/* binding */ drawChart)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(25);



function drawChart () {
    const query = {}

    const productIds = $('#id_product').val()
    if (productIds.length) {
        query.build__version__product__in = productIds
    }

    const versionIds = $('#id_version').val()
    if (versionIds.length) {
        query.build__version__in = versionIds
    }

    const buildIds = $('#id_build').val()
    if (buildIds.length) {
        query.build_id__in = buildIds
    }

    const testPlanIds = $('#id_test_plan').val()
    if (testPlanIds.length) {
        query.run__plan__in = testPlanIds
    }

    const dateBefore = $('#id_before')
    if (dateBefore.val()) {
        query.stop_date__lte = dateBefore.data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
    }

    const dateAfter = $('#id_after')
    if (dateAfter.val()) {
        query.stop_date__gte = dateAfter.data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
    }

    const testRunSummary = $('#id_test_run_summary').val()
    if (testRunSummary) {
        query.run__summary__icontains = testRunSummary
    }

    const totalKey = $('.main').data('total-key')

    ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.jsonRPC)('Testing.execution_trends', query, data => {
        drawPassingRateSummary(data.status_count)

        const chartData = Object.entries(data.data_set).map(entry => [entry[0], ...entry[1]])
        const categories = data.categories.map(testRunId => `TR-${testRunId}`)

        $('#chart > svg').remove()

        const c3ChartDefaults = $().c3ChartDefaults()
        const config = c3ChartDefaults.getDefaultAreaConfig()
        config.axis = {
            x: {
                categories,
                type: 'category',
                tick: {
                    fit: false,
                    multiline: false
                }
            },
            y: {
                tick: {
                    format: _utils__WEBPACK_IMPORTED_MODULE_1__.showOnlyRoundNumbers
                }
            }
        }
        config.bindto = '#chart'
        config.color = {
            pattern: data.colors
        }
        config.data = {
            columns: chartData,
            type: 'area-spline',
            order: null
        }
        config.bar = {
            width: {
                ratio: 1
            }
        }
        config.tooltip = {
            format: {
                value: (value, _ratio, _id, _index) => value || undefined
            }
        }
        config.legend = {
            hide: [totalKey]
        }
        c3.generate(config)

        // hide the total data point
        $(`.c3-target-${totalKey}`).addClass('hidden')
    })
}

function drawPassingRateSummary (statusCount) {
    const allCount = statusCount.positive + statusCount.negative + statusCount.neutral
    $('.passing-rate-summary .total').text(allCount)

    const positivePercent = statusCount.positive ? roundDown(statusCount.positive / allCount * 100) : 0
    const positiveBar = $('.progress > .progress-bar-success')
    const positiveRateText = `${positivePercent}%`
    positiveBar.css('width', positiveRateText)
    positiveBar.text(positiveRateText)
    $('.passing-rate-summary .positive').text(statusCount.positive)

    const neutralPercent = statusCount.neutral ? roundDown(statusCount.neutral / allCount * 100) : 0
    const neutralRateText = `${neutralPercent}%`
    const neutralBar = $('.progress > .progress-bar-remaining')
    neutralBar.css('width', neutralRateText)
    neutralBar.text(neutralRateText)
    $('.passing-rate-summary .neutral').text(statusCount.neutral)

    const negativePercent = statusCount.negative ? roundDown(statusCount.negative / allCount * 100) : 0
    const negativeRateText = `${negativePercent}%`
    const negativeBar = $('.progress > .progress-bar-danger')
    negativeBar.css('width', negativeRateText)
    negativeBar.text(negativeRateText)
    $('.passing-rate-summary .negative').text(statusCount.negative)
}

// we need this function, because the standard library does not have
// one that rounds the number down, which means that the sum
// of the percents may become more than 100% and that breaksg the chart
function roundDown (number) {
    return Math.floor(number * 100) / 100
}


/***/ }),
/* 30 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initializePage: () => (/* binding */ initializePage),
/* harmony export */   reloadTable: () => (/* binding */ reloadTable)
/* harmony export */ });
/* harmony import */ var _static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);


let table

function initializePage () {
    table = $('#test-case-health-table').DataTable({
        ajax: function (data, callback, settings) {
            const query = {}

            const productIds = $('#id_product').val()
            if (productIds.length) {
                query.build__version__product__in = productIds
            }

            const versionIds = $('#id_version').val()
            if (versionIds.length) {
                query.build__version__in = versionIds
            }

            const buildIds = $('#id_build').val()
            if (buildIds.length) {
                query.build_id__in = buildIds
            }

            const testPlanIds = $('#id_test_plan').val()
            if (testPlanIds.length) {
                query.run__plan__in = testPlanIds
            }

            const dateBefore = $('#id_before')
            if (dateBefore.val()) {
                query.stop_date__lte = dateBefore.data('DateTimePicker').date().format('YYYY-MM-DD 23:59:59')
            }

            const dateAfter = $('#id_after')
            if (dateAfter.val()) {
                query.stop_date__gte = dateAfter.data('DateTimePicker').date().format('YYYY-MM-DD 00:00:00')
            }

            const testRunSummary = $('#id_test_run_summary').val()
            if (testRunSummary) {
                query.run__summary__icontains = testRunSummary
            }

            ;(0,_static_js_jsonrpc__WEBPACK_IMPORTED_MODULE_0__.dataTableJsonRPC)('Testing.test_case_health', query, callback)
        },
        columns: [
            {
                data: null,
                render: renderTestCaseColumn
            },
            {
                data: null,
                render: renderVisualPercent
            },
            {
                data: null,
                render: renderFailedExecutionsColumn
            },
            {
                data: null,
                render: renderPercentColumn
            }
        ],
        paging: false,
        ordering: false,
        dom: 't',
        language: {
            loadingRecords: '<div class="spinner spinner-lg"></div>',
            processing: '<div class="spinner spinner-lg"></div>',
            zeroRecords: 'No records found'
        }
    })
}

function reloadTable () {
    table.ajax.reload()
}

function renderTestCaseColumn (data) {
    return `<a href="/case/${data.case_id}">TC-${data.case_id}</a>: ${data.case_summary}`
}

function renderFailedExecutionsColumn (data) {
    return `${data.count.fail} / ${data.count.all}`
}

function renderPercentColumn (data) {
    return Number.parseFloat(data.count.fail / data.count.all * 100).toFixed(1)
}

function renderVisualPercent (data) {
    const failPercent = data.count.fail / data.count.all * 100

    const colors = []
    const step = 20
    for (let i = 0; i < 5; i++) {
        if (failPercent > i * step) {
            colors.push('#cc0000') // pf-red-100
        } else {
            colors.push('#3f9c35') // pf-green-400
        }
    }

    return colors.reduce((prev, color) => prev + `<span class='visual-percent-box' style='background-color: ${color}'></span>\n`, '')
}


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	// define getter/value functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _bugs_static_bugs_js_get__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var _bugs_static_bugs_js_mutable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5);
/* harmony import */ var _bugs_static_bugs_js_search__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6);
/* harmony import */ var _testcases_static_testcases_js_get__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(9);
/* harmony import */ var _testcases_static_testcases_js_mutable__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(12);
/* harmony import */ var _testcases_static_testcases_js_search__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(13);
/* harmony import */ var _testplans_static_testplans_js_clone__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(14);
/* harmony import */ var _testplans_static_testplans_js_get__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(15);
/* harmony import */ var _testplans_static_testplans_js_mutable__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(17);
/* harmony import */ var _testplans_static_testplans_js_search__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(18);
/* harmony import */ var _testruns_static_testruns_js_environment__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(19);
/* harmony import */ var _testruns_static_testruns_js_get__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(20);
/* harmony import */ var _testruns_static_testruns_js_mutable__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(21);
/* harmony import */ var _testruns_static_testruns_js_search__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(22);
/* harmony import */ var _management_static_management_js_build_admin__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(23);
/* harmony import */ var _telemetry_static_telemetry_js_index__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(24);
/* harmony import */ var _jsonrpc__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(3);
/* harmony import */ var _simplemde_security_override__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(16);

























function pageInitDBReadyHandler () {
    $('.js-initialize-btn').click(function () {
        $(this).button('loading')
    })
}

const pageHandlers = {
    'page-bugs-get': _bugs_static_bugs_js_get__WEBPACK_IMPORTED_MODULE_0__.pageBugsGetReadyHandler,
    'page-bugs-mutable': _bugs_static_bugs_js_mutable__WEBPACK_IMPORTED_MODULE_1__.pageBugsMutableReadyHandler,
    'page-bugs-search': _bugs_static_bugs_js_search__WEBPACK_IMPORTED_MODULE_2__.pageBugsSearchReadyHandler,

    'page-init-db': pageInitDBReadyHandler,

    'page-testcases-get': _testcases_static_testcases_js_get__WEBPACK_IMPORTED_MODULE_3__.pageTestcasesGetReadyHandler,
    'page-testcases-mutable': _testcases_static_testcases_js_mutable__WEBPACK_IMPORTED_MODULE_4__.pageTestcasesMutableReadyHandler,
    'page-testcases-search': _testcases_static_testcases_js_search__WEBPACK_IMPORTED_MODULE_5__.pageTestcasesSearchReadyHandler,

    'page-testplans-clone': _testplans_static_testplans_js_clone__WEBPACK_IMPORTED_MODULE_6__.pageTestplansCloneReadyHandler,
    'page-testplans-get': _testplans_static_testplans_js_get__WEBPACK_IMPORTED_MODULE_7__.pageTestplansGetReadyHandler,
    'page-testplans-mutable': _testplans_static_testplans_js_mutable__WEBPACK_IMPORTED_MODULE_8__.pageTestplansMutableReadyHandler,
    'page-testplans-search': _testplans_static_testplans_js_search__WEBPACK_IMPORTED_MODULE_9__.pageTestplansSearchReadyHandler,

    'page-testruns-environment': _testruns_static_testruns_js_environment__WEBPACK_IMPORTED_MODULE_10__.pageTestrunsEnvironmentReadyHandler,
    'page-testruns-get': _testruns_static_testruns_js_get__WEBPACK_IMPORTED_MODULE_11__.pageTestrunsGetReadyHandler,
    'page-testruns-mutable': _testruns_static_testruns_js_mutable__WEBPACK_IMPORTED_MODULE_12__.pageTestrunsMutableReadyHandler,
    'page-testruns-search': _testruns_static_testruns_js_search__WEBPACK_IMPORTED_MODULE_13__.pageTestrunsSearchReadyHandler,

    'page-telemetry-testing-breakdown': _telemetry_static_telemetry_js_index__WEBPACK_IMPORTED_MODULE_15__.pageTelemetryReadyHandler,
    'page-telemetry-status-matrix': _telemetry_static_telemetry_js_index__WEBPACK_IMPORTED_MODULE_15__.pageTelemetryReadyHandler,
    'page-telemetry-execution-dashboard': _telemetry_static_telemetry_js_index__WEBPACK_IMPORTED_MODULE_15__.pageTelemetryReadyHandler,
    'page-telemetry-execution-trends': _telemetry_static_telemetry_js_index__WEBPACK_IMPORTED_MODULE_15__.pageTelemetryReadyHandler,
    'page-telemetry-test-case-health': _telemetry_static_telemetry_js_index__WEBPACK_IMPORTED_MODULE_15__.pageTelemetryReadyHandler
}

$(() => {
    const body = $('body')
    const pageId = body.attr('id')
    const readyFunc = pageHandlers[pageId]
    if (readyFunc) {
        readyFunc(pageId)
    }

    // this page doesn't have a page id
    if (body.hasClass('grp-change-form') && body.hasClass('management-build')) {
        (0,_management_static_management_js_build_admin__WEBPACK_IMPORTED_MODULE_14__.pageManagementBuildAdminReadyHandler)()
    }

    if ($('body').selectpicker) {
        $('.selectpicker').selectpicker()
    }

    if ($('body').bootstrapSwitch) {
        $('.bootstrap-switch').bootstrapSwitch()
    }

    if ($('body').tooltip) {
        $('[data-toggle="tooltip"]').tooltip()
    }

    $('.js-simplemde-textarea').each(function () {
        const fileUploadId = $(this).data('file-upload-id')
        const uploadField = $(`#${fileUploadId}`)

        // this value is only used in testcases/js/mutable.js
        window.markdownEditor = (0,_simplemde_security_override__WEBPACK_IMPORTED_MODULE_17__.initSimpleMDE)(this, uploadField)
    })

    $('#logout_link').click(function () {
        $('#logout_form').submit()
        return false
    })

    // for debugging in browser
    window.jsonRPC = _jsonrpc__WEBPACK_IMPORTED_MODULE_16__.jsonRPC
})

})();

/******/ })()
;