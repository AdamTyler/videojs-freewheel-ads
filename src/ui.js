const fwUi = function (plugin) {
  this.plugin = plugin;

  this.adContainerDiv = document.createElement("div");
  this.controlsDiv = document.createElement("div");
  this.countdownDiv = document.createElement("div");
  this.fullscreenDiv = document.createElement("div");
  this.playPauseDiv = document.createElement("div");
  this.progressDiv = document.createElement("div");
  this.seekBarDiv = document.createElement("div");
  this.sliderDiv = document.createElement("div");
  this.sliderLevelDiv = document.createElement("div");

  this.boundOnMouseUp = this.onMouseUp.bind(this);
  this.boundOnMouseMove = this.onMouseMove.bind(this);

  this.showCountdown = true;
  if (this.plugin.getOptions().showCountdown === false) {
    this.showCountdown = false;
  }
  this.createAdContainer();
};

fwUi.prototype.createAdContainer = function () {
  this.assignControlAttributes(this.adContainerDiv, "fw-ad-container");
  this.adContainerDiv.style.position = "absolute";
  this.adContainerDiv.style.zIndex = 1111;
  this.adContainerDiv.addEventListener(
    "mouseenter",
    this.showAdControls.bind(this),
    false
  );
  this.adContainerDiv.addEventListener(
    "mouseleave",
    this.hideAdControls.bind(this),
    false
  );
  this.adContainerDiv.addEventListener(
    "click",
    this.onContainerClicked.bind(this),
    false
  );
  this.createControls();
  this.plugin.injectAdContainerDiv(this.adContainerDiv);
};

fwUi.prototype.createControls = function () {
  this.assignControlAttributes(this.controlsDiv, "fw-controls-div");
  this.controlsDiv.style.width = "100%";

  if (!this.plugin.getIsMobile()) {
    this.assignControlAttributes(this.countdownDiv, "fw-countdown-div");
    this.countdownDiv.innerHTML = "Ad";
    this.countdownDiv.style.display = this.showCountdown ? "block" : "none";
  } else {
    this.countdownDiv.style.display = "none";
  }

  this.assignControlAttributes(this.seekBarDiv, "fw-seek-bar-div");
  this.seekBarDiv.style.width = "100%";

  this.assignControlAttributes(this.progressDiv, "fw-progress-div");

  this.assignControlAttributes(this.playPauseDiv, "fw-play-pause-div");
  this.addClass(this.playPauseDiv, "fw-playing");
  this.playPauseDiv.addEventListener(
    "click",
    this.onAdPlayPauseClick.bind(this),
    false
  );

  this.assignControlAttributes(this.sliderDiv, "fw-slider-div");
  this.sliderDiv.addEventListener(
    "mousedown",
    this.onAdVolumeSliderMouseDown.bind(this),
    false
  );
  this.sliderDiv.addEventListener(
    "click",
    (e) => e.stopImmediatePropagation(),
    false
  );

  // Hide volume slider controls on iOS as they aren't supported.
  if (this.plugin.getIsIos()) {
    this.sliderDiv.style.display = "none";
  }

  this.assignControlAttributes(this.sliderLevelDiv, "fw-slider-level-div");

  this.assignControlAttributes(this.fullscreenDiv, "fw-fullscreen-div");
  this.addClass(this.fullscreenDiv, "fw-non-fullscreen");
  this.fullscreenDiv.addEventListener(
    "click",
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

fwUi.prototype.onAdPlayPauseClick = function (e) {
  e.stopPropagation();
  this.plugin.onAdPlayPauseClick();
};

fwUi.prototype.onAdsPaused = function () {
  this.addClass(this.playPauseDiv, "fw-paused");
  this.removeClass(this.playPauseDiv, "fw-playing");
  this.showAdControls();
};

fwUi.prototype.onAdsResumed = function () {
  this.onAdsPlaying();
  this.showAdControls();
};

fwUi.prototype.onAdsPlaying = function () {
  this.addClass(this.playPauseDiv, "fw-playing");
  this.removeClass(this.playPauseDiv, "fw-paused");
};

fwUi.prototype.updatefwUi = function (
  currentTime,
  remainingTime,
  duration,
  adPosition,
  totalAds
) {
  // Update countdown timer data
  const remainingMinutes = Math.floor(remainingTime / 60);
  let remainingSeconds = Math.floor(remainingTime % 60);
  if (remainingSeconds.toString().length < 2) {
    remainingSeconds = "0" + remainingSeconds;
  }
  let podCount = ":";
  if (totalAds > 1) {
    podCount = ` (${adPosition} of ${totalAds}):`;
  }
  this.countdownDiv.innerHTML = `Ad${podCount} ${remainingMinutes}:${remainingSeconds}`;

  // Update UI
  const playProgressRatio = currentTime / duration;
  const playProgressPercent = playProgressRatio * 100;
  this.progressDiv.style.width = playProgressPercent + "%";
};

fwUi.prototype.onAdVolumeSliderMouseDown = function (e) {
  e.stopPropagation();
  document.addEventListener("mouseup", this.boundOnMouseUp, false);
  document.addEventListener("mousemove", this.boundOnMouseMove, false);
};

fwUi.prototype.onMouseMove = function (e) {
  e.stopPropagation();
  this.changeVolume(e.clientX);
};

fwUi.prototype.onMouseUp = function (e) {
  e.stopPropagation();
  this.changeVolume(e.clientX);
  document.removeEventListener("mouseup", this.boundOnMouseUp);
  document.removeEventListener("mousemove", this.boundOnMouseMove);
};

fwUi.prototype.changeVolume = function (clientX) {
  let percent =
    (clientX - this.sliderDiv.getBoundingClientRect().left) /
    this.sliderDiv.offsetWidth;
  percent *= 100;
  // Bounds value 0-100 if mouse is outside slider region.
  percent = Math.min(Math.max(percent, 0), 100);
  this.sliderLevelDiv.style.width = percent + "%";
  this.plugin.setVolume(percent / 100); // 0-1
};

fwUi.prototype.onAdFullscreenClick = function (e) {
  e.stopPropagation();
  this.plugin.toggleFullscreen();
};

fwUi.prototype.onPlayerEnterFullscreen = function () {
  this.addClass(this.fullscreenDiv, "fw-fullscreen");
  this.removeClass(this.fullscreenDiv, "fw-non-fullscreen");
};

fwUi.prototype.onPlayerExitFullscreen = function () {
  this.addClass(this.fullscreenDiv, "fw-non-fullscreen");
  this.removeClass(this.fullscreenDiv, "fw-fullscreen");
};

fwUi.prototype.onContainerClicked = function (e) {
  e.preventDefault();
  this.plugin.onAdClicked(e);
};

fwUi.prototype.showAdContainer = function () {
  this.adContainerDiv.style.display = "block";
};

fwUi.prototype.hideAdContainer = function () {
  this.adContainerDiv.style.display = "none";
};

fwUi.prototype.reset = function () {
  this.hideAdContainer();
};

fwUi.prototype.onAdError = function () {
  this.hideAdContainer();
};

fwUi.prototype.onAdBreakStart = function () {
  this.showAdContainer();
  this.controlsDiv.style.display = "block";
  this.onAdsPlaying();
  // Start with the ad controls minimized.
  this.hideAdControls();
};

fwUi.prototype.onAdBreakEnd = function () {
  this.hideAdContainer();
  this.controlsDiv.style.display = "none";
  this.countdownDiv.innerHTML = "";
};

fwUi.prototype.onAllAdsCompleted = function () {
  this.hideAdContainer();
};

fwUi.prototype.onLinearAdStart = function () {
  // Don't bump container when controls are shown
  this.removeClass(this.adContainerDiv, "bumpable-fw-ad-container");
};

fwUi.prototype.onNonLinearAdLoad = function () {
  // For non-linear ads that show after a linear ad. For linear ads, we show the
  // ad container in onAdBreakStart to prevent blinking in pods.
  this.adContainerDiv.style.display = "block";
  // Bump container when controls are shown
  this.addClass(this.adContainerDiv, "bumpable-fw-ad-container");
};

fwUi.prototype.onPlayerVolumeChanged = function (volume) {
  this.sliderLevelDiv.style.width = volume * 100 + "%";
};

fwUi.prototype.showAdControls = function () {
  const { disableAdControls } = this.plugin.getOptions();
  if (!disableAdControls) {
    this.addClass(this.controlsDiv, "fw-controls-div-showing");
  }
};

fwUi.prototype.hideAdControls = function () {
  this.removeClass(this.controlsDiv, "fw-controls-div-showing");
};

fwUi.prototype.assignControlAttributes = function (element, controlName) {
  element.id = controlName;
  element.className = controlName;
};

fwUi.prototype.getClassRegexp = function (className) {
  // Matches on
  // (beginning of string OR NOT word char)
  // classname
  // (negative lookahead word char OR end of string)
  return new RegExp("(^|[^A-Za-z-])" + className + "((?![A-Za-z-])|$)", "gi");
};

fwUi.prototype.addClass = function (element, classToAdd) {
  element.className = element.className.trim() + " " + classToAdd;
};

fwUi.prototype.removeClass = function (element, classToRemove) {
  const classRegexp = this.getClassRegexp(classToRemove);
  element.className = element.className.trim().replace(classRegexp, "");
};

export default fwUi;
