/* global document */
import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';
import 'videojs-contrib-ads';

import plugin from '../src/plugin';
import { install, uninstall, MockAdManager, MockSlot, SDK } from './mock-admanager';

const Player = videojs.getComponent('Player');

const options = {
  networkId: '42015',
  profileId: '42015:test_profile',
  serverURL: 'https://example.v.fwmrm.net/ad/g/1',
  siteSectionId: 'test_site_section',
  videoAssetId: 'test_asset',
  videoDuration: 120,
  adSlots: [
    { id: 'pre', adUnit: 'preroll', timePosition: 0 },
    { id: 'mid', adUnit: 'midroll', timePosition: 30 },
    { id: 'post', adUnit: 'postroll', timePosition: 120 }
  ]
};

QUnit.test('the environment is sane', function(assert) {
  assert.strictEqual(typeof Array.isArray, 'function', 'es5 exists');
  assert.strictEqual(typeof sinon, 'object', 'sinon exists');
  assert.strictEqual(typeof videojs, 'function', 'videojs exists');
  assert.strictEqual(typeof plugin, 'function', 'plugin is a function');
});

QUnit.module('videojs-freewheel-ads', {

  beforeEach() {

    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js. This MUST come
    // before any player is created; otherwise, timers could get created
    // with the actual timer methods!
    this.clock = sinon.useFakeTimers();

    install();

    this.fixture = document.getElementById('qunit-fixture');
    this.video = document.createElement('video');
    this.fixture.appendChild(this.video);
    this.player = videojs(this.video);

    // the most recently created AdManager context
    this.context = () => {
      const contexts = MockAdManager.instances[0].contexts;

      return contexts[contexts.length - 1];
    };
  },

  afterEach() {
    if (!this.player.isDisposed()) {
      this.player.dispose();
    }
    uninstall();
    this.clock.restore();
  }
});

QUnit.test('registers itself with video.js', function(assert) {
  assert.expect(2);

  assert.strictEqual(
    typeof Player.prototype.freewheelAds,
    'function',
    'videojs-freewheel-ads plugin was registered'
  );

  this.player.freewheelAds();

  // Tick the clock forward enough to trigger the player to be "ready".
  this.clock.tick(1);

  assert.ok(
    this.player.hasClass('vjs-freewheel-ads'),
    'the plugin adds a class to the player'
  );
});

QUnit.test('throws a helpful error when AdManager.js is not loaded', function(assert) {
  uninstall();

  assert.throws(
    () => this.player.freewheelAds(),
    /Missing dependency of AdManager\.js/,
    'throws when window.tv is missing'
  );
});

QUnit.test('configures AdManager and submits an ad request with the given options', function(assert) {
  this.player.freewheelAds(videojs.obj.merge(options, {
    keyValues: [{ key: '_fw_us_privacy', value: '1YNN' }]
  }));

  const adManager = MockAdManager.instances[0];
  const context = this.context();

  assert.strictEqual(adManager.networkId, options.networkId, 'network is set');
  assert.strictEqual(adManager.serverURL, options.serverURL, 'server is set');
  assert.deepEqual(context.calls.setProfile, [[options.profileId]], 'profile is set');
  assert.strictEqual(context.calls.setSiteSection[0][0], options.siteSectionId, 'site section is set');
  assert.strictEqual(context.calls.setVideoAsset[0][0], options.videoAssetId, 'video asset is set');
  assert.strictEqual(context.calls.setVideoAsset[0][1], options.videoDuration, 'video duration is set');
  assert.deepEqual(
    context.calls.addKeyValue[1],
    ['_fw_us_privacy', '1YNN'],
    'custom key values are added after the referrer'
  );
  assert.deepEqual(
    context.temporalSlots.map(([id, adUnit, timePosition]) => [id, adUnit, timePosition]),
    [['pre', SDK.ADUNIT_PREROLL, 0], ['mid', SDK.ADUNIT_MIDROLL, 30], ['post', SDK.ADUNIT_POSTROLL, 120]],
    'temporal slots are added'
  );
  assert.strictEqual(context.calls.submitRequest.length, 1, 'the request is submitted');
});

QUnit.test('does not request ads when autoPlay is false', function(assert) {
  this.player.freewheelAds(videojs.obj.merge(options, { autoPlay: false }));

  assert.strictEqual(MockAdManager.instances[0].contexts.length, 0, 'no context was created');

  this.player.freewheelAds.requestAds();

  assert.strictEqual(this.context().calls.submitRequest.length, 1, 'requestAds submits a request');
});

QUnit.test('signals contrib-ads when the response has no prerolls or postrolls', function(assert) {
  const events = [];

  ['adsready', 'nopreroll', 'nopostroll'].forEach((type) => {
    this.player.on(type, () => events.push(type));
  });

  this.player.freewheelAds(options);
  this.context().responseSlots = [new MockSlot(SDK.TIME_POSITION_CLASS_MIDROLL, 30)];
  this.context().dispatch(SDK.EVENT_REQUEST_COMPLETE, { success: true });

  assert.deepEqual(events, ['nopreroll', 'nopostroll', 'adsready'], 'events are triggered');
});

QUnit.test('plays the preroll when contrib-ads is ready for it', function(assert) {
  this.player.freewheelAds(options);

  const preroll = new MockSlot(SDK.TIME_POSITION_CLASS_PREROLL);

  this.context().responseSlots = [preroll];
  this.context().dispatch(SDK.EVENT_REQUEST_COMPLETE, { success: true });

  // contrib-ads triggers readyforpreroll once it has adsready, a play request,
  // and a loadstart for the content source
  this.player.trigger('play');
  this.player.trigger('loadstart');

  assert.strictEqual(preroll.playCount, 1, 'the preroll slot is played');
  assert.ok(this.player.ads.inAdBreak(), 'the player is in an ad break');
});

QUnit.test('plays an overlay when content reaches its time position', function(assert) {
  this.player.freewheelAds(options);

  const overlay = new MockSlot(SDK.TIME_POSITION_CLASS_OVERLAY, 10);
  const controller = this.player.freewheelAds.controller;

  this.context().responseSlots = [overlay];
  this.context().dispatch(SDK.EVENT_REQUEST_COMPLETE, { success: true });
  this.player.currentTime = () => 10.2;

  controller.onContentVideoTimeUpdated();

  assert.strictEqual(overlay.playCount, 1, 'the overlay slot is played');
  assert.strictEqual(controller.overlaySlots.length, 0, 'the overlay is only played once');
});

QUnit.test('uses a fresh context for each ad request', function(assert) {
  this.player.freewheelAds(options);

  const first = this.context();

  this.player.freewheelAds.requestAds();

  const second = this.context();

  assert.notStrictEqual(first, second, 'a new context is created');
  assert.ok(first.disposed, 'the previous context is disposed');
  assert.strictEqual(first.listenerCount(SDK.EVENT_SLOT_ENDED), 0, 'listeners are removed from the old context');
  assert.strictEqual(second.listenerCount(SDK.EVENT_REQUEST_COMPLETE), 1, 'request listener is added once');
  assert.strictEqual(second.temporalSlots.length, options.adSlots.length, 'slots are not duplicated');
});

QUnit.test('can request ads again after a reset', function(assert) {
  this.player.freewheelAds(options);
  this.player.freewheelAds.reset();

  assert.ok(this.context().disposed, 'reset disposes the context');

  this.player.trigger('contentchanged');

  assert.notOk(this.context().disposed, 'a new context is created for the new content');
  assert.strictEqual(this.context().calls.submitRequest.length, 1, 'ads are requested for the new content');
});

QUnit.test('updateOptions applies to the next ad request', function(assert) {
  this.player.freewheelAds(options);
  this.player.freewheelAds.updateOptions({ videoAssetId: 'next_asset', videoDuration: 60 });
  this.player.freewheelAds.requestAds();

  const [assetId, duration] = this.context().calls.setVideoAsset[0];

  assert.strictEqual(assetId, 'next_asset', 'new asset id is used');
  assert.strictEqual(duration, 60, 'new duration is used');
  assert.strictEqual(this.context().calls.setProfile[0][0], options.profileId, 'other options are kept');
});

QUnit.test('removes its listeners when the player is disposed', function(assert) {
  this.player.freewheelAds(options);

  const context = this.context();

  this.player.dispose();

  assert.ok(context.disposed, 'the context is disposed with the player');
  assert.strictEqual(context.listenerCount(SDK.EVENT_ERROR), 0, 'context listeners are removed');
});
