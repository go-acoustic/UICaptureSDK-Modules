# README for the Ajax Listener module

## INTRODUCTION
The Ajax Listener module implements functionality which allows the automatic logging of XMLHttpRequest (XHR) request and response data by the UI Capture SDK. This is accomplished by overriding the native XHR prototype object's open method and proxying the setRequestHeader and send methods. The Ajax Listener module may be useful in deployments where XHR data would otherwise not be captured in a Tealeaf session.

Apart from the Ajax Listener module, other mechanisms available to log the XHR request and response data include:
#### TLT.logCustomEvent API
This is an alternative client side solution capable of logging any client-side data including Ajax request and response data. This solution requires manual instrumentation of the application's XHR calls. This avoids overriding native XHR methods, does not require any module extension and uses an application data logging API provided by the UI Capture SDK.

For further information on the TLT.logCustomEvent API refer to the [UI Capture SDK documentation](https://developer.ibm.com/customer-engagement/docs/watson-marketing/ibm-watson-customer-experience-analytics/tealeaf-ui-capture/cxa_uicapture_public_api_reference/)

## :warning: IMPORTANT NOTE
**The Ajax Listener module makes it possible to log application and user data to a Tealeaf session. It is your responsibility to thoroughly test your application and validate the data that is being captured before deploying this module into a production setting.**

**The module only logs XHR data. It does not listen to other forms of network communication such as fetch or sendBeacon.**

## INSTALLATION
The Ajax Listener module (ver. 1.1.0) is compatible with UI Capture SDK version 5.5.0 and above. To install the module, copy the module script (ajaxListener.min.js) into your UI Capture SDK JavaScript file after the SDK source and before the configuration/initialization section. The structure of your UI Capture JavaScript file should follow this ordering:

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

The Ajax Listener module can also be configured to selectively log XHR requests and responses by adding the following section to the `modules` configuration of the UI Capture SDK:
```javascript
    ajaxListener: {
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
The `filters` array can contain one or more filter rules. Each rule can optionally specify any combination of the following filter properties in RegEx format:

Filter Property | Description
--------------- | -----------
url | RegEx to match the request URL
method | RegEx to match the HTTP request method
status | RegEx to match the HTTP response status

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

#### Logging all XHR requests except those made to the IBM Cloud
```javascript
    {
        url: { regex: "^((?!(ibmcloud\\.com)).)*$", flags: "i" },
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
method | no | XHR request method e.g. GET, POST etc.
requestURL | no | XHR request url host and path
async | no | Boolean flag indicating if the XHR request was asynchronous.
status | no | HTTP status code
statusText | no | HTTP status text
ajaxResponseTime | no | Milliseconds from request send to request complete (readyState = 4)
requestHeaders | yes | Object containing name-value pairs of HTTP headers that are set using the setRequestHeader() method.
responseHeaders | yes | Object containing name-value pairs of HTTP headers sent with the response.
request | yes | String containing the request data passed to the send method. If the data is valid JSON then request contains the parsed JSON.
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
                "requestURL": "www.ibm.com/api/getAccountDetails",
                "method": "GET",
                "status": 200,
                "statusText": "OK",
                "async": true,
                "ajaxResponseTime": 285,
                "requestHeaders": {
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CustomerId": "D295024"
                },
                "responseHeaders": {
                    "date": "Thu, 22 Feb 2018 01:38:07 GMT",
                    "cache-control": "private",
                    "server": "Microsoft-IIS/10.0",
                    "x-powered-by": "ASP.NET",
                    "content-length": "318",
                    "content-type": "application/json"
                },
                "response": {
                    accountDetails: {
                        "id": "D295024",
                        "memberSince": "15 July 2012",
                        "cardHolderType": "G",
                        "electronicDelivery": false,
                        "currencyUnit": "USD",
                        "currencyAmount": 423.15
                    }
                }
            }
        }
    }
```

## TOOLS & REFERENCES
* [UI Capture SDK Documentation](https://developer.ibm.com/customer-engagement/docs/watson-marketing/ibm-watson-customer-experience-analytics/tealeaf-ui-capture/)
* [Online RegEx Tester](https://regex101.com/)
* [Telerik Fiddler](https://www.telerik.com/fiddler)

## ISSUES:
Report any issues with the Ajax Listener module via [IBM Support](https://www.ibm.com/support/home/) or directly on [Github](https://github.com/ibm-watson-cxa/UICaptureSDK-Modules/issues/)
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
