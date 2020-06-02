/* global window document navigator */
/* eslint indent: ["error", 2, { "SwitchCase": 1 }]*/
import videojs from 'video.js';
import FwUi from './ui.js';

const Controller = function(player, options) {
  this.player = player;

  this.options = options;

  // initialize contrib-ads plugin
  const contribAdsDefaults = {
    debug: options.debug
  };
  const adsPluginSettings = Object.assign(
    {},
    contribAdsDefaults,
    options.contribAdsSettings || {}
  );

  this.player.ads(adsPluginSettings);

  this.adTrackingTimer = null;
  this.boundEndedListener = this.onContentVideoEnded.bind(this);
  this.boundTimeUpdate = this.onContentVideoTimeUpdated.bind(this);
  this.contentPausedOn = 0;
  this.contentSrc = null;
  this.contentSrcType = null;
  this.contentState = '';
  this.currentAdContext = null;
  this.currentAdInstance = null;
  this.currentAdSlot = null;
  this.freewheel = window.tv.freewheel;
  this.fwSDK = window.tv.freewheel.SDK;
  // have to implement our own tracker since AdManger doesn't seem to dispose/remove listeners properly
  this.isAdPlaying = false;
  this.playerControls = this.player.getChild('controlBar');

  this.setLogLevel(this.options.adManagerLogLevel);

  this.isMobile = (navigator.userAgent.match(/iPhone/i) ||
    navigator.userAgent.match(/iPad/i) ||
    navigator.userAgent.match(/Android/i));

  this.isIos = (navigator.userAgent.match(/iPhone/i) ||
    navigator.userAgent.match(/iPad/i));

  this.player.ready(() => {
    this.player.addClass('vjs-freewheel-ads');
  });

  this.player.on('contentchanged', () => {
    this.fwAdsLog('Video content changed, request ads again');
    this.requestAds();
  });
  this.player.on('readyforpreroll', () => {
    this.playback();
  });
  this.player.on('dispose', () => this.reset());

  // Only one AdManager instance is needed for each player
  this.adManager = new this.fwSDK.AdManager();
  this.adManager.setNetwork(this.options.networkId);
  this.adManager.setServer(this.options.serverURL);

  // initialize ad ui overlay
  this.FwUi = new FwUi(this);

  // initialize context events
  this.setupContext();

  // start ads request if autoPlay set
  if (this.options.autoPlay) {
    this.requestAds();
  }
};

Controller.prototype.fwAdsLog = function(...msg) {
  if (typeof console === 'undefined' || !this.options.debug) {
    return;
  }
  videojs.log('FreewheelAds:', ...msg);
};

Controller.prototype.setLogLevel = function(level) {
  if (level === 'quiet') {
    this.fwSDK.setLogLevel(this.fwSDK.LOG_LEVEL_QUIET);
  } else if (level === 'debug') {
    this.fwSDK.setLogLevel(this.fwSDK.LOG_LEVEL_DEBUG);
  } else {
    this.fwSDK.setLogLevel(this.fwSDK.LOG_LEVEL_INFO);
  }
};

Controller.prototype.updateOptions = function(newOptions) {
  this.fwAdsLog('updateOptions, new options: ', newOptions);
  this.options = videojs.mergeOptions(this.options, newOptions);

  // create context for next request
  this.setupContext();
};

Controller.prototype.getCurrentAdInstance = function() {
  return this.currentAdInstance;
};

Controller.prototype.getCurrentAdSlot = function() {
  return this.currentAdSlot;
};

Controller.prototype.setupContext = function() {
  // set context video info for request
  this.currentAdContext = this.adManager.newContext();
  this.currentAdContext.setProfile(this.options.profileId);
  this.currentAdContext.setSiteSection(this.options.siteSectionId);
  this.currentAdContext.setVideoAsset(
    this.options.videoAssetId,
    this.options.videoDuration
  );
  // set UI parameters
  this.currentAdContext.setParameter(
    this.fwSDK.PARAMETER_RENDERER_VIDEO_DISPLAY_CONTROLS_WHEN_PAUSE,
    false,
    this.fwSDK.PARAMETER_LEVEL_GLOBAL
  );
  // setup listeners
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_SLOT_STARTED,
    this.onSlotStarted.bind(this)
  );
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_SLOT_ENDED,
    this.onSlotEnded.bind(this)
  );
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_AD_IMPRESSION,
    this.onAdStarted.bind(this)
  );
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_AD_IMPRESSION_END,
    this.onAdEnded.bind(this)
  );
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_ERROR,
    this.onAdError.bind(this)
  );
  if (!this.isMobile) {
    this.currentAdContext.setParameter(
      this.fwSDK.PARAMETER_EXTENSION_AD_CONTROL_CLICK_ELEMENT,
      'fw-ad-container',
      this.fwSDK.PARAMETER_LEVEL_GLOBAL
    );
  }
};

Controller.prototype.requestAds = function() {
  this.fwAdsLog('Build ad request');
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
  const displayBaseId = this.player.id() || 'video-player';

  this.currentAdContext.registerVideoDisplayBase(displayBaseId);

  // Submit ad request
  // Listen to AdManager Events
  this.currentAdContext.addEventListener(
    this.fwSDK.EVENT_REQUEST_COMPLETE,
    this.onRequestComplete.bind(this)
  );

  // Submit ad request
  this.onAdRequest();
  this.fwAdsLog('Send ad request');
  this.currentAdContext.submitRequest();
};

Controller.prototype.getSlotType = function(adUnit) {
  switch (adUnit) {
    case 'preroll':
      return this.fwSDK.ADUNIT_PREROLL;
    case 'midroll':
      return this.fwSDK.ADUNIT_MIDROLL;
    case 'overlay':
      return this.fwSDK.ADUNIT_OVERLAY;
    case 'postroll':
      return this.fwSDK.ADUNIT_POSTROLL;
  }
};

// Listen for ad request completed and set all slot variables
Controller.prototype.onRequestComplete = function(e) {
  this.fwAdsLog('Ad request completed');
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

Controller.prototype.playback = function() {
  // Play preroll(s) if a preroll slot exits, otherwise play content
  if (this.prerollSlots.length) {
    this.playPreroll();
  } else {
    this.playContent();
  }
};

Controller.prototype.playPreroll = function() {
  this.fwAdsLog('Play preroll ad');
  // Play preroll slot and then remove the played slot from preroll slot array
  if (this.prerollSlots.length) {
    this.onAdBreakStart();
    this.prerollSlots.shift().play();
  } else {
    // When there are no more preroll slots to play, play content
    this.playContent();
  }
};

Controller.prototype.playContent = function() {
  this.onAdBreakEnd();
  // Play video content, and add event listener to trigger when video time updates or video content ends
  this.player.ads.contentSrc = this.contentSrc;
  this.player.src({ src: this.contentSrc, type: this.contentSrcType });
  this.fwAdsLog('Playing content');
  this.player.on('timeupdate', this.boundTimeUpdate);
  this.contentState = 'VIDEO_STATE_PLAYING';
  this.currentAdContext.setVideoState(this.fwSDK.VIDEO_STATE_PLAYING);
  this.player.play();
};

Controller.prototype.resumeContentAfterMidroll = function() {
  // Resume playing content from when the midroll cue
  this.onAdBreakEnd();
  this.player.ads.contentSrc = this.contentSrc;
  this.player.src({ src: this.contentSrc, type: this.contentSrcType });
  this.player.currentTime(this.contentPausedOn);
  this.fwAdsLog(`Resume video at: ${this.contentPausedOn}`);
  this.contentState = 'VIDEO_STATE_PLAYING';
  this.currentAdContext.setVideoState(this.fwSDK.VIDEO_STATE_PLAYING);
  this.player.play();
};

Controller.prototype.playPostroll = function() {
  // Play postroll(s) if exits, otherwise cleanup
  if (this.postrollSlots.length) {
    this.fwAdsLog('Playing postroll');
    this.onAdBreakStart();
    this.postrollSlots.shift().play();
  } else {
    this.fwAdsLog('endlinearmode');
    this.onAdBreakEnd();
    this.reset();
  }
};

Controller.prototype.onSlotStarted = function(e) {
  if (!this.isAdPlaying) {
    return;
  }
  this.currentAdSlot = e.slot;
  this.player.trigger('ads-pod-started', { currentSlot: this.currentAdSlot });
};

Controller.prototype.onSlotEnded = function(e) {
  if (!this.isAdPlaying) {
    return;
  }
  // Play the next preroll/postroll ad when either a preroll or postroll stops
  // For a midroll slot, call resumeContentAfterMidroll() and wait for next midroll(if any)
  this.player.trigger('ads-pod-ended', { currentSlot: this.currentAdSlot });
  this.currentAdSlot = null;
  const slotTimePositionClass = e.slot.getTimePositionClass();

  if (slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_PREROLL) {
    this.fwAdsLog('Previous preroll slot ended');
    this.playPreroll();
  } else if (
    slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_POSTROLL
  ) {
    this.fwAdsLog('Previous postroll slot ended');
    this.playPostroll();
  } else if (slotTimePositionClass === this.fwSDK.TIME_POSITION_CLASS_MIDROLL) {
    this.fwAdsLog('Previous midroll slot ended');
    this.resumeContentAfterMidroll();
  }
};

Controller.prototype.onContentVideoTimeUpdated = function() {
  this.fwAdsLog('Video time update, check for midroll/overlay');
  if (this.overlaySlots.length === 0 && this.midrollSlots.length === 0) {
    this.player.off('timeupdate', this.boundTimeUpdate);
  }

  // Check whether overlay needs to be played
  for (let i = 0; i < this.overlaySlots.length; i += 1) {
    const overlaySlot = this.overlaySlots[i];
    const slotTimePosition = this.overlaySlot.getTimePosition();
    const videoCurrentTime = this.player.currentTime();

    if (Math.abs(videoCurrentTime - slotTimePosition) < 0.5) {
      this.fwAdsLog('Play overlay ad');
      this.overlaySlots.splice(i, 1);
      overlaySlot.play();
      if (document.querySelector('[id^="_fw_ad_container_iframe_Overlay_2"]')) {
        document.querySelector('[id^="_fw_ad_container_iframe_Overlay_1"]').style.marginBottom = '50px';
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
      this.contentState = 'VIDEO_STATE_PAUSED';
      this.midrollSlots.splice(i, 1);
      this.fwAdsLog('Play midroll ad');
      midrollSlot.play();
      return;
    }
  }
};

Controller.prototype.onContentVideoEnded = function() {
  this.fwAdsLog('Content ended');
  // Unbind the event listener for detecting when the content video ends, and play postroll if any
  if (this.contentState === 'VIDEO_STATE_PLAYING') {
    this.player.off('ended', this.onContentVideoEnded.bind(this));
    this.currentAdContext.setVideoState(this.fwSDK.VIDEO_STATE_COMPLETED);
    this.contentState = this.fwSDK.VIDEO_STATE_COMPLETED;
    if (this.postrollSlots.length) {
      this.playPostroll();
    }
  }
};

Controller.prototype.reset = function() {
  this.fwAdsLog('Clean up and reset plugin');
  clearInterval(this.adTrackingTimer);
  this.currentAdInstance = null;
  this.currentAdSlot = null;
  this.contentPausedOn = 0;
  this.contentSrc = null;
  this.contentSrcType = null;
  this.contentState = '';
  this.isAdPlaying = false;
  this.playerControls.show();
  this.FwUi.reset();
  this.player.off('timeupdate', this.boundTimeUpdate);
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_REQUEST_COMPLETE,
    this.onRequestComplete.bind(this)
  );
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_SLOT_STARTED,
    this.onSlotStarted.bind(this)
  );
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_SLOT_ENDED,
    this.onSlotEnded.bind(this)
  );
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_AD_IMPRESSION,
    this.onAdStarted.bind(this)
  );
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_AD_IMPRESSION_END,
    this.onAdEnded.bind(this)
  );
  this.currentAdContext.removeEventListener(
    this.fwSDK.EVENT_ERROR,
    this.onAdError.bind(this)
  );
  if (this.currentAdContext) {
    this.currentAdContext.dispose();
    this.currentAdContext = null;
  }
  if (this.player.ads.inAdBreak()) {
    this.player.ads.disableNextSnapshotRestore = true;
    this.player.ads.endLinearAdMode();
    this.player.trigger('contentresumed');
  }
};

Controller.prototype.onAdsReady = function() {
  this.player.trigger('adsready');
};

Controller.prototype.onNoPreroll = function() {
  this.player.trigger('nopreroll');
};

Controller.prototype.onNoPostroll = function() {
  this.player.trigger('nopostroll');
};

Controller.prototype.onAdClicked = function() {
  if (this.isMobile) {
    // if its mobile, a click on the container should play/pause
    this.onAdPlayPauseClick();
  } else {
    this.player.trigger('ads-click', { currentAd: this.currentAdInstance });
  }
};

Controller.prototype.onAdRequest = function() {
  this.player.trigger('ads-request');
};

Controller.prototype.onAdStarted = function(e) {
  if (!this.isAdPlaying) {
    return;
  }
  this.currentAdInstance = e.adInstance;
  this.player.trigger('ads-ad-started', { currentAd: e.adInstance });
};

Controller.prototype.onAdEnded = function(e) {
  if (!this.isAdPlaying) {
    return;
  }
  this.player.trigger('ads-ad-ended', { currentAd: e.adInstance });
  this.currentAdInstance = null;
};

Controller.prototype.onAdError = function(e) {
  this.player.trigger('ads-error', { adError: e });
};

Controller.prototype.onFullscreenChange = function() {
  if (this.player.isFullscreen()) {
    this.FwUi.onPlayerEnterFullscreen();
  } else {
    this.FwUi.onPlayerExitFullscreen();
  }
};

Controller.prototype.injectAdContainerDiv = function(adContainerDiv) {
  this.playerControls.el().parentNode.appendChild(adContainerDiv);
};

Controller.prototype.getIsMobile = function() {
  return this.isMobile;
};

Controller.prototype.getIsIos = function() {
  return this.isIos;
};

Controller.prototype.getPlayerId = function() {
  return this.player.id();
};

Controller.prototype.getOptions = function() {
  return this.options;
};

Controller.prototype.getIsMobile = function() {
  return this.isMobile;
};

Controller.prototype.getIsIos = function() {
  return this.isIos;
};

Controller.prototype.setVolume = function(level) {
  return this.player.volume(level);
};

Controller.prototype.toggleFullscreen = function() {
  this.fwAdsLog('Toggle fullscreen');
  if (this.player.isFullscreen()) {
    this.player.exitFullscreen();
    this.FwUi.onPlayerExitFullscreen();
  } else {
    this.player.requestFullscreen();
    this.FwUi.onPlayerEnterFullscreen();
  }
};

Controller.prototype.onAdBreakEnd = function() {
  this.fwAdsLog('Ad break ended');
  this.isAdPlaying = false;
  this.player.on('ended', this.boundEndedListener);
  if (this.player.ads.inAdBreak()) {
    this.player.ads.endLinearAdMode();
  }
  clearInterval(this.adTrackingTimer);
  this.FwUi.onAdBreakEnd();
  this.playerControls.show();
};

Controller.prototype.onAdBreakStart = function() {
  this.fwAdsLog('Starting ad break');
  this.isAdPlaying = true;
  this.contentSrc = this.player.currentSrc();
  this.contentSrcType = this.player.currentType();
  this.player.off('ended', this.boundEndedListener);
  this.player.ads.startLinearAdMode();
  this.playerControls.hide();
  this.player.pause();
  this.FwUi.onAdBreakStart();
  this.adTrackingTimer = setInterval(this.onAdPlayInterval.bind(this), 250);
};

Controller.prototype.onAdPlayInterval = function() {
  if (!this.isAdPlaying) {
    return;
  }
  this.fwAdsLog('Ad playing interval, update UI');
  const duration = this.currentAdSlot.getTotalDuration();
  // some ads don't provide this infto so set to zero
  let currentTime = this.currentAdSlot.getPlayheadTime();

  currentTime = currentTime > 0 ? currentTime : 0;
  const remainingTime = duration - currentTime;
  const totalAds = this.currentAdSlot.getAdCount() || 0;
  let adPosition = 1;

  adPosition = this.currentAdSlot
    .getAdInstances()
    .reduce((acc, instance) => acc + (instance._isInitiatedSent ? 1 : 0), 0);

  this.FwUi.updateFwUi(
    currentTime,
    remainingTime,
    duration,
    adPosition,
    totalAds
  );
};

Controller.prototype.onAdPlayPauseClick = function() {
  if (this.player.ads.inAdBreak() && !this.player.paused()) {
    this.FwUi.onAdsPaused();
    this.fwAdsLog('Ad paused');
    this.player.trigger('ads-pause');
    this.player.pause();
  } else {
    this.FwUi.onAdsPlaying();
    this.fwAdsLog('Ad play');
    this.player.trigger('ads-play');
    this.player.play();
  }
};

export default Controller;
