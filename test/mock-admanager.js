/* global window */
/* eslint-disable require-jsdoc */
/**
 * A minimal stand-in for FreeWheel's AdManager.js SDK. It implements only the
 * surface this plugin uses and records calls so tests can make assertions
 * without loading the real SDK or making network requests.
 */
const SDK = {
  ADUNIT_MIDROLL: 'midroll',
  ADUNIT_OVERLAY: 'overlay',
  ADUNIT_POSTROLL: 'postroll',
  ADUNIT_PREROLL: 'preroll',
  ADUNIT_STREAM_POSTROLL: '_fw_stream_postroll',
  ADUNIT_STREAM_PREROLL: '_fw_stream_preroll',
  EVENT_AD_IMPRESSION: 'defaultImpression',
  EVENT_AD_IMPRESSION_END: 'adEnd',
  EVENT_ERROR: 'onError',
  EVENT_REQUEST_COMPLETE: 'onRequestComplete',
  EVENT_SLOT_ENDED: 'onSlotEnded',
  EVENT_SLOT_STARTED: 'onSlotStarted',
  ID_TYPE_CUSTOM: 1,
  LOG_LEVEL_DEBUG: 2,
  LOG_LEVEL_INFO: 1,
  LOG_LEVEL_QUIET: 0,
  PARAMETER_EXTENSION_AD_CONTROL_CLICK_ELEMENT: 'extension.adControl.clickElement',
  PARAMETER_LEVEL_GLOBAL: 1,
  PARAMETER_RENDERER_VIDEO_DISPLAY_CONTROLS_WHEN_PAUSE: 'renderer.video.displayControlsWhenPause',
  REQUEST_MODE_LIVE: 'LIVE',
  TIME_POSITION_CLASS_MIDROLL: 'MIDROLL',
  TIME_POSITION_CLASS_OVERLAY: 'OVERLAY',
  TIME_POSITION_CLASS_POSTROLL: 'POSTROLL',
  TIME_POSITION_CLASS_PREROLL: 'PREROLL',
  VIDEO_ASSET_AUTO_PLAY_TYPE_ATTENDED: 1,
  VIDEO_ASSET_DURATION_TYPE_EXACT: 'exact',
  VIDEO_ASSET_DURATION_TYPE_VARIABLE: 'variable',
  VIDEO_STATE_COMPLETED: 3,
  VIDEO_STATE_PAUSED: 2,
  VIDEO_STATE_PLAYING: 1,

  logLevel: null,
  setLogLevel(level) {
    this.logLevel = level;
  }
};

class MockSlot {
  constructor(timePositionClass, timePosition = 0) {
    this.timePositionClass = timePositionClass;
    this.timePosition = timePosition;
    this.playCount = 0;
  }

  getTimePositionClass() {
    return this.timePositionClass;
  }

  getTimePosition() {
    return this.timePosition;
  }

  play() {
    this.playCount += 1;
  }

  getTotalDuration() {
    return 30;
  }

  getPlayheadTime() {
    return 0;
  }

  getAdCount() {
    return 1;
  }

  getAdInstances() {
    return [];
  }
}

class MockContext {
  constructor() {
    this.calls = {};
    this.listeners = {};
    this.temporalSlots = [];
    this.responseSlots = [];
    this.disposed = false;

    [
      'setProfile',
      'setSiteSection',
      'setVideoAsset',
      'addKeyValue',
      'setParameter',
      'setRequestMode',
      'setRequestDuration',
      'registerVideoDisplayBase',
      'setVideoState',
      'submitRequest'
    ].forEach((name) => {
      this.calls[name] = [];
      this[name] = (...args) => this.calls[name].push(args);
    });
  }

  addEventListener(event, listener) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(listener);
  }

  removeEventListener(event, listener) {
    this.listeners[event] = (this.listeners[event] || []).filter((l) => l !== listener);
  }

  listenerCount(event) {
    return (this.listeners[event] || []).length;
  }

  dispatch(event, data = {}) {
    (this.listeners[event] || []).slice().forEach((l) => l(data));
  }

  addTemporalSlot(...args) {
    this.temporalSlots.push(args);
  }

  getTemporalSlots() {
    return this.responseSlots;
  }

  dispose() {
    this.disposed = true;
  }
}

class MockAdManager {
  constructor() {
    this.contexts = [];
    MockAdManager.instances.push(this);
  }

  setNetwork(networkId) {
    this.networkId = networkId;
  }

  setServer(serverURL) {
    this.serverURL = serverURL;
  }

  newContext() {
    const context = new MockContext();

    this.contexts.push(context);
    return context;
  }
}

MockAdManager.instances = [];

SDK.AdManager = MockAdManager;

export const install = () => {
  MockAdManager.instances = [];
  window.tv = { freewheel: { SDK } };
};

export const uninstall = () => {
  delete window.tv;
};

export { MockSlot, MockAdManager, SDK };
