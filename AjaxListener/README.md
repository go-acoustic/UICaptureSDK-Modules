# README for the Ajax Listener module

## INTRODUCTION
The Ajax Listener module implements functionality which allows the automatic logging of [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) (XHR) request and response data by the UI Capture SDK. This is accomplished by overriding the native XHR prototype object's open method and proxying the setRequestHeader and send methods. The Ajax Listener module may be useful in deployments where XHR data would otherwise not be captured in a Tealeaf session. Starting from version 1.2.0, the Ajax Listener module supports automatic logging of [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) request and response data.

Apart from the Ajax Listener module, other mechanisms available to log the XHR and Fetch request and response data include:
#### TLT.logCustomEvent API
This is an alternative client side solution capable of logging any client-side data including Ajax request and response data. This solution requires manual instrumentation of the application's XHR or Fetch calls. This avoids overriding native XHR and Fetch methods, does not require any module extension and uses an application data logging API provided by the UI Capture SDK.

For further information on the TLT.logCustomEvent API refer to the [UI Capture SDK documentation](https://developer.goacoustic.com/acoustic-exp-analytics/docs/ui-capture-public-api-reference)

## :warning: IMPORTANT NOTE
**The Ajax Listener module makes it possible to log application and user data to a Tealeaf session. It is your responsibility to thoroughly test your application and validate the data that is being captured before deploying this module into a production setting.**

**The module only logs XHR data. It does not listen to other forms of network communication such as sendBeacon.**

**Version 1.2.0+ supports logging of Fetch data.**

**This module has been tested with native browser implementations of XMLHttpRequest and Fetch. It is not recommended to use this module with XMLHttpRequest or Fetch polyfills.**
Check if your application is overriding these browser APIs by examining the output of `window.XMLHttpRequest` and `window.fetch` in the debug console. If the result does not indicate `[native code]` then your application is overriding these native APIs and may not be able to use the Ajax Listener module.

## INSTALLATION
The Ajax Listener module is compatible with UI Capture SDK version 5.5.0 and above. To install the module, copy the module script (ajaxListener.min.js) into your UI Capture SDK JavaScript file after the SDK source and before the configuration/initialization section. The structure of your UI Capture JavaScript file should follow this ordering:

Component | Description
--------- | -----------
pako JS | gzip encoder
tealeaf JS | W3C or jQuery flavor of the UI Capture SDK
Optional modules | Ajax Listener or other custom modules
Configuration | UI Capture SDK configuration
Initialization | Invoke the TLT.init API with the configuration

After you have included the Ajax Listener module, the next step is to update the UI Capture SDK configuration.

## CONFIGURATION
To enable the Ajax Listener module add the following section to the `core` configuration of the UI Capture SDK:
```javascript
    ajaxListener: {
        enabled: true,
        events: [
            { name: "load", target: window},
            { name: "unload", target: window}
        ]
    }
```
With this basic configuration, the Ajax Listener module is enabled to start monitoring XHR calls on the page after the UI Capture SDK is initialized. The following information will be logged in the Tealeaf session for each XHR call:

Property | Description
-------- | -----------
requestURL | Request URL
method | HTTP request method e.g. "GET", "POST"
status | HTTP response status code
statusText | HTTP response status text e.g. "OK"
async | True for an asynchronous request
ajaxResponseTime | milliseconds from request send to complete (readyState == 4)
locationHref | `document.location.href` when the request is sent

The Ajax Listener module can also be configured to selectively log XHR requests and responses by adding the following section to the `modules` configuration of the UI Capture SDK:
```javascript
    ajaxListener: {
        urlBlocklist: [
            { regex: "brilliantcollector\\.com" },
            { regex: "tealeaftarget", flags: "i" }
        ],
        filters: [
            {
                method: { regex: "GET", flags: "i" },
                url: { regex: "api", flags: "i" },
                status: { regex: "4\\d\\d", flags: "" },
                log: {
                    requestHeaders: true,
                    requestData: false,
                    responseHeaders: false,
                    responseData: true
                }
            }
        ]
    }
```
The optional `urlBlocklist` array can contain one or more URL block rules. Each rule specifies a [RegEx](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) pattern which prevents the matching request from being logged.

The optional `filters` array can contain one or more filter rules. Each rule can optionally specify any combination of the following filter properties in RegEx format:

Filter Property | Description
--------------- | -----------
url | RegEx to match the request URL
method | RegEx to match the HTTP request method
status | RegEx to match the HTTP response status

### Optional Data Logging
To fine tune the XHR data being logged, each filter rule can be optionally associated with a data logging criteria specifying which XHR data should be logged when the XHR request matches the filter rule. The following additional data can be logged for each XHR request:

Optional Data Logging | Description
--------------------- | -----------
requestHeaders | XHR request headers set using the setRequestHeader function.
requestData | XHR request data text. If this is valid JSON, the data will be parsed into a JSON object.
responseHeaders | XHR response headers.
responseData | XHR response data text. If this is valid JSON, the data will be parsed into a JSON object.

When specifying multiple filter rules, remember to place the more restrictive/specific rules before the more generic rules. The module will use the first matching filter that applies to a given XHR request.

### Filtering Examples
#### Logging the request headers of all XHR requests
```javascript
    {
        log: {
            requestHeaders: true
        }
    }
```

#### Logging the response of all XHR GET requests
```javascript
    {
        method: { regex: "GET", flags: "i" },
        log: {
            responseData: true
        }
    }
```

#### Logging all XHR requests except those made to the Acoustic Cloud
:warning:This method is deprecated. Use the `urlBlocklist` feature instead.
```javascript
    {
        url: { regex: "^((?!(brilliantcollector\\.com)).)*$", flags: "i" },
    }
```

#### Logging all XHR data for requests containing a specific query parameter `debug=on` and default data for all XHR requests
```javascript
    {
        url: { regex: "debug=on(&|$)" },
        log: {
            requestHeaders: true,
            requestData: true,
            responseHeaders: true,
            responseData: true
        }
    },
    {
        // Empty rule to match all XHR requests and log default data
    }
```

#### Logging XHR request data when HTTP status is 4xx and default data for all other requests
```javascript
    {
        status: { regex: "^4\\d\\d$" },
        log: {
            requestHeaders: true,
            requestData: true
        }
    },
    {
        // Empty rule to match all XHR requests and log default data
    }
```

#### Logging all XHR data for requests to `/api/getAccountDetails` and request header data for all XHR requests
```javascript
    {
        url: { regex: "\/api\/getAccountDetails" },
        log: {
            requestHeaders: true,
            requestData: true,
            responseHeaders: true,
            responseData: true
        }
    },
    {
        log: {
            requestHeaders: true
        }
    }
```

## DATA FORMAT
The data logged by the Ajax Listener is as follows:

Property | Optional | Description
-------- | -------- | -----------
method | no | Request method e.g. GET, POST etc.
requestURL | no | Request url host and path
async | no | Boolean flag indicating if the request was asynchronous.
status | no | HTTP response status code
statusText | no | HTTP response status text
ajaxResponseTime | no | Milliseconds from request send to request complete (readyState = 4)
locationHref | no | `document.location.href` value when the request was sent.
requestHeaders | yes | Object containing name-value pairs of HTTP headers that are set using the setRequestHeader() method.
responseHeaders | yes | Object containing name-value pairs of HTTP headers sent with the response.
request | yes | String containing the request data. If the data is valid JSON then request contains the parsed JSON.
response | yes | String containing the response data. If the data is valid JSON then response contains the parsed JSON.

Following is an example of the XHR data that is logged by the Ajax Listener in the Tealeaf session:
```javascript
    {
        "type": 5,
        "offset": 9182,
        "screenviewOffset": 9171,
        "count": 4,
        "fromWeb": true,
        "customEvent": {
            "name": "ajaxListener",
            "data": {
                "requestURL": "www.acoustic.com/api/getAccountDetails",
                "method": "GET",
                "status": 200,
                "statusText": "OK",
                "async": true,
                "ajaxResponseTime": 285,
                "locationHref": "https://www.acoustic.com/support/login",
                "requestHeaders": {
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CustomerId": "D295024"
                },
                "responseHeaders": {
                    "date": "Thu, 22 Feb 2020 01:38:07 GMT",
                    "cache-control": "private",
                    "server": "Microsoft-IIS/10.0",
                    "x-powered-by": "ASP.NET",
                    "content-length": "318",
                    "content-type": "application/json"
                },
                "response": {
                    "accountDetails": {
                        "id": "D295024",
                        "memberSince": "15 July 2012",
                        "customerType": "G",
                        "electronicDelivery": false,
                        "currencyUnit": "USD"
                    }
                }
            }
        }
    }
```

## Capturing Fetch data (version 1.2.0+)
Capturing Fetch data is enabled by default. This functionality is automatically turned off in browsers which do not support Fetch API.

The filter configurations described for XHR are also applicable to fetch requests.

:warning:If your application is using polyfills to support Fetch then disable this feature as described below since it is not recommended to be used with polyfills.

To disable Fetch data capture or XHR data capture, set the corresponding flags to false in the module configuration.
```javascript
    ajaxListener: {
        xhrEnabled: false,
        fetchEnabled: false,
        filters: [
           ...
    }
```

## Bypassing the safety check for native implementation of XHR and fetch
This module has been tested on modern browsers that provide native support for `XMLHttpRequest` and `fetch`. This module implements a safety check which automatically disables logging if it detects that the native API is not available or is overridden by 3rd party script. To bypass this safety check, set `skipSafetyCheck` to true in the module configuration.
```javascript
    ajaxListener: {
        skipSafetyCheck: true,
        xhrEnabled: true,
        fetchEnabled: true,
        filters: [
           ...
    }
```
:warning:Always perform adequate testing and verification of correct operation before deploying into production.

## TOOLS & REFERENCES
* [UI Capture SDK Documentation](https://developer.goacoustic.com/acoustic-exp-analytics/docs/tealeaf-ui-capture-overview)
* [Online RegEx Tester](https://regex101.com/)
* [Telerik Fiddler](https://www.telerik.com/fiddler)

## ISSUES:
Report any issues with the Ajax Listener module via [Acoustic Support](https://support.goacoustic.com/) or directly on [Github](https://github.com/acoustic-analytics/UICaptureSDK-Modules/issues/)
For a speedy resolution, please follow this template when reporting an issue:

#### Module Version
The module version can be obtained by typing `TLT.getModule("ajaxListener").version` in the console. Alternatively, you can scan the source for the `version` string.

#### Current Behavior
e.g. Ajax Listener does not log HTTP status code for all XHR requests made to /api/getAccountDetails

#### Expected Behavior
e.g. HTTP status code 200 should be logged for XHR requests to /api/getAccountDetails

#### Steps to Reproduce
1.
2.
3.
...

#### Environment (Only if applicable)
If the issue is readily reproducible with any browser / OS then skip this section. Otherwise, please specify the exact browser and OS environment, including versions, in which the issue is reproducible.

#### Possible Solution (Optional)
If you have tested a workaround or possible solution, describe the solution in detail.

#### Attachments
1. UI Capture SDK Configuration
2. Fiddler session (Optional)

:warning: **Only provide test data. DO NOT attach any user data/session.**
