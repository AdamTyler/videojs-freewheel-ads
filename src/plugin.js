import videojs from "video.js";
import fwUi from "./ui.js";
import Controller from "./controller.js";
import { version as VERSION } from "../package.json";

// TODO::::
// Try overlay/postroll
// Add other AdManager config options
// test autoplay stuff
// Publish to NPM
// restore time working?
// test: binge, minimized player, mobile

// Default options for the plugin.
const defaults = {
  adManagerLogLevel: "quiet",
  adSlots: [],
  contribAdsSettings: {},
  debug: false,
  disableAdControls: false,
  networkId: "12345",
  prerollTimeout: 4000,
  profileId: "12345:profile_id",
  serverURL: "https://5fd74.v.fwmrm.net/ad/g/1",
  siteSectionId: "videojs_freewheel_ads",
  timeout: 1000,
  videoAssetId: "videoAssetId",
};

// Exposed plugin to the player for calling methods
const FreewheelAds = function (player, options) {
  /**
   * Create a FreewheelAds plugin instance.
   *
   * @param  {Player} player
   *         A Video.js Player instance.
   *
   * @param  {Object} [options]
   *         An optional options object.
   *
   *         While not a core part of the Video.js plugin architecture, a
   *         second argument of options is a convenient way to accept inputs
   *         from your plugin's caller.
   */
  // the parent class will add player under this.player

  const mergedOptions = videojs.mergeOptions(defaults, options);

  // make sure the AdManager script is attached to the window
  if (!window.tv || !window.tv.freewheel) {
    throw new Error(
      "Missing dependency of AdManager.js. Global object tv doesn't exist"
    );
    return;
  }

  this.controller = new Controller(player, mergedOptions);

  this.reset = function () {
    return this.controller.reset();
  }.bind(this);

  this.requestAds = function () {
    return this.controller.requestAds();
  }.bind(this);

  this.updateOptions = function (opts) {
    return this.controller.updateOptions(opts);
  }.bind(this);
};

// Include the version number.
FreewheelAds.VERSION = VERSION;

const init = function (options) {
  this.freewheelAds = new FreewheelAds(this, options);
};

// Register the plugin with video.js.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
registerPlugin("freewheelAds", init);

export default FreewheelAds;
