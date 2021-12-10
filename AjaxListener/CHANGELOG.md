## 1.3.0
- Implemented a URL blocklist feature to prevent requests matching the specified URL pattern from being logged.
- Add a configuration flag `skipSafetyCheck` to bypass the check for native fetch/XHR API ([#11](https://github.com/acoustic-analytics/UICaptureSDK-Modules/issues/11))
- `location.href` is added to the AjaxListener messages.
- Include message type `3` parameter when invoking the URL normalization function from the Ajax Listener module.
- Fixed an issue where JSON in the fetch request was not parsed.

## 1.2.2
- Add checking for native implementation of XHR and fetch api to prevent unexpected exceptions, mostly happening in old version browsers with polyfills
  ([#10](https://github.com/acoustic-analytics/UICaptureSDK-Modules/issues/10))
- Add logging for failed fetch request


## 1.2.1
- Fix exception thrown when logging fetch with url only 


## 1.2.0
- Add support for logging to fetch request data


## 1.1.4
- Fix format of captured Url (issue in IE11) ([#6](https://github.com/acoustic-analytics/UICaptureSDK-Modules/issues/6))


## 1.1.3
- Fix compatibility issue with older version of SDK (<V5.6) ([#5](https://github.com/acoustic-analytics/UICaptureSDK-Modules/issues/5))


## 1.1.2
- Fix console error when XHR is set with responseType other than "" or "text" ([#2](https://github.com/acoustic-analytics/UICaptureSDK-Modules/issues/2))


## 1.1.1
- Fix exception in case of response/responseText not being string type


## 1.1.0
- Initial checkin of ajax listener module, which extends the Tealeaf UI Capture SDK functionality.
