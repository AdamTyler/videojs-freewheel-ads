<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [videojs-freewheel-ads](#videojs-freewheel-ads)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Usage](#usage)
    - [`<script>` Tag](#script-tag)
    - [Browserify/CommonJS](#browserifycommonjs)
    - [RequireJS/AMD](#requirejsamd)
  - [Additional settings](#additional-settings)
  - [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# videojs-freewheel-ads

Plugin for ads through the Freewheel network

## Introduction
The Freewheel Plugin for Video.js provides a videojs wrapper around the provided [AdManager.js](https://hub.freewheel.tv/pages/viewpage.action?spaceKey=techdocs&title=AdManager+SDK+API+Documentation#tab-JavaScript%2FHTML5) 
functionality from Freewheel

## Features
- Easily integrate the Freewheel AdManager SDK into the videojs ecosystem as a plugin.

## Requirements
  - AdManager.js loaded into global scope (https://mssl.fwmrm.net/libs/adm/[version]/AdManager.js). This plugin was written using version 6.35.0
  - [VideoJS Contrib Ads](https://github.com/videojs/videojs-contrib-ads)

## Installation

```sh
npm install --save videojs-freewheel-ads
```

## Usage

To include videojs-freewheel-ads on your website or web application, use any of the following methods.

### `<script>` Tag

This is the simplest case. Get the script in whatever way you prefer and include the plugin _after_ you include [video.js][videojs], so that the `videojs` global is available.

```html
<script src='https://mssl.fwmrm.net/libs/adm/6.35.0/AdManager.js'></script>
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-freewheel-ads.min.js"></script>
<script src="//path/to/videojs-freewheel-ads.css"></script>
<script>
  var player = videojs('my-video');

  player.freewheelAds();
</script>
```

### Browserify/CommonJS

When using with Browserify, install videojs-freewheel-ads via npm and `require` the plugin as you would any other module.

```js
var videojs = require('video.js');
var ads = require('videojs-contrib-ads');
// The actual plugin function is exported by this module, but it is also
// attached to the `Player.prototype`; so, there is no need to assign it
// to a variable.
require('videojs-freewheel-ads');

var player = videojs('my-video');

player.freewheelAds();
```

### RequireJS/AMD

When using with RequireJS (or another AMD library), get the script in whatever way you prefer and `require` the plugin as you normally would:

```js
require(['video.js', 'videojs-contrib-ads', 'videojs-freewheel-ads'], function(videojs) {
  var player = videojs('my-video');

  var options = {
    networkId: '12345',
    profileId: '12345:profile_id',
    serverURL: 'https://5fd74.v.fwmrm.net/ad/g/1',
    siteSectionId: 'videojs_freewheel_ads',
    videoAssetId: 'videoAssetId',
    videoDuration: 455
  }

  player.freewheelAds();
});
```

## Additional settings
The plugin accepts additional settings beyond what is shown in
the previous snippet. 

The following settings define your communication with Freewheel that is specific to your profile and ad offerings. The provided defaults will not function properly: 
```
networkId
profileId
serverURL
siteSectionId
videoAssetId
videoDuration
```

A summary of all settings follows:

| Settings           | Type    | Description                                                                                                     |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| adManagerLogLevel  | string  | Log info from AdManager itself. Can be one of ['quite', 'info', 'debug']. Defaults to 'quiet'.                  |
| adSlots            | array   | Array of ad timeslots to be used in the request to Freewheel. Contains objects with {adUnit, id, timePosition}  |
| autoPlay           | boolean | True to begin ad request and playing automatically. Defaults to true.                                           |
| contribAdsSettings | object  | Additional settings to be passed to the contrib-ads plugin.                                                     |
| debug              | boolean | True to turn on all debug within the plugin. Defaults to false.                                                 |
| disableAdControls  | boolean | True to hide the ad controls(play/pause, volume, and fullscreen buttons) during ad playback. Defaults to false. |
| isStream           | string  | Is the source a livestream. Sets various parameters in the request.                                             |
| networkId          | string  | Freewheel newtork id.                                                                                           |
| profileId          | string  | Freewheel profile id.                                                                                           |
| serverURL          | string  | Freewheel server url.                                                                                           |
| siteSectionId      | string  | Freewheel site section id.                                                                                      |
| videoAssetId       | string  | Freewheel asset id.                                                                                             |
| videoDuration      | number  | Asset duration in seconds.                                                                                      |
| fallBackId         | number  | A numeric Id for a fallback asset when videoAssetId is not known to FW                                          |
| keyValues          | array   | Array of FW Key Values to add to ad request in the form [{key: '_fw_us_privacy' value: '1YNN'}]                 |


## License

MIT. Copyright (c) Adam Tyler &lt;adam.tyler@utexas.edu&gt;


[videojs]: http://videojs.com/
