/*!
 * Licensed Materials - Property of IBM
 * © Copyright IBM Corp. 2018
 * US Government Users Restricted Rights - Use, duplication or disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 *
 * LICENSE
 * https://github.com/ibm-watson-cxa/UICaptureSDK-Modules/tree/master/AjaxListener/LICENSE
 *
 * README
 * https://github.com/ibm-watson-cxa/UICaptureSDK-Modules/tree/master/AjaxListener/README.md
 */

/**
 * @fileOverview The Ajax Listener module implements the functionality related to
 * listening and logging XHR requests and responses.
 * @exports ajaxListener
 */

/*global TLT:true */

TLT.addModule("ajaxListener", function (context) {
    var moduleConfig = {},
        moduleLoaded = false,
        nativeXHROpen,
        utils = context.utils;

    /**
     * Search the list of filters and return the 1st filter that completely
     * matches the XHR object. Filter properties include url, method and status.
     * @param {XMLHttpRequest} xhr The XMLHttpRequest object.
     * @returns {Object} An empty object if no filters have been configured. Else
     * returns the matching filter object or null if no object matches.
     */
    function getMatchingFilter(xhr) {
        var i, len,
            filter = {},
            filters = moduleConfig.filters,
            matchFound,
            url = xhr.tListener.url,
            method = xhr.tListener.method,
            status = xhr.status.toString();

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
                    data: {}
                }
            },
            dummyLink,
            xhrMsg = msg.customEvent.data;

        // Sanity check
        if (!xhr) {
            return;
        }

        dummyLink = document.createElement("a");
        dummyLink.href = xhr.tListener.url;

        xhrMsg.requestURL = dummyLink.host + dummyLink.pathname;
        xhrMsg.description = "Full Ajax Monitor " + xhr.tListener.url;
        xhrMsg.method = xhr.tListener.method;
        xhrMsg.status = xhr.status;
        xhrMsg.statusText = xhr.statusText || "";
        xhrMsg.async = xhr.tListener.async;
        xhrMsg.ajaxResponseTime = xhr.tListener.end - xhr.tListener.start;


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
        if (logOptions.responseData && typeof xhr.responseText === "string") {
            try {
                xhrMsg.response = JSON.parse(xhr.responseText);
            } catch (e2) {
                xhrMsg.response = xhr.responseText;
            }
            if (xhr.responseType) {
                xhrMsg.responseType = xhr.responseType;
            }
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
            logOptions = {
                requestHeaders: false,
                requestData: false,
                responseHeaders: false,
                responseData: false
            };

        filter = getMatchingFilter(xhr);
        if (filter) {
            if (filter.log) {
                logOptions = filter.log;
            }
            logXHR(xhr, logOptions);
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
            var xhr = this,
                tListener = xhr.tListener;

            if (header && header.length) {
                tListener.reqHeaders[header] = value;
            }
            return savedSetRequestHeader.apply(xhr, arguments);
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
            var xhr = this,
                tListener = xhr.tListener;

            if (data) {
                // TODO: Add additional checks to ensure data is serializable.
                tListener.reqData = data;
            }
            tListener.start = Date.now();
            return savedSend.apply(xhr, arguments);
        };
    }

    /**
     * Check if the url matches tealeaf end point collector.
     * @param {String} url
     */
    function isSystemXHR(url) {
        var queueServiceConfig = TLT.getServiceConfig("queue");
        var queues = queueServiceConfig.queues || [];

        for (i = 0; i < queues.length; i += 1) {
            endpointURL = queues[i].endpoint.split("collectorPost")[0];
            if(url.indexOf(endpointURL) !== -1) {
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

        if (moduleLoaded) {
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
            filters = [];

        if (config && config.filters) {
            filters = config.filters;
        }

        for (i = 0, len = filters.length; i < len; i += 1) {
            filter = filters[i];
            utils.forEach([filter.url, filter.method, filter.status], cacheRegex);
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
                addXHRHook();
                moduleLoaded = true;
                break;
            case "unload":
                moduleLoaded = false;
                break;
            default:
                break;
            }
        },

        version: "1.1.0"
    };

});
