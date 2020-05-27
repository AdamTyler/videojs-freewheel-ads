import videojs from "video.js";
import fwUi from "./ui.js";
import { version as VERSION } from "../package.json";

const Plugin = videojs.getPlugin("plugin");

// TODO::::
// Try overlay/postroll
// Add other AdManager config options
// test autoplay stuff
// Publish to NPM
// make sure all events are right
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
  // class FreewheelAds extends Plugin {
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
  // constructor(player, options) {
  // the parent class will add player under this.player
  // super(player);
  this.player = player;

  this.options = videojs.mergeOptions(defaults, options);

  // make sure the AdManager script is attached to the window
  if (!window.tv || !window.tv.freewheel) {
    throw new Error(
      "Missing dependency of AdManager.js. Global object tv doesn't exist"
    );
    return;
  }

  // initialize contrib-ads plugin
  const contribAdsDefaults = {
    debug: this.options.debug,
    timeout: this.options.timeout,
    prerollTimeout: this.options.prerollTimeout,
  };
  const adsPluginSettings = Object.assign(
    {},
    contribAdsDefaults,
    options.contribAdsSettings || {}
  );
  this.player.ads(adsPluginSettings);

  this.adDataRequested = false;
  this.adTrackingTimer = null;
  this.boundEndedListener = this.onContentVideoEnded.bind(this);
  this.boundTimeUpdate = this.onContentVideoTimeUpdated.bind(this);
  this.contentPausedOn = 0;
  this.contentSrc = null;
  this.contentSrcType = null;
  this.currentAdContext = null;
  this.currentAdInstance = null;
  this.currentAdSlot = null;
  this.freewheel = window.tv.freewheel;
  this.fwSDK = window.tv.freewheel.SDK;
  this.playerControls = this.player.getChild("controlBar");

  this.setLogLevel(this.options.adManagerLogLevel);

  this.player.ready(() => {
    this.player.addClass("vjs-freewheel-ads");
  });

  this.player.on("contentchanged", () => {
    this.fwAdsLog("Video content changed, request ads again");
    this.requestAds();
  });
  this.player.on("readyforpreroll", () => {
    this.playback();
  });
  this.player.on("dispose", () => this.cleanUp());

  // Only one AdManager instance is needed for each player
  this.adManager = new this.fwSDK.AdManager();
  this.adManager.setNetwork(this.options.networkId);
  this.adManager.setServer(this.options.serverURL);

  // Creating initial ad context
  this.currentAdContext = this.adManager.newContext();
  this.currentAdContext.setProfile(this.options.profileId);
  this.currentAdContext.setSiteSection(this.options.siteSectionId);

  // initialize ad ui overlay
  this.fwUi = new fwUi(this);

  // initialize context events
  this.setupContext();

  this.getCurrentAdInstance = function () {
    return this.currentAdInstance;
  };

  this.getCurrentAdSlot = function () {
    return this.currentAdSlot;
  };

  this.updateOptions = function (newOptions) {
    this.fwAdsLog("updateOptions, new options: ", newOptions);
    this.options = videojs.mergeOptions(this.options, newOptions);

    // create context for next request
    this.currentAdContext = this.adManager.newContextWithContext(
      this.currentAdContext
    );
    this.setupContext();
  };

  this.requestAds = function () {
    this.fwAdsLog("Build ad request");
    // Configure ad request
    this.prerollSlots = [];
    this.postrollSlots = [];
    this.overlaySlots = [];
    this.midrollSlots = [];

    this.options.adSlots.forEach(({ id, adUnit, timePosition }, index) => {
      this.currentAdContext.addTemporalSlot(
        id,
        this.getSlotType(adUnit),
        timePosition,
        null,
        index + 1
      );
    });

    // Let context object knows where to render the ad
    const displayBaseId = this.player.id() || "video-player";
    this.currentAdContext.registerVideoDisplayBase(displayBaseId);

    // Submit ad request

    // Listen to AdManager Events
    this.currentAdContext.addEventListener(
      this.fwSDK.EVENT_REQUEST_COMPLETE,
      this.onRequestComplete.bind(this)
    );
    this.currentAdContext.addEventListener(
      this.fwSDK.EVENT_SLOT_ENDED,
      this.onSlotEnded.bind(this)
    );

    // Submit ad request
    this.adDataRequested = true;
    this.onAdRequest();
    this.fwAdsLog("Send ad request");
    this.currentAdContext.submitRequest();
  };

  // start ads request if autoPlay set
  if (this.options.autoPlay) {
    this.requestAds();
  }
  // }

  const fuckOff = () => {
    console.log("fuck from fwa");
  };
};

FreewheelAds.prototype.fwAdsLog = function (...msg) {
  if (typeof console === "undefined" || !this.options.debug) {
    return;
  }
  videojs.log("FreewheelAds:", ...msg);
};

FreewheelAds.prototype.setLogLevel = function (level) {
  if (level === "quiet") {
    this.fwSDK.setLogLevel(this.fwSDK.LOG_LEVEL_QUIET);
  } else if (level === "debug") {
    this.fwSDK.setLogLevel(this.fwSDK.LOG_LEVEL_DEBUG);
  } else {
    this.fwSDK.setLogLevel(this.fwSDK.LOG_LEVEL_INFO);
  }
};

FreewheelAds.prototype.setupContext = function () {
  // set context video info for request
  this.currentAdContext.setVideoAsset(
    this.options.videoAssetId,
    this.options.videoDuration
  );
  // set UI parameters
  this.currentAdContext.setParameter(
    this.fwSDK.PARAMETER_EXTENSION_AD_CONTROL_CLICK_ELEMENT,
    "fw-ad-container",
    this.fwSDK.PARAMETER_LEVEL_GLOBAL
  );
  this.currentAdContext.setParameter(
    this.fwSDK.PARAMETER_RENDERER_VIDEO_DISPLAY_CONTROLS_WHEN_PAUSE,
    false,
    this.fwSDK.PARAMETER_LEVEL_GLOBAL
  );
  // setup listeners
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_AD_IMPRESSION,
    (e) => {
      console.log("adimpression", e);
      this.currentAdInstance = e.adInstance;
      this.onAdStarted();
    }
  );
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_AD_IMPRESSION_END,
    (e) => {
      console.log("adimpressionend", e);
      this.onAdEnded();
      this.currentAdInstance = null;
    }
  );
  this.currentAdContext.addEventListener(this.fwSDK.EVENT_SLOT_STARTED, (e) => {
    console.log("slot start", e);
    this.currentAdSlot = e.slot;
    this.player.trigger("ads-pod-started", { currentSlot: this.currentAdSlot });
  });
  this.currentAdContext.addEventListener(this.fwSDK.EVENT_SLOT_ENDED, (e) => {
    console.log("slot end", e);
    this.player.trigger("ads-pod-ended", { currentSlot: this.currentAdSlot });
    this.currentAdSlot = null;
  });
  this.currentAdContext.addEventListener(this.fwSDK.EVENT_ERROR, (e) =>
    this.onAdError(e)
  );
};

FreewheelAds.prototype.getSlotType = function (adUnit) {
  switch (adUnit) {
    case "preroll":
      return this.fwSDK.ADUNIT_PREROLL;
      break;
    case "midroll":
      return this.fwSDK.ADUNIT_MIDROLL;
      break;
    case "overlay":
      return this.fwSDK.ADUNIT_OVERLAY;
      break;
    case "postroll":
      return this.fwSDK.ADUNIT_POSTROLL;
      break;
  }
};

// Listen for ad request completed and set all slot variables
FreewheelAds.prototype.onRequestComplete = function (e) {
  this.fwAdsLog("Ad request completed");
  this.adDataRequested = false;
  // After request completes, store each roll in corresponding slot array
  if (e.success) {
    const fwTemporalSlots = this.currentAdContext.getTemporalSlots();
    for (let i = 0; i < fwTemporalSlots.length; i += 1) {
      const slot = fwTemporalSlots[i];
      const slotTimePositionClass = slot.getTimePositionClass();
      if (slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_PREROLL) {
        this.prerollSlots.push(slot);
      } else if (
        slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_OVERLAY
      ) {
        this.overlaySlots.push(slot);
      } else if (
        slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_MIDROLL
      ) {
        this.midrollSlots.push(slot);
      } else if (
        slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_POSTROLL
      ) {
        this.postrollSlots.push(slot);
      }
    }
    // tell contril-ads if there is no preroll or postroll
    if (this.prerollSlots.length < 1) {
      this.onNoPreroll();
    }
    if (this.postrollSlots.length < 1) {
      this.onNoPostroll();
    }

    this.onAdsReady();
  }
};

FreewheelAds.prototype.playback = function () {
  // this.fwAdsLog("-playback");
  // if we are still waiting on a request, don't do anything
  if (this.adDataRequested) {
    this.fwAdsLog("---------here-------------");
    return;
  }
  // Play preroll(s) if a preroll slot exits, otherwise play content
  if (this.prerollSlots.length) {
    this.playPreroll();
  } else {
    this.playContent();
  }
};

FreewheelAds.prototype.playPreroll = function () {
  this.fwAdsLog("Play preroll ad");
  // Play preroll slot and then remove the played slot from preroll slot array
  if (this.prerollSlots.length) {
    this.onAdBreakStart();
    this.prerollSlots.shift().play();
  } else {
    // When there are no more preroll slots to play, play content
    this.playContent();
  }
};

FreewheelAds.prototype.playContent = function () {
  this.onAdBreakEnd();
  // Play video content, and add event listener to trigger when video time updates or video content ends
  this.player.ads.contentSrc = this.contentSrc;
  this.player.src({ src: this.contentSrc, type: this.contentSrcType });
  this.fwAdsLog("Playing content");
  this.player.on("timeupdate", this.boundTimeUpdate);
  this.setState({ contentState: "VIDEO_STATE_PLAYING" });
  this.currentAdContext.setVideoState(this.fwSDK.VIDEO_STATE_PLAYING);
  this.player.play();
};

FreewheelAds.prototype.resumeContentAfterMidroll = function () {
  // Resume playing content from when the midroll cue
  this.onAdBreakEnd();
  this.player.ads.contentSrc = this.contentSrc;
  this.player.src({ src: this.contentSrc, type: this.contentSrcType });
  this.player.currentTime(this.contentPausedOn);
  this.fwAdsLog(`Resume video at: ${this.contentPausedOn}`);
  this.setState({ contentState: "VIDEO_STATE_PLAYING" });
  this.currentAdContext.setVideoState(this.fwSDK.VIDEO_STATE_PLAYING);
  this.player.play();
};

FreewheelAds.prototype.playPostroll = function () {
  // Play postroll(s) if exits, otherwise cleanup
  if (this.postrollSlots.length) {
    this.fwAdsLog("Playing postroll");
    this.onAdBreakStart();
    this.postrollSlots.shift().play();
  } else {
    this.fwAdsLog("endlinearmode");
    this.onAdBreakEnd();
    this.cleanUp();
  }
};

FreewheelAds.prototype.onSlotEnded = function (e) {
  // Play the next preroll/postroll ad when either a preroll or postroll stops
  // For a midroll slot, call resumeContentAfterMidroll() and wait for next midroll(if any)
  const slotTimePositionClass = e.slot.getTimePositionClass();
  if (slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_PREROLL) {
    this.fwAdsLog("Previous preroll slot ended");
    this.playPreroll();
  } else if (
    slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_POSTROLL
  ) {
    this.fwAdsLog("Previous postroll slot ended");
    this.playPostroll();
  } else if (slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_MIDROLL) {
    this.fwAdsLog("Previous midroll slot ended");
    this.resumeContentAfterMidroll();
  }
};

FreewheelAds.prototype.onContentVideoTimeUpdated = function () {
  this.fwAdsLog("Video time update, check for midroll/overlay");
  if (this.overlaySlots.length === 0 && this.midrollSlots.length === 0) {
    this.player.off("timeupdate", this.boundTimeUpdate);
  }

  // Check whether overlay needs to be played
  for (let i = 0; i < this.overlaySlots.length; i += 1) {
    const overlaySlot = this.overlaySlots[i];
    const slotTimePosition = this.overlaySlot.getTimePosition();
    const videoCurrentTime = this.player.currentTime();
    if (Math.abs(videoCurrentTime - slotTimePosition) < 0.5) {
      this.fwAdsLog("Play overlay ad");
      this.overlaySlots.splice(i, 1);
      overlaySlot.play();
      if (document.querySelector('[id^="_fw_ad_container_iframe_Overlay_2"]')) {
        document.querySelector(
          '[id^="_fw_ad_container_iframe_Overlay_1"]'
        ).style.marginBottom = "50px";
      }
      return;
    }
  }

  // Check whether midroll needs to be played
  for (let i = 0; i < this.midrollSlots.length; i += 1) {
    const midrollSlot = this.midrollSlots[i];
    const slotTimePosition = midrollSlot.getTimePosition();
    const videoCurrentTime = this.player.currentTime();
    if (Math.abs(videoCurrentTime - slotTimePosition) < 0.5) {
      this.contentPausedOn = this.player.currentTime();
      this.onAdBreakStart();
      this.currentAdContext.setVideoState(this.fwSDK.VIDEO_STATE_PAUSED);
      this.setState({ contentState: "VIDEO_STATE_PAUSED" });
      this.midrollSlots.splice(i, 1);
      this.fwAdsLog("Play midroll ad");
      midrollSlot.play();
      return;
    }
  }
};

FreewheelAds.prototype.onContentVideoEnded = function () {
  this.fwAdsLog("Content ended");
  // Unbind the event listener for detecting when the content video ends, and play postroll if any
  if (this.state.contentState === "VIDEO_STATE_PLAYING") {
    this.player.off("ended", this.onContentVideoEnded.bind(this));
    this.currentAdContext.setVideoState(this.fwSDK.VIDEO_STATE_COMPLETED);
    this.setState({ contentState: this.fwSDK.VIDEO_STATE_COMPLETED });
    if (this.postrollSlots.length) {
      this.playPostroll();
    }
  }
};

FreewheelAds.prototype.cleanUp = function () {
  this.fwAdsLog("Clean up plugin");
  // Clean up after postroll ended or content ended(no postroll)
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_REQUEST_COMPLETE,
    this.onRequestComplete.bind(this)
  );
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_SLOT_ENDED,
    this.onSlotEnded.bind(this)
  );
  if (this.currentAdContext) {
    this.currentAdContext = null;
  }
};

FreewheelAds.prototype.onAdsReady = function () {
  this.player.trigger("adsready");
};

FreewheelAds.prototype.onNoPreroll = function () {
  this.player.trigger("nopreroll");
};

FreewheelAds.prototype.onNoPostroll = function () {
  this.player.trigger("nopostroll");
};

FreewheelAds.prototype.onAdClicked = function () {
  this.player.trigger("ads-click", { currentAd: this.currentAdInstance });
};

FreewheelAds.prototype.onAdRequest = function () {
  this.player.trigger("ads-request");
};

FreewheelAds.prototype.onAdStarted = function () {
  this.player.trigger("ads-ad-started", { currentAd: this.currentAdInstance });
};

FreewheelAds.prototype.onAdEnded = function () {
  this.player.trigger("ads-ad-ended");
};

FreewheelAds.prototype.onAdError = function (e) {
  this.player.trigger("ads-error", { adError: e });
};

FreewheelAds.prototype.onFullscreenChange = function () {
  if (this.player.isFullscreen()) {
    this.fwUi.onPlayerEnterFullscreen();
  } else {
    this.fwUi.onPlayerExitFullscreen();
  }
};

FreewheelAds.prototype.injectAdContainerDiv = function (adContainerDiv) {
  this.playerControls.el().parentNode.appendChild(adContainerDiv);
};

FreewheelAds.prototype.getIsMobile = function () {
  return this.isMobile;
};

FreewheelAds.prototype.getIsIos = function () {
  return this.isIos;
};

FreewheelAds.prototype.getPlayerId = function () {
  return this.player.id();
};

FreewheelAds.prototype.getOptions = function () {
  return this.options;
};

FreewheelAds.prototype.setVolume = function (level) {
  return this.player.volume(level);
};

FreewheelAds.prototype.toggleFullscreen = function () {
  if (this.player.isFullscreen()) {
    this.player.exitFullscreen();
    this.fwUi.onPlayerExitFullscreen();
  } else {
    this.player.requestFullscreen();
    this.fwUi.onPlayerEnterFullscreen();
  }
};

FreewheelAds.prototype.onAdBreakEnd = function () {
  this.fwAdsLog("Ad Break Ended");
  this.player.on("ended", this.boundEndedListener);
  if (this.player.ads.inAdBreak()) {
    this.player.ads.endLinearAdMode();
  }
  clearInterval(this.adTrackingTimer);
  this.fwUi.onAdBreakEnd();
  this.playerControls.show();
};

FreewheelAds.prototype.onAdBreakStart = function () {
  this.fwAdsLog("Starting Ad Break");
  this.contentSrc = this.player.currentSrc();
  this.contentSrcType = this.player.currentType();
  this.player.off("ended", this.boundEndedListener);
  this.player.ads.startLinearAdMode();
  this.playerControls.hide();
  this.player.pause();
  this.fwUi.onAdBreakStart();
  this.adTrackingTimer = setInterval(this.onAdPlayInterval.bind(this), 250);
};

FreewheelAds.prototype.onAdPlayInterval = function () {
  this.fwAdsLog("Ad Play Interval, update UI");
  const duration = this.currentAdSlot.getTotalDuration();
  // some ads don't provide this infto so set to zero
  let currentTime = this.currentAdSlot.getPlayheadTime();
  currentTime = currentTime > 0 ? currentTime : 0;
  const remainingTime = duration - currentTime;
  let totalAds = this.currentAdSlot.getAdCount() || 0;
  let adPosition = 1;
  adPosition = this.currentAdSlot
    .getAdInstances()
    .reduce((acc, instance) => acc + (instance._isInitiatedSent ? 1 : 0), 0);

  this.fwUi.updatefwUi(
    currentTime,
    remainingTime,
    duration,
    adPosition,
    totalAds
  );
};

FreewheelAds.prototype.onAdPlayPauseClick = function () {
  if (this.player.ads.inAdBreak() && !this.player.paused()) {
    this.fwUi.onAdsPaused();
    this.fwAdsLog("Ad paused");
    this.player.trigger("ads-pause");
    this.player.pause();
  } else {
    this.fwUi.onAdsPlaying();
    this.fwAdsLog("Ad play");
    this.player.trigger("ads-play");
    this.player.play();
  }
};

// Define default values for the plugin's `state` object here.
FreewheelAds.defaultState = {
  contentState: "",
};

// Include the version number.
FreewheelAds.VERSION = VERSION;

const init = function (options) {
  /* eslint no-invalid-this: 'off' */
  this.freewheelAds = new FreewheelAds(this, options);
};

// Register the plugin with video.js.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
registerPlugin("freewheelAds", init);
// videojs.registerPlugin("freewheelAds", FreewheelAds);

export default FreewheelAds;
