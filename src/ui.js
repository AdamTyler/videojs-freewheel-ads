/* global document */
const FwUi = function(controller) {
  this.controller = controller;

  this.adContainerDiv = document.createElement('div');
  this.controlsDiv = document.createElement('div');
  this.countdownDiv = document.createElement('div');
  this.fullscreenDiv = document.createElement('div');
  this.playPauseDiv = document.createElement('div');
  this.progressDiv = document.createElement('div');
  this.seekBarDiv = document.createElement('div');
  this.sliderDiv = document.createElement('div');
  this.sliderLevelDiv = document.createElement('div');

  this.boundOnMouseUp = this.onMouseUp.bind(this);
  this.boundOnMouseMove = this.onMouseMove.bind(this);

  this.showCountdown = true;
  if (this.controller.getOptions().showCountdown === false) {
    this.showCountdown = false;
  }
  this.createAdContainer();
};

FwUi.prototype.createAdContainer = function() {
  this.assignControlAttributes(this.adContainerDiv, 'fw-ad-container');
  this.adContainerDiv.style.position = 'absolute';
  this.adContainerDiv.style.zIndex = 1111;
  this.adContainerDiv.addEventListener(
    'mouseenter',
    this.showAdControls.bind(this),
    false
  );
  this.adContainerDiv.addEventListener(
    'mouseleave',
    this.hideAdControls.bind(this),
    false
  );
  this.adContainerDiv.addEventListener(
    'click',
    this.onContainerClicked.bind(this),
    false
  );
  this.createControls();
  this.controller.injectAdContainerDiv(this.adContainerDiv);
};

FwUi.prototype.createControls = function() {
  this.assignControlAttributes(this.controlsDiv, 'fw-controls-div');
  this.controlsDiv.style.width = '100%';

  if (!this.controller.getIsMobile()) {
    this.assignControlAttributes(this.countdownDiv, 'fw-countdown-div');
    this.countdownDiv.innerHTML = 'Ad';
    this.countdownDiv.style.display = this.showCountdown ? 'block' : 'none';
  } else {
    this.countdownDiv.style.display = 'none';
  }

  this.assignControlAttributes(this.seekBarDiv, 'fw-seek-bar-div');
  this.seekBarDiv.style.width = '100%';

  this.assignControlAttributes(this.progressDiv, 'fw-progress-div');

  this.assignControlAttributes(this.playPauseDiv, 'fw-play-pause-div');
  this.addClass(this.playPauseDiv, 'fw-playing');
  this.playPauseDiv.addEventListener(
    'click',
    this.onAdPlayPauseClick.bind(this),
    false
  );

  this.assignControlAttributes(this.sliderDiv, 'fw-slider-div');
  this.sliderDiv.addEventListener(
    'mousedown',
    this.onAdVolumeSliderMouseDown.bind(this),
    false
  );
  this.sliderDiv.addEventListener(
    'click',
    (e) => e.stopImmediatePropagation(),
    false
  );

  // Hide volume slider controls on iOS as they aren't supported.
  if (this.controller.getIsIos()) {
    this.sliderDiv.style.display = 'none';
  }

  this.assignControlAttributes(this.sliderLevelDiv, 'fw-slider-level-div');

  this.assignControlAttributes(this.fullscreenDiv, 'fw-fullscreen-div');
  this.addClass(this.fullscreenDiv, 'fw-non-fullscreen');
  this.fullscreenDiv.addEventListener(
    'click',
    this.onAdFullscreenClick.bind(this),
    false
  );

  this.adContainerDiv.appendChild(this.controlsDiv);
  this.controlsDiv.appendChild(this.countdownDiv);
  this.controlsDiv.appendChild(this.seekBarDiv);
  this.controlsDiv.appendChild(this.playPauseDiv);
  this.controlsDiv.appendChild(this.sliderDiv);
  this.seekBarDiv.appendChild(this.progressDiv);
  this.sliderDiv.appendChild(this.sliderLevelDiv);
  this.controlsDiv.appendChild(this.fullscreenDiv);
};

FwUi.prototype.onAdPlayPauseClick = function(e) {
  e.stopPropagation();
  this.controller.onAdPlayPauseClick();
};

FwUi.prototype.onAdsPaused = function() {
  this.addClass(this.playPauseDiv, 'fw-paused');
  this.removeClass(this.playPauseDiv, 'fw-playing');
  this.showAdControls();
};

FwUi.prototype.onAdsResumed = function() {
  this.onAdsPlaying();
  this.showAdControls();
};

FwUi.prototype.onAdsPlaying = function() {
  this.addClass(this.playPauseDiv, 'fw-playing');
  this.removeClass(this.playPauseDiv, 'fw-paused');
};

FwUi.prototype.updateFwUi = function(
  currentTime,
  remainingTime,
  duration,
  adPosition,
  totalAds
) {
  // Update countdown timer data
  const remainingMinutes = Math.floor(remainingTime / 60);
  let remainingSeconds = Math.floor(remainingTime % 60);
  let podCount = ':';

  if (remainingSeconds.toString().length < 2) {
    remainingSeconds = '0' + remainingSeconds;
  }

  if (totalAds > 1) {
    podCount = ` (${adPosition} of ${totalAds}):`;
  }
  this.countdownDiv.innerHTML = `Ad${podCount} ${remainingMinutes}:${remainingSeconds}`;

  // Update UI
  const playProgressRatio = currentTime / duration;
  const playProgressPercent = playProgressRatio * 100;

  this.progressDiv.style.width = playProgressPercent + '%';
};

FwUi.prototype.onAdVolumeSliderMouseDown = function(e) {
  e.stopPropagation();
  document.addEventListener('mouseup', this.boundOnMouseUp, false);
  document.addEventListener('mousemove', this.boundOnMouseMove, false);
};

FwUi.prototype.onMouseMove = function(e) {
  e.stopPropagation();
  this.changeVolume(e.clientX);
};

FwUi.prototype.onMouseUp = function(e) {
  e.stopPropagation();
  this.changeVolume(e.clientX);
  document.removeEventListener('mouseup', this.boundOnMouseUp);
  document.removeEventListener('mousemove', this.boundOnMouseMove);
};

FwUi.prototype.changeVolume = function(clientX) {
  let percent =
    (clientX - this.sliderDiv.getBoundingClientRect().left) /
    this.sliderDiv.offsetWidth;

  percent *= 100;
  // Bounds value 0-100 if mouse is outside slider region.
  percent = Math.min(Math.max(percent, 0), 100);
  this.sliderLevelDiv.style.width = percent + '%';
  this.controller.setVolume(percent / 100);
};

FwUi.prototype.onAdFullscreenClick = function(e) {
  e.stopPropagation();
  this.controller.toggleFullscreen();
};

FwUi.prototype.onPlayerEnterFullscreen = function() {
  this.addClass(this.fullscreenDiv, 'fw-fullscreen');
  this.removeClass(this.fullscreenDiv, 'fw-non-fullscreen');
};

FwUi.prototype.onPlayerExitFullscreen = function() {
  this.addClass(this.fullscreenDiv, 'fw-non-fullscreen');
  this.removeClass(this.fullscreenDiv, 'fw-fullscreen');
};

FwUi.prototype.onContainerClicked = function(e) {
  e.preventDefault();
  this.controller.onAdClicked(e);
};

FwUi.prototype.showAdContainer = function() {
  this.adContainerDiv.style.display = 'block';
};

FwUi.prototype.hideAdContainer = function() {
  this.adContainerDiv.style.display = 'none';
};

FwUi.prototype.reset = function() {
  this.hideAdContainer();
  this.controlsDiv.style.display = 'none';
  this.countdownDiv.innerHTML = '';
};

FwUi.prototype.onAdError = function() {
  this.hideAdContainer();
};

FwUi.prototype.onAdBreakStart = function() {
  this.showAdContainer();
  this.controlsDiv.style.display = 'block';
  this.onAdsPlaying();
  // Start with the ad controls minimized.
  this.hideAdControls();
};

FwUi.prototype.onAdBreakEnd = function() {
  this.hideAdContainer();
  this.controlsDiv.style.display = 'none';
  this.countdownDiv.innerHTML = '';
};

FwUi.prototype.onAllAdsCompleted = function() {
  this.hideAdContainer();
};

FwUi.prototype.onLinearAdStart = function() {
  // Don't bump container when controls are shown
  this.removeClass(this.adContainerDiv, 'bumpable-fw-ad-container');
};

FwUi.prototype.onNonLinearAdLoad = function() {
  // For non-linear ads that show after a linear ad. For linear ads, we show the
  // ad container in onAdBreakStart to prevent blinking in pods.
  this.adContainerDiv.style.display = 'block';
  // Bump container when controls are shown
  this.addClass(this.adContainerDiv, 'bumpable-fw-ad-container');
};

FwUi.prototype.onPlayerVolumeChanged = function(volume) {
  this.sliderLevelDiv.style.width = volume * 100 + '%';
};

FwUi.prototype.showAdControls = function() {
  const { disableAdControls } = this.controller.getOptions();

  if (!disableAdControls) {
    this.addClass(this.controlsDiv, 'fw-controls-div-showing');
  }
};

FwUi.prototype.hideAdControls = function() {
  this.removeClass(this.controlsDiv, 'fw-controls-div-showing');
};

FwUi.prototype.assignControlAttributes = function(element, controlName) {
  element.id = controlName;
  element.className = controlName;
};

FwUi.prototype.getClassRegexp = function(className) {
  // Matches on
  // (beginning of string OR NOT word char)
  // classname
  // (negative lookahead word char OR end of string)
  return new RegExp('(^|[^A-Za-z-])' + className + '((?![A-Za-z-])|$)', 'gi');
};

FwUi.prototype.addClass = function(element, classToAdd) {
  element.className = element.className.trim() + ' ' + classToAdd;
};

FwUi.prototype.removeClass = function(element, classToRemove) {
  const classRegexp = this.getClassRegexp(classToRemove);

  element.className = element.className.trim().replace(classRegexp, '');
};

export default FwUi;
