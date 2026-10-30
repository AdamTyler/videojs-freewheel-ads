<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [videojs-freewheel-ads](#videojs-freewheel-ads)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Usage](#usage)
    - [`<script>` Tag](#script-tag)
    - [Bundlers (ES modules)](#bundlers-es-modules)
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
  - [Video.js](https://videojs.com/) 8 (8.11.6 or later). Video.js 10 is a ground-up rewrite with a different plugin model and is not supported.
  - [VideoJS Contrib Ads](https://github.com/videojs/videojs-contrib-ads) 7, loaded before this plugin is initialized
  - AdManager.js loaded into global scope (`https://mssl.fwmrm.net/libs/adm/[version]/AdManager.js`). This plugin was originally written against version 6.35.0; the SDK calls it makes are still present in 7.22.0.
  - A modern browser. Internet Explorer 11 is no longer supported.

## Installation

```sh
npm install --save videojs-freewheel-ads
```

`video.js` and `videojs-contrib-ads` are peer dependencies, so install them alongside the plugin if your project doesn't already have them.

## Usage

To include videojs-freewheel-ads on your website or web application, use any of the following methods.

### `<script>` Tag

This is the simplest case. Get the scripts in whatever way you prefer and include the plugin _after_ [video.js][videojs] and [videojs-contrib-ads][contrib-ads], so that the `videojs` global is available and the ads framework is registered.

```html
<link href="//path/to/video-js.css" rel="stylesheet">
<link href="//path/to/videojs-contrib-ads.css" rel="stylesheet">
<link href="//path/to/videojs-freewheel-ads.css" rel="stylesheet">

<script src="https://mssl.fwmrm.net/libs/adm/7.22.0/AdManager.js"></script>
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-contrib-ads.min.js"></script>
<script src="//path/to/videojs-freewheel-ads.min.js"></script>
<script>
  var player = videojs('my-video');

  player.freewheelAds({
    networkId: '12345',
    profileId: '12345:profile_id',
    serverURL: 'https://5fd74.v.fwmrm.net/ad/g/1',
    siteSectionId: 'videojs_freewheel_ads',
    videoAssetId: 'videoAssetId',
    videoDuration: 455,
    adSlots: [
      { id: 'pre', adUnit: 'preroll', timePosition: 0 }
    ]
  });
</script>
```

### Bundlers (ES modules)

Install the plugin and its peer dependencies via npm:

```sh
npm install --save video.js videojs-contrib-ads videojs-freewheel-ads
```

Then import them. AdManager.js is not distributed on npm, so it still needs to be loaded with a `<script>` tag before the plugin is initialized.

```js
import videojs from 'video.js';
import 'videojs-contrib-ads';
// The plugin registers itself with video.js as `freewheelAds`.
import 'videojs-freewheel-ads';

import 'video.js/dist/video-js.css';
import 'videojs-contrib-ads/dist/videojs-contrib-ads.css';
import 'videojs-freewheel-ads/dist/videojs-freewheel-ads.css';

const player = videojs('my-video');

player.freewheelAds({
  networkId: '12345',
  profileId: '12345:profile_id',
  serverURL: 'https://5fd74.v.fwmrm.net/ad/g/1',
  siteSectionId: 'videojs_freewheel_ads',
  videoAssetId: 'videoAssetId',
  videoDuration: 455
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
| adManagerLogLevel  | string  | Log info from AdManager itself. Can be one of ['quiet', 'info', 'debug']. Defaults to 'quiet'.                  |
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
| showCountdown      | boolean | True to show the "Ad (1 of 2): 0:15" countdown during ad playback on desktop. Defaults to true.                 |
| videoAssetId       | string  | Freewheel asset id.                                                                                             |
| videoDuration      | number  | Asset duration in seconds.                                                                                      |
| fallBackId         | number  | A numeric Id for a fallback asset when videoAssetId is not known to FW                                          |
| keyValues          | array   | Array of FW Key Values to add to ad request in the form [{key: '_fw_us_privacy' value: '1YNN'}]                 |


## License

MIT. Copyright (c) Adam Tyler &lt;adam.tyler@utexas.edu&gt;


[videojs]: https://videojs.com/
[contrib-ads]: https://github.com/videojs/videojs-contrib-ads
