/* Special Snowflakes - Highly configurable HTML5 snow generator
* Version 1.0.0 build 20171128.2252
*
* Copyright (c) 2017 Keith Bronstrup
*
*
* */

function SpecialSnowflakesConfig () {
	return {
		'autostart': true, // If this is set to false, you'll have to call the start() method yourself
		'framerate': 15,   // This is a maximum, we will adjust downward if the user's browser can't keep up
		'cpuLimit' : 0.333,// If the render time rises above this threshold, we will reduce the framerate -- this VERY loosely correlates with CPU %
		'gpuAccel' : true, // Use GPU acceleration if available
		'density'  : 0.05, // How much of the screen should be covered in snow
		'sizeMin'  : 0.01, // The size of the smallest snowflake
		'sizeMax'  : 0.015,// The size of the largest snowflake
		'melt'     : 0.025,// What percentage (of the minimum size) should melt each second while falling
		'meltLand' : 0.05, // What percentage (of the minimum size) should melt each second once landed
		'fallMin'  : 0.01, // How far she slowest snowflake should fall each second
		'fallMax'  : 0.05, // How far the fastest snowflake should fall each second
		'ground'   : null, // How far from the bottom of the canvas your snow should "land" - null does not stop, >1 is pixel value, <=1 is percentage
		'swayMin'  : 0.00, // How far left or right an individual snowflake should sway as it falls, minimum (0 = no sway)
		'swayMax'  : 0.025,// How far left or right an individual snowflake should sway as it falls, maximum (0 = no sway)
		'swayZMin' : 5,    // Minimum interval (seconds) for a flake sway cycle
		'swayZMax' : 10,   // Maximum interval (seconds) for a flake sway cycle
		'wind'     : 0.01, // How far left or right snowflakes should sway in unison as they fall
		'windZ'    : 10,   // Interval (seconds) for the wind sway cycle (0 = no wind)
		'r1'       : 253,  // RGB limit values - set the 1/2 values the same if you want all flakes ot be the same color
		'g1'       : 254,  // RGB limit values - set the 1/2 values the same if you want all flakes ot be the same color
		'b1'       : 255,  // RGB limit values - set the 1/2 values the same if you want all flakes ot be the same color
		'r2'       : 189,  // RGB limit values - set the 1/2 values the same if you want all flakes ot be the same color
		'g2'       : 206,  // RGB limit values - set the 1/2 values the same if you want all flakes ot be the same color
		'b2'       : 255,  // RGB limit values - set the 1/2 values the same if you want all flakes ot be the same color
		'glowR'    : 255,  // RED value for the glow effect
		'glowG'    : 255,  // GREEN value for the glow effect
		'glowB'    : 255,  // BLUE value for the glow effect
		'glowMin'  : 0.01, // How wide the "glow" on the least shiny snowflake should be
		'glowMax'  : 0.25, // How wide the "glow" on the most shiny snowflake should be
		'flakes'   : ['&#10052;','&#10053;','&#10054;'], // The set of characters or strings to use as snowflakes
		'canvas'   : null, // HTML ID of the element you wish to snow on - null for HTML body or window
		'container': 'specialSnowflakes' // HTML ID of the element in which to render the snowflakes
	}
};

function SpecialSnowflakes (config) {
	this.config = new SpecialSnowflakesConfig();

	// Import configuration if passed
	setTimeout(function(config) {this.config = this.merge(this.config, config || {});}.bind(this), 0, config);

	this.started    = false;
	this.running    = false;
	this.rendering  = false;
	this.renderWait = false;
	this.spawnWait  = false;

	this.gpu             = null;
	this.renderWaitTimer = null;

	this.flakes    = [];
	this.canvas    = null;
	this.container = null;
	this.frCounter = null;

	this.framerate      = 0;
	this.firstFrameTime = 0;
	this.thisFrameTime  = 0;

	this.currentVolume = 0;
	this.currentWidth  = 0;
	this.currentHeight = 0;
	this.containerTop  = 0;
	this.containerLeft = 0;
	this.sizeMin       = 0;
	this.sizeMax       = 0;
	this.minVol        = 0;
	this.maxVol        = 0;
	this.meltRate      = 0;
	this.meltRateLand  = 0;
	this.maxFlakes     = 0;
	this.spawnTime     = 0;
	this.flakeGlow     = '000000';

	// Autostart, if configured to do so
	setTimeout(function() {if (this.config.autostart) {this.start();}}.bind(this), 0);

	this.start = function () {
		if (this.started) {
			return false;
		}

		this.started   = true;
		this.running   = true;
		this.framerate = this.config.framerate;
		this.flakeGlow = this.config.glowR.toString(16) + this.config.glowG.toString(16) + this.config.glowB.toString(16);

		if (this.firstFrameTime === 0) {
			this.firstFrameTime = new Date().getTime();
		}

		if (this.container === null) {
			this.container = this.getContainer();
		}

		// Detect and set up GPU acceleration
		if (this.config.gpuAccel) {
			var gpu = document.createElement('div');

			if (gpu.style['transform'] != undefined) {
				this.gpu = 'transform';
			} else if (gpu.style['webkitTransform'] != undefined) {
				this.gpu = 'webkitTransform';
			} else if (gpu.style['MozTransform'] != undefined) {
				this.gpu = 'MozTransform';
			} else if (gpu.style['-ms-transform'] != undefined) {
				this.gpu = '-ms-transform';
			} else if (gpu.style['OTransform'] != undefined) {
				this.gpu = 'OTransform';
			} else {
				this.gpu = false;
			}

		}

		this.getDims();

		if (this.canvas !== window) {
			window.addEventListener('resize', this.getDims.bind(this));
		}

		this.canvas.addEventListener('resize', this.getDims.bind(this));
		this.canvas.addEventListener('scroll', this.getPos.bind(this));
		this.canvas.addEventListener('reposition', this.getPos.bind(this));

		this.render();
	};

	// Call with false or no parameter to stop spawning new flakes, with true to also despawn all flakes
	this.stop = function (hard) {
		hard = hard || false;

		this.started = false;

		if (hard) {
			this.running = false;
			this.despawn(-1);
		}
	};

	this.merge = function (a, b) {
		var ab = {};
		for (var attrname in a) { ab[attrname] = a[attrname]; }
		for (var attrname in b) { ab[attrname] = b[attrname]; }
		return ab;
	};

	this.getPos = function () {
		if (this.canvas !== window) {
			if (isNaN(this.canvas.offsetLeft)) {
				this.containerLeft = 0;
			} else {
				this.containerLeft = this.canvas.offsetLeft - this.canvas.scrollLeft + this.canvas.clientLeft;
			}

			if (isNaN(this.canvas.offsetTop)) {
				this.containerTop = 0;
			} else {
				this.containerTop = this.canvas.offsetTop - this.canvas.scrollTop + this.canvas.clientTop;
			}
		}
	},

	this.getContainer = function() {
		var container = document.getElementById(this.config.container);

		if (container === null) {
			container    = document.createElement('div');
			container.id = this.config.container;
			document.body.appendChild(container);
		}

		this.prepareContainer(container);

		return container;
	};

	this.prepareContainer = function(container) {
		container = container || this.container;

		container.style.width = 0;
		container.style.height = 0;
		container.style.position = 'absolute';
		container.style.top = '0';
		container.style.left = '0';

		if (this.gpu) {
			container.style[this.gpu] = 'translate3d(0px, 0px, 0px)';
		}
	};

	this.getDims = function () {
		// Find our canvas, if we haven't already
		if (this.canvas === null) {
			if (this.config.canvas === null
			    || document.getElementById(this.config.canvas) === null) {
				this.canvas = window;
			} else {
				this.canvas = document.getElementById(this.config.canvas);
			}
		}

		// Measure canvas and set sizes accordingly
		this.currentWidth  = this.canvas.hasOwnProperty('innerWidth') ? this.canvas.innerWidth : this.canvas.clientWidth;
		this.currentHeight = this.canvas.hasOwnProperty('innerHeight') ? this.canvas.innerHeight : this.canvas.clientHeight;
		this.currentVolume = this.currentWidth * this.currentHeight;
		this.sizeMin       = this.currentWidth * this.config.sizeMin;
		this.sizeMax       = this.currentWidth * this.config.sizeMax;
		this.meltRate      = this.sizeMin * this.config.melt;
		this.meltRateLand  = this.sizeMin * this.config.meltLand;
		this.minVol    = Math.pow(this.sizeMin / 2.54647 * Math.PI, 2);
		this.maxVol    = Math.pow(this.sizeMax / 2.54647 * Math.PI, 2);

		var avgFallTime = 3.6 / (this.config.fallMin + this.config.fallMax);
		var avgFallMelt = this.config.melt * avgFallTime;

		var avgLife;
		var avgVol;
		if (this.config.ground !== null
		 && avgFallMelt < 1) {
			avgLife = avgFallTime + ((1 - avgFallMelt) / this.config.meltLand);

			var avgFallRatio = Math.min(1, avgFallTime / avgLife);

			avgVol = (this.minVol + this.maxVol) / 2 * ((avgFallMelt * avgFallRatio) + ((1 - avgFallMelt) * (1 - avgFallRatio)));
		} else {
			avgLife = avgFallTime / avgFallMelt;
			avgVol  = (this.minVol + this.maxVol) / 2 * Math.min(1, avgFallMelt);
		}

		this.maxFlakes = Math.round(this.currentVolume * this.config.density / avgVol);
		this.spawnTime = Math.round(1000 * avgLife / this.maxFlakes);

		this.getPos();

		// Reset landed flakes so they can reposition
		for (var flakeid in this.flakes) {
			this.flakes[flakeid].dataset.landed = 'no';
		}
	};

	this.render = function () {
		// Make sure we're running, first
		if (!this.running) {
			return;
		}

		// Grab the current framerate so any alterations can be applied to future frames -- but not the current frame
		// THIS AVOIDS VISUAL ARTIFACTS AND SKIPPING
		var newFramerate = this.framerate;

		// If we're taking too long to render, reduce the framerate
		if (this.renderWait) {
			newFramerate = Math.max(1, (newFramerate * (1 - (1 / this.config.framerate))) - 1);
			clearTimeout(this.renderWaitTimer);
		}

		// If we're actually still rendering a frame, reduce the framerate *further* and drop this frame
		if (this.rendering) {
			newFramerate = Math.max(1, (newFramerate * (1 - (1 / this.config.framerate)) - 1));
			this.framerate = newFramerate;
			setTimeout(this.render.bind(this), 1000 / this.framerate);
			return;
		}

		// Indicate that we've begun rendering this frame
		this.rendering  = true;
		this.renderWait = true;

		// Mark the render start time of this frame
		this.thisFrameTime = new Date().getTime();

		// Set a timer for our next frame
		setTimeout(this.render.bind(this), 1000 / newFramerate);

		// Update our framerate display, is present -- MANUAL FEATURE
		if (this.frCounter !== null) {
			this.frCounter.innerHTML = newFramerate + ' FPS<br>TC: ' + (this.thisFrameTime - this.firstFrameTime);
		}

		// Hide while we do all the heavy lifting, for a MASSIVE speed boost!
		this.container.style.display = 'none';

		// Update wind sway position
		if (this.config.wind) {
			var age = (this.thisFrameTime - this.firstFrameTime) / 1000;
			this.container.style.left = (this.containerLeft + ((Math.sin(2 * Math.PI * (1 / this.config.windZ) * age) * this.config.wind * this.currentWidth))) + 'px';
		} else {
			this.container.style.left = this.containerLeft + 'px';
		}
		this.container.style.top = this.containerTop + 'px';


		// Update flakes
		this.updateFlakes();

		// Attempt to spawn a flake if there's room and we're currently started
		if (this.started) {
			this.addFlake();
		}

		// Re-show now that we're done
		this.container.style.display = 'block';

		// Indicate that we're done rendering this frame
		this.rendering = false;

		// If we've reduced the framerate, test increasing it a bit
		if (newFramerate === this.framerate
		    && newFramerate < this.config.framerate) {
			newFramerate = Math.min(this.config.framerate, newFramerate + 1);
		}

		/* Wait for a duration before falsifying renderWait
		This is to ensure that we aren't pegging the user's CPU
		To disable this safeguard, set config.cpuLimit to 1
		*/
		this.renderWaitTimer = setTimeout(function() {this.renderWait = false;}.bind(this), 1000 / this.framerate * Math.max(0, 1 - this.config.cpuLimit));

		// Update our framerate on the scoreboard -- AFTER we've processed existing flakes based on current framerate
		this.framerate = newFramerate;
	};

	this.updateFlakes = function () {
		var despawn = [];

		for (var flakeid in this.flakes) {
			flake = this.flakes[flakeid];

			var flakeSize     = 0;
			var ground        = this.config.ground;
			var flakeAge      = (this.thisFrameTime - flake.dataset.frame) / 1000;
			var containerLeft = parseFloat(this.container.style.left);

			if (ground !== null
			 && Math.abs(ground) <= 1) {
				ground = this.currentHeight * ground;
			}

			if (flake.dataset.landed === 'no') {
				flakeSize = Math.max(0, (flake.dataset.size * this.currentWidth) - (this.meltRate * flakeAge));
			} else {
				var landedAge = (this.thisFrameTime - flake.dataset.landedtime) / 1000;
				flakeSize = Math.max(0, (flake.dataset.landedsize * this.currentWidth) - (this.meltRateLand * landedAge));
			}

			// Despawn if we've become invisible
			if (!flakeSize) {
				despawn.push(flakeid);
				continue;
			}

			// Don't process height or sway for landed flakes
			if (flake.dataset.landed !== 'no') {
				flake.style.left = (flake.dataset.landed - containerLeft) + 'px';
				flake.style.fontSize = flakeSize + 'px';
				continue;
			}

			// Set flake height
			var flakeBottom = (((flakeAge * flake.dataset.fall) - flake.dataset.y) * this.currentHeight);

			if (ground === null
			 || flakeBottom < this.currentHeight - ground - (flakeSize / 2)) {
				// Despawn if we've gone off screen
				if (flakeBottom > this.currentHeight) {
					// We might still be visible if the browser takes its good ol' time destroying the element
					flake.style.display = 'none';
					despawn.push(flakeid);
					continue;
				}

				flake.style.bottom = -flakeBottom + 'px';
			} else {
				// Land a random factor of 1/2 of our landed height from ground to give the illusion of depth
				flake.style.bottom = (-this.currentHeight + ground + (flakeSize * Math.random() / 2)) + 'px';

				flake.dataset.landed     = parseFloat(flake.style.left) + containerLeft;
				flake.dataset.landedsize = flakeSize / this.currentWidth;
				flake.dataset.landedtime = this.thisFrameTime;
			}

			// Set flake sway position
			if (flake.dataset.sway) {
				flake.style.left = Math.max(this.containerLeft - containerLeft, Math.min(this.containerLeft + this.currentWidth - flakeSize - containerLeft,(flake.dataset.x * this.currentWidth) + (Math.sin(2 * Math.PI * (1 / flake.dataset.swayz) * flakeAge) * flake.dataset.sway * this.currentWidth))) + 'px';
			}

			// Set flake size -- "grow" flake in if we're still at the top
			flake.style.fontSize = Math.max(0, Math.min(flakeSize, flakeBottom / 0.7854)) + 'px';

			// Ensure flake is visible
			if (flake.style.display === 'none') {
				flake.style.display = 'block';
			}
		}

		for (var despawnid in despawn) {
			this.despawn(despawn[despawnid]);
		}
	};

	this.addFlake = function () {
		if (this.spawnWait
		 || this.flakes.length >= this.maxFlakes) {
			return;
		}

		this.spawnWait = true;
		setTimeout(function() {this.spawnWait = false;}.bind(this), this.spawnTime);

		// Calculate the initial state of this flake
		var flakePos     = Math.random();
		if (this.config.glowMax) {
			var flakeGlow    = Math.random() * (this.config.glowMax - this.config.glowMin) + this.config.glowMin;
		}
		var flakeFall    = Math.random() * (this.config.fallMax - this.config.fallMin) + this.config.fallMin;
		var flakeSway    = Math.random() * (this.config.swayMax - this.config.swayMin) + this.config.swayMin;
		var flakeSwayZ   = Math.random() * (this.config.swayZMax - this.config.swayZMin) + this.config.swayZMin;
		var flakeSize    = Math.random() * (this.sizeMax - this.sizeMin) + this.sizeMin;
		var flakeSizePct = flakeSize / this.currentWidth;

		var flakeColorFade = Math.random();
		var flakeR         = (Math.round(Math.min(this.config.r1, this.config.r2) + ((Math.max(this.config.r1, this.config.r2) - Math.min(this.config.r1, this.config.r2)) * flakeColorFade))).toString(16);
		var flakeG         = (Math.round(Math.min(this.config.g1, this.config.g2) + ((Math.max(this.config.g1, this.config.g2) - Math.min(this.config.g1, this.config.g2)) * flakeColorFade))).toString(16);
		var flakeB         = (Math.round(Math.min(this.config.b1, this.config.b2) + ((Math.max(this.config.b1, this.config.b2) - Math.min(this.config.b1, this.config.b2)) * flakeColorFade))).toString(16);

		// Create the flake
		var flake = document.createElement('div');

		flake.innerHTML = this.config.flakes[Math.round(Math.random() * (this.config.flakes.length - 1))];

		// Don't display on spawn, we need to position first
		flake.style.display    = 'none';

		flake.style.position   = 'absolute';
		flake.style.fontSize   = 0;
		// Shouldn't left and bottom be set here? Nah, we're just gonna re-set them in the next frame before we display, anyway.
		flake.style.color      = '#' + flakeR + flakeG + flakeB;
		flake.style.lineHeight = '0.7854';

		if (this.config.glowMax) {
			flake.style.textShadow = '0 0 ' + flakeGlow + 'em' + '#' + this.flakeGlow;
		}

		if (this.gpu) {
			// GPU-accelerated snow.
			flake.style[this.gpu] = 'translate3d(0px, 0px, 0px)';
		}

		flake.dataset.x      = flakePos;
		flake.dataset.y      = 0;
		flake.dataset.fall   = flakeFall;
		flake.dataset.sway   = flakeSway;
		flake.dataset.swayz  = flakeSwayZ;
		flake.dataset.size   = flakeSizePct;
		flake.dataset.frame  = this.thisFrameTime;
		flake.dataset.landed = 'no';

		this.flakes.push(flake);
		this.container.appendChild(flake);
	};

	this.despawn = function (flake) {
		if (flake === -1) {
			//this.container.innerHTML = '';
			//this.flakes = [];
		} else if (this.flakes.length >= flake + 1) {
			this.container.removeChild(this.flakes[flake]);
			this.flakes.splice(flake, 1);
		}

		if (!this.flakes.length) {
			if (this.canvas !== window) {
				window.removeEventListener('resize', this.getDims.bind(this));
			}

			canvas.removeEventListener('resize', this.getDims.bind(this));
			canvas.removeEventListener('scroll', this.getDims.getPos(this));
			canvas.removeEventListener('reposition', this.getPos.bind(this));
		}
	};
};
