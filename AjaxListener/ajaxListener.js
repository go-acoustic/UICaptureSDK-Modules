/*!
 * Copyright (c) 2021 Acoustic, L.P. All rights reserved.
 *
 * NOTICE: This file contains material that is confidential and proprietary to
 * Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
 * industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
 * Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
 * prohibited.
 *
 * README
 * https://github.com/acoustic-analytics/UICaptureSDK-Modules/blob/master/AjaxListener/README.md
 */

/**
 * @fileOverview The Ajax Listener module implements the functionality related to
 * listening and logging XHR requests and responses.
 * @exports ajaxListener
 */

/*global TLT:true */

TLT.addModule("ajaxListener", function (context) {
    "use strict";

    var moduleConfig = {},
        moduleLoaded = false,
        nativeXHROpen,
        nativeFetch,
        xhrEnabled,
        fetchEnabled,
        utils = context.utils;

    /**
     * Test if the given url matches an entry in the URL blocklist.
     * @param {String} url The value to be matched
     * @returns {Boolean} true if the url matches an entry in the URL blocklist. false otherwise.
     */
    function isUrlBlocked(url) {
        var i, len,
            blockRule,
            matchFound = false,
            urlBlocklist = moduleConfig.urlBlocklist;

        // Sanity check
        if (!url || !urlBlocklist) {
            return matchFound;
        }

        for (i = 0, len = urlBlocklist.length; !matchFound && i < len; i += 1) {
            blockRule = urlBlocklist[i];
            matchFound = blockRule.cRegex.test(url);
        }

        return matchFound;
    }

    /**
     * Search the list of filters and return the 1st filter that completely
     * matches the XHR object. Filter properties include url, method and status.
     * @param {String} url The request url
     * @param {String} method The request method, e.g. post, get, etc
     * @param {String} status The response status
     * @returns {Object} An empty object if no filters have been configured. Else
     * returns the matching filter object or null if no object matches.
     */
    function getMatchingFilter(url, method, status) {
        var i, len,
            filter = {},
            filters = moduleConfig.filters,
            matchFound;

        // If no filter is configured return an empty object
        if (!filters || !filters.length) {
            return filter;
        }

        // Find matching filter.
        for (i = 0, len = filters.length, matchFound = false; !matchFound && i < len; i += 1) {
            filter = filters[i];
            matchFound = true;
            if (filter.url) {
                matchFound = filter.url.cRegex.test(url);
            }
            if (matchFound && filter.method) {
                matchFound = filter.method.cRegex.test(method);
            }
            if (matchFound && filter.status) {
                matchFound = filter.status.cRegex.test(status);
            }
        }

        if (!matchFound) {
            filter = null;
        }
        return filter;
    }

    /**
     * Builds an object of key => value pairs of HTTP headers from a string.
     * @param {String} headers The string of HTTP headers separated by newlines
     *      (i.e.: "Content-Type: text/html\nLast-Modified: ..")
     * @return {Object} Returns an object where every key is a header
     *     and every value it's corresponding value.
     */
    function extractResponseHeaders(headers) {
        var headersObj = {},
            i,
            len,
            header,
            name,
            value;

        headers = headers.split(/[\r\n]+/);
        for (i = 0, len = headers.length; i < len; i += 1) {
            header = headers[i].split(": ");
            name = header[0];
            value = utils.rtrim(header[1]);
            if (name && name.length) {
                headersObj[name] = value;
            }
        }
        return headersObj;
    }

    /**
     * Posts the XHR object to the queue. The URL, method, status and time
     * fields are mandatory. The request/response headers and body are
     * added as per the options specified.
     * @param {XMLHttpRequest} xhr The XMLHttpRequest object to be recorded.
     * @param {Object} logOptions An object specifying if the request and
     *                 response headers and data should be recorded.
     */
    function logXHR(xhr, logOptions) {
        var msg = {
                type: 5,
                customEvent: {
                    name: "ajaxListener",
                    data: {
                        interfaceType: "XHR"
                    }
                }
            },
            dummyLink,
            xhrMsg = msg.customEvent.data,
            respText;

        // Sanity check
        if (!xhr) {
            return;
        }

        dummyLink = document.createElement("a");
        dummyLink.href = xhr.tListener.url;

        xhrMsg.originalURL = dummyLink.host + (dummyLink.pathname[0] === "/" ? "" : "/") + dummyLink.pathname;
        xhrMsg.requestURL = context.normalizeUrl ? context.normalizeUrl(xhrMsg.originalURL, 3) : xhrMsg.originalURL;
        xhrMsg.description = "Full Ajax Monitor " + xhrMsg.requestURL;
        xhrMsg.method = xhr.tListener.method;
        xhrMsg.status = xhr.status;
        xhrMsg.statusText = xhr.statusText || "";
        xhrMsg.async = xhr.tListener.async;
        xhrMsg.ajaxResponseTime = xhr.tListener.end - xhr.tListener.start;
        xhrMsg.locationHref = context.normalizeUrl(document.location.href, 3);

        if (logOptions.requestHeaders) {
            xhrMsg.requestHeaders = xhr.tListener.reqHeaders;
        }
        if (logOptions.requestData && typeof xhr.tListener.reqData === "string" && !xhr.tListener.isSystemXHR) {
            try {
                xhrMsg.request = JSON.parse(xhr.tListener.reqData);
            } catch (e1) {
                xhrMsg.request = xhr.tListener.reqData;
            }
        }
        if (logOptions.responseHeaders) {
            xhrMsg.responseHeaders = extractResponseHeaders(xhr.getAllResponseHeaders());
        }
        if (logOptions.responseData) {
            if (typeof xhr.responseType === "undefined") {
                respText = xhr.responseText;
            } else if (xhr.responseType === "" || xhr.responseType === "text") {
                respText = xhr.response;
            } else if (xhr.responseType === "json") {
                xhrMsg.response = xhr.response;
            } else {
                xhrMsg.response = typeof xhr.response;
            }

            if (respText) {
                try {
                    xhrMsg.response = JSON.parse(respText);
                } catch (e2) {
                    xhrMsg.response = respText;
                }
            }

            if (xhr.responseType) {
                xhrMsg.responseType = xhr.responseType;
            }
        }
        context.post(msg);
    }

    function getEntries(object) {
        var pair,
            obj = {},
            objEntries = object.entries(),
            objEntry = objEntries.next();

        while (!objEntry.done) {
            pair = objEntry.value;
            obj[pair[0]] = pair[1];
            objEntry = objEntries.next();
        }

        return obj;
    }

    /**
     * Extract key => value pairs from fecth request/response headers.
     * @param {Object} headers fecth request/response headers
     * @return {Object} Returns an object where every key is a header
     *     and every value it's corresponding value.
     */
    function extractFetchHeaders(headers) {
        return getEntries(headers);
    }

    /**
     * Extract body of request based on types
     * supported types are string, json object, FormData object.
     * the rest types are returned as it is.
     * @param {Object} body fetch request body
     * @return {Object} Return a string, or an object
     */
    function extractFetchRequestBody(body) {
        var retVal = body;

        // Sanity check
        if (!body) {
            return retVal;
        }

        if (typeof body === "object" && body.toString().indexOf("FormData") !== -1) {
            // Parse Form data
            retVal = getEntries(body);
        } else if (typeof body === "string") {
            try {
                // Parse as JSON
                retVal = JSON.parse(body);
            } catch (e) {
                retVal = body;
            }
        }

        return retVal;
    }

    /**
     * Posts the fetch request/response information to the queue. The URL, method, status and time
     * fields are mandatory. The request/response headers and body are
     * added as per the options specified.
     * @param {Object} fetchReq The fetch request object to be recorded.
     * @param {Object} fetchResp The fetch response object to be recorded.
     * @param {Object} logOptions An object specifying if the request and
     *                 response headers and data should be recorded.
     */
    function logFetch(fetchReq, fetchResp, logOptions) {
        var msg = {
                type: 5,
                customEvent: {
                    name: "ajaxListener",
                    data: {
                        interfaceType: "fetch"
                    }
                }
            },
            dummyLink,
            xhrMsg = msg.customEvent.data,
            respContentType;

        dummyLink = document.createElement("a");
        dummyLink.href = fetchReq.url;

        xhrMsg.originalURL = dummyLink.host + (dummyLink.pathname[0] === "/" ? "" : "/") + dummyLink.pathname;
        xhrMsg.requestURL = context.normalizeUrl ? context.normalizeUrl(xhrMsg.originalURL, 3) : xhrMsg.originalURL;
        xhrMsg.description = "Full Ajax Monitor " + xhrMsg.requestURL;
        xhrMsg.method = fetchReq.initData.method;
        xhrMsg.status = fetchResp.status;
        xhrMsg.statusText = fetchResp.statusText || "";
        xhrMsg.async = true;
        xhrMsg.ajaxResponseTime = fetchReq.end - fetchReq.start;
        xhrMsg.responseType = fetchResp.type;
        xhrMsg.locationHref = context.normalizeUrl(document.location.href, 3);

        if (logOptions.requestHeaders) {
            //check if header data is encapsulated as "Headers" object which cannot be directly accessed
            if (fetchReq.initData.headers && fetchReq.initData.headers.toString().indexOf("Headers") !== -1) {
                xhrMsg.requestHeaders = extractFetchHeaders(fetchReq.initData.headers);
            } else {
                xhrMsg.requestHeaders = fetchReq.initData.headers || "";
            }
        }

        if (logOptions.requestData && typeof fetchReq.body !== "undefined" && !fetchReq.isSystemXHR) {
            xhrMsg.request = extractFetchRequestBody(fetchReq.body);
        }

        if (logOptions.responseHeaders) {
            xhrMsg.responseHeaders = extractFetchHeaders(fetchResp.headers);
        }

        if (logOptions.responseData) {
            respContentType = fetchResp.headers.get("content-type");

            if (respContentType && respContentType.indexOf("application/json") !== -1) {
                fetchResp.clone().json().then(function (responseData) {
                    xhrMsg.response = responseData;
                    context.post(msg);
                });
                return;
            }

            if (respContentType && (respContentType.indexOf("text") !== -1 || respContentType.indexOf("xml") !== -1)) {
                fetchResp.clone().text().then(function (responseData) {
                    xhrMsg.response = responseData;
                    context.post(msg);
                });
                return;
            }

            xhrMsg.response = "Not logging unsupported response content: " + respContentType;

        }

        context.post(msg);
    }


    /**
     * Process the XHR object to check if it matches with a filter
     * and if so then log it.
     * @param xhr {XMLHttpRequest} The XMLHttpRequest object to be processed.
     */
    function processXHR(xhr) {
        var filter,
            url = xhr.tListener.url,
            method = xhr.tListener.method,
            status = xhr.status.toString(),
            logOptions = {
                requestHeaders: false,
                requestData: false,
                responseHeaders: false,
                responseData: false
            };

        filter = getMatchingFilter(url, method, status);
        if (filter) {
            if (filter.log) {
                logOptions = filter.log;
            }
            logXHR(xhr, logOptions);
        }
    }

    /**
     * Process the fetch request & response to check if it matches with a filter
     * and if so then log it.
     * @param fetchReq {Request} The request object of fetch
     * @param fetchResp {Response} The response object of fetch
     */
    function processFetch(fetchReq, fetchResp) {
        var filter,
            url = fetchReq.url,
            method = fetchReq.initData.method,
            status = fetchResp.status.toString(),
            logOptions = {
                requestHeaders: false,
                requestData: false,
                responseHeaders: false,
                responseData: false
            };

        if (isUrlBlocked(url)) {
            return;
        }

        filter = getMatchingFilter(url, method, status);
        if (filter) {
            if (filter.log) {
                logOptions = filter.log;
            }
            logFetch(fetchReq, fetchResp, logOptions);
        }
    }

    /**
     * XHR readystatechange event handler. Checks if the readyState is "complete"
     * and processes the XHR for logging.
     * @param event {DOMEvent} Event object corresponding to the XHR readystatechange event.
     */
    function readyStateChangeHandler(event) {
        var xhr,
            readyState;

        // Sanity check
        if (!event || !event.target) {
            return;
        }

        xhr = event.target;
        readyState = xhr.readyState;

        if (readyState === 4) {
            xhr.removeEventListener("readystatechange", readyStateChangeHandler);
            xhr.tListener.end = Date.now();
            processXHR(xhr);
        }
    }

    /**
     * Creates a proxy function for the XMLHttpRequest.setRequestHeader method.
     * The proxy function records the header being set and invokes the original
     * method.
     * @param {XMLHttpRequest} xhr The XMLHttpRequest object.
     */
    function hookSetRequestHeader(xhr) {
        var savedSetRequestHeader = xhr.setRequestHeader;

        xhr.setRequestHeader = function (header, value) {
            var _xhr = this,
                tListener = _xhr.tListener;

            if (header && header.length) {
                tListener.reqHeaders[header] = value;
            }
            return savedSetRequestHeader.apply(_xhr, arguments);
        };
    }

    /**
     * Creates a proxy function for the XMLHttpRequest.send method.
     * The proxy function records the request data being sent and
     * invokes the original method.
     * @param {XMLHttpRequest} xhr The XMLHttpRequest object.
     */
    function hookSend(xhr) {
        var savedSend = xhr.send;

        xhr.send = function (data) {
            var _xhr = this,
                tListener = _xhr.tListener;

            if (data) {
                // TODO: Add additional checks to ensure data is serializable.
                tListener.reqData = data;
            }
            tListener.start = Date.now();
            return savedSend.apply(_xhr, arguments);
        };
    }

    /**
     * Check if the url matches tealeaf end point collector.
     * @param {String} url
     */
    function isSystemXHR(url) {
        var i, queueServiceConfig, queues;

        queueServiceConfig = TLT.getServiceConfig("queue");
        queues = queueServiceConfig.queues || [];

        for (i = 0; i < queues.length; i += 1) {
            if (queues[i].endpoint && url.indexOf(queues[i].endpoint) !== -1) {
                return true;
            }
        }
        return false;
    }

    /**
     * Proxy function for XMLHttpRequest.prototype.open
     * Attaches the readystatechange handler and hook functions
     * for the XMLHttpRequest.setRequestHeader and
     * XMLHttpRequest.send methods.
     * @param {String} method
     * @param {String} url
     */
    function xhrOpenHook(method, url, async) {
        var xhr = this;

        if (moduleLoaded && !isUrlBlocked(url)) {
            xhr.addEventListener("readystatechange", readyStateChangeHandler);

            xhr.tListener = {
                method: method,
                url: url,
                async: (typeof async === "undefined") ? true : !!async,
                reqHeaders: {},
                isSystemXHR: isSystemXHR(url)
            };
            // Optionally listen to setRequestHeader()
            hookSetRequestHeader(xhr);

            // Optionally listen to send()
            hookSend(xhr);
        }
        return nativeXHROpen.apply(xhr, arguments);
    }

    /**
     * Save the original XMLHttpRequest.prototype.open method and replace
     * it with a proxy function.
     */
    function addXHRHook() {
        if (XMLHttpRequest) {
            nativeXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = xhrOpenHook;
        }
    }

    /**
     * Override native fetch api
     */
    function addFetchHook() {
        nativeFetch = window.fetch;

        window.fetch = function (url, options) {
            var fetchReq = {},
                promise;

            if (typeof url === "object") {
                //fetch is evoked with a Request object
                fetchReq.initData = url;
                fetchReq.url = url.url;

                //body in Request object cannot be directly accessed.
                fetchReq.initData.clone().text().then(function (data) {
                    if (data.length > 0) {
                        fetchReq.body = data;
                    }
                });
            } else {
                //fetch is evoked with two parameters, url and initObject
                fetchReq.initData = options || {};
                fetchReq.url = url;
                if (options && options.body) {
                    fetchReq.body = options.body;
                }
            }
            fetchReq.isSystemXHR = isSystemXHR(fetchReq.url);
            fetchReq.start = Date.now();

            promise = nativeFetch.apply(this, arguments);

            return promise.then(function (response) {
                fetchReq.end = Date.now();
                processFetch(fetchReq, response);
                return response;
            });
        };
    }

    /**
     * Cache the regex specified in the module configuration.
     * @param {Object} obj The property with the regex to be cached.
     */
    function cacheRegex(obj) {
        if (obj && obj.regex) {
            obj.cRegex = new RegExp(obj.regex, obj.flags);
        }
    }

    /**
     * Process the module configuration and setup the corresponding cookies and tokens.
     * Setup the callback to add the respective headers when the library POSTs.
     * @function
     * @private
     * @param {object} config The module configuration.
     */
    function processConfig(config) {
        var i, len,
            filter,
            filters = [],
            skipSafetyCheck = utils.getValue(config, "skipSafetyCheck", false);

        if (config && config.filters) {
            filters = config.filters;
        }

        for (i = 0, len = filters.length; i < len; i += 1) {
            filter = filters[i];
            utils.forEach([filter.url, filter.method, filter.status], cacheRegex);
        }

        if (config && config.urlBlocklist) {
            utils.forEach(config.urlBlocklist, cacheRegex);
        }

        xhrEnabled = utils.getValue(config, "xhrEnabled", true) && window.XMLHttpRequest;

        /**
         * AjaxListener module intercepts native XMLHttpRequest object implemented by browsers
         * Apps that use polyfills or other scripts which override the native browser implementation,
         * the module is disabled as a safety precaution.
         */
        if (xhrEnabled && !skipSafetyCheck &&
                (XMLHttpRequest.toString().indexOf("[native code]") === -1 ||
                XMLHttpRequest.toString().indexOf("XMLHttpRequest") === -1)) {
            xhrEnabled = false;
        }

        fetchEnabled = utils.getValue(config, "fetchEnabled", true) && window.fetch;

        if (fetchEnabled && !skipSafetyCheck &&
                window.fetch.toString().indexOf("[native code]") === -1) {
            fetchEnabled = false;
        }
    }

    // Return the module's interface object. This contains callback functions which
    // will be invoked by the UIC core.
    return {
        init: function () {
            moduleConfig = context.getConfig();
            processConfig(moduleConfig);
        },

        destroy: function () {
            moduleLoaded = false;
        },

        onevent: function (webEvent) {
            switch (webEvent.type) {
            case "load":
                if (xhrEnabled) {
                    addXHRHook();
                }

                if (fetchEnabled) {
                    addFetchHook();
                }
                moduleLoaded = true;
                break;
            case "unload":
                moduleLoaded = false;
                break;
            default:
                break;
            }
        },

        version: "1.3.0"
    };

});
