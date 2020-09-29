//-------------------------------------------------------------------------------------------------
//
//      Tidal Simulation Applet for Javascript
//
//      (C) Ingo Berg 2020
//      https://beltoforion.de/en/tides
//
//      This program is free software: you can redistribute it and/or modify
//      it under the terms of the GNU General Public License as published by
//      the Free Software Foundation, either version 3 of the License, or
//      (at your option) any later version.
//
//      This program is distributed in the hope that it will be useful,
//      but WITHOUT ANY WARRANTY; without even the implied warranty of
//      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//      GNU General Public License for more details.
//
//      You should have received a copy of the GNU General Public License
//      along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//      Version 1.1:
//              - added a way to use vector directions that match the model sizes absolute values 
//                are rubbish then but they are scaled to appear similar to the physically correct 
//                model
//      Version 1.2:
//              - Bugfix: It wasn't possible to show the tidal acceleration of sun alone
//              - Added capabilitie to display static states (for neap tide and spring tide visualization)
//      Version 2.0 (2016-09-27):
//              - Code converted to TypeScript
//
//-------------------------------------------------------------------------------------------------
/// <reference path="../shared/vec2d.ts"/>
/// <reference path="../shared/context2d.ts"/>
var TidalSimulation = /** @class */ (function () {
    function TidalSimulation(cfg) {
        // image buffer
        this.dragDropImage = new Image();
        this.continentsImage = new Image();
        this.moonImage = new Image();
        this.bckgImage = new Image();
        this.config = cfg;
        // The primary drawing canvas
        this.canvas = document.getElementById(cfg.cvid);
        this.ctx = Context2d.Create(this.canvas);
        this.w = this.canvas.width;
        this.h = this.canvas.height;
        // World scaling and rendering
        this.lookAt = new Vec2d(0, 0); // Rendering engine is looking at this position
        this.numArrows = 30;
        // Time keeping
        this.time = 0; // global time in seconds
        // Constants and buffer variables
        this.gamma = 6.67408e-11; // gravitation constant in m³/(kg*s²)
        this.distMoonEarth = 384400000; // distance moon to earth in meter
        this.distEarthSun = 149597870700; // distance sun to earth 
        // Some vectors of common use
        this.vecEarthSun = new Vec2d(0, 0); // Vector pointing from the earth towards the sun
        this.vecEarthMoon = new Vec2d(0, 0); // Vector pointing from the earth towards the moon
        this.vecCenterOfMass = new Vec2d(0, 0);
        if (cfg.setup == 0) {
            // A setup for illustrating moons gravitational effect on earth
            this.forceMultiplier = 1500;
            this.accMultiplier = 1200;
            this.ts = 2; // timestep size in seconds
            this.scaleSize = 0.00002; // scale for sizes	
            this.scaleDist = this.scaleSize; // scale for dimensions
            this.earth = {
                pos: new Vec2d(-9000000, 0),
                m: 5.9721986e24,
                r: 12735 / 2.0 * 1000,
                p: 365.256 * 86400,
                tidalForce: [this.numArrows + 1],
                tidalForceSun: [this.numArrows + 1] // Tidal force arrows of the moon
            };
            this.moon = {
                pos: new Vec2d(7000000, 0),
                m: 7.349e22,
                r: 3476 / 2.0 * 1000,
                p: 27.322 * 86400 // siderial in seconds
            };
            // connect mouse events
            this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this), false);
            this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this), false);
            this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this), false);
            this.canvas.world = this;
        }
        else if (cfg.setup == 1) {
            this.setScaleForceToModel(cfg.scaleForceToModel);
            this.ts = cfg.timestep; // timestep size in seconds timesteps for the blinking 
            this.scaleDist = 0.00000065; // scale for dimensions
            this.scaleSize = 0.000011; // scale for sizes	
            this.scaleContext = this.scaleSize;
            this.earth = {
                pos: new Vec2d(0, 0),
                m: 5.9721986e24,
                r: 12735 / 2.0 * 1000,
                p: 365.256 * 86400,
                tidalForce: [this.numArrows + 1],
                tidalForceSun: [this.numArrows + 1] // Tidal force arrows of the moon
            };
            this.moon = {
                pos: new Vec2d(0, 0),
                m: 7.349e22,
                r: 3476 / 2.0 * 1000,
                p: 27.322 * 86400,
            };
            // Distance of the center of mass from the earth center (4672.68 km)
            this.distCenterOfMass = this.distMoonEarth * this.moon.m / (this.moon.m + this.earth.m);
        }
        // Celestial Bodies
        this.sun = {
            pos: new Vec2d(0, 0),
            m: 1.98855e30,
            r: 696342000 // sun radius in meter
        };
        // Color and style definitions
        this.style = {
            colBack: '#112255',
            // Earth
            colEarth: 'rgb(30,130,220)',
            colEarthDark: 'rgba(0, 0, 0, 0.7)',
            colEarthOutline: 'darkGrey',
            // Moon
            colMoon: 'white',
            colMoonDark: 'rgba(0, 0, 0, 0.7)',
            colMoonOutline: 'rgba(0, 0, 0, 0)',
            // 
            colVec1: 'rgba(255, 255, 255, 0.4)',
            colVec2: 'rgba(255, 128, 128, 0.4)',
            colVec3: '#ffffff',
            colVec4: 'rgba(255, 165, 0, 0.8)',
            colWater: 'rgba(30, 130, 220, 0.6)',
            colOrbit: 'rgba(255, 165, 0, 0.5)',
            colOrigin: 'yellow',
            colCenterOfEarth: 'rgba(255, 165, 0,   1)',
            colSun: 'rgba(255, 235, 50, 0.5)'
        };
        // Load images
        this.dragDropImage.src = this.config.path + "/images/dragdrop.png";
        this.continentsImage.src = this.config.path + "/images/continents.png";
        this.moonImage.src = this.config.path + "/images/moon.png";
        this.bckgImage.src = this.config.path + "/images/milkyway.jpg";
        this.init(cfg);
    }
    TidalSimulation.prototype.init = function (config) {
        if (config.isRunning) {
            window.setInterval(this.tick.bind(this), 30);
        }
        else {
            this.tick();
        }
    };
    TidalSimulation.prototype.tick = function () {
        this.update();
        this.render();
    };
    //-------------------------------------------------------------------------------------------------
    //
    // Mouse Handling
    //
    //-------------------------------------------------------------------------------------------------
    TidalSimulation.prototype.getMousePos = function (evt) {
        var rect = this.canvas.getBoundingClientRect();
        return { x: evt.clientX - rect.left,
            y: evt.clientY - rect.top };
    };
    TidalSimulation.prototype.onMouseDown = function (evt) {
        if (this.config.setup != 0) {
            return;
        }
        var mousePos = this.getMousePos(evt);
        var clickPos = new Vec2d(0, 0);
        clickPos.x = mousePos.x - (this.lookAt.x * this.scaleDist) - this.w / 2;
        clickPos.y = mousePos.y - (this.lookAt.y * this.scaleDist) - this.h / 2;
        clickPos.divideValue(this.scaleDist);
        var dist = Vec2d.subtractEx(this.moon.pos, clickPos).length();
        this.dragMoon = dist < this.moon.r;
    };
    TidalSimulation.prototype.onMouseUp = function (evt) {
        if (this.config.setup != 0) {
            return;
        }
        this.dragMoon = false;
    };
    TidalSimulation.prototype.onMouseMove = function (evt) {
        if (this.config.setup != 0) {
            return;
        }
        var mousePos = this.getMousePos(evt);
        if (this.dragMoon == null || !this.dragMoon) {
            return;
        }
        var x = mousePos.x - (this.lookAt.x * this.scaleDist) - this.w / 2;
        var y = mousePos.y - (this.lookAt.y * this.scaleDist) - this.h / 2;
        x /= this.scaleDist;
        y /= this.scaleDist;
        var newMoonPos = new Vec2d(x, y);
        var vecEarthMoon = Vec2d.subtractEx(newMoonPos, this.earth.pos);
        var dist = Vec2d.subtractEx(this.earth.pos, newMoonPos).length();
        if (dist > this.earth.r * 2) {
            this.moon.pos = new Vec2d(x, y);
        }
        else {
            this.moon.pos = this.earth.pos.clone();
            this.moon.pos.add(vecEarthMoon.normalize().multiplyValue(this.earth.r * 2));
        }
    };
    TidalSimulation.prototype.setScaleForceToModel = function (stat) {
        this.config.scaleForceToModel = stat;
        if (stat) {
            this.accMultiplier = 1700000;
            this.forceMultiplier = this.accMultiplier;
        }
        else {
            this.accMultiplier = 1700000;
            this.forceMultiplier = this.accMultiplier * 10;
        }
    };
    //-------------------------------------------------------------------------------------------------
    //
    // Helper Functions
    //
    //-------------------------------------------------------------------------------------------------
    /**
    * Based on: http://stackoverflow.com/questions/21961839/simulation-background-size-cover-in-canvas
    * by By Ken Fyrstenberg
    */
    TidalSimulation.prototype.addBackground = function () {
        var img = this.bckgImage;
        var ctx = this.ctx;
        var x = 0;
        var y = 0;
        var w = ctx.canvas.width;
        var h = ctx.canvas.height;
        var offsetX = 0.5;
        var offsetY = 0.5;
        if (offsetX < 0)
            offsetX = 0;
        if (offsetY < 0)
            offsetY = 0;
        if (offsetX > 1)
            offsetX = 1;
        if (offsetY > 1)
            offsetY = 1;
        var iw = img.width;
        var ih = img.height;
        var r = Math.min(w / iw, h / ih);
        var nw = iw * r; // new prop. width
        var nh = ih * r; // new prop. height
        var cx;
        var cy;
        var cw;
        var ch;
        var ar = 1;
        // decide which gap to fill    
        if (nw < w)
            ar = w / nw;
        if (nh < h)
            ar = h / nh;
        nw *= ar;
        nh *= ar;
        // calc source rectangle
        cw = iw / (nw / w);
        ch = ih / (nh / h);
        cx = (iw - cw) * offsetX;
        cy = (ih - ch) * offsetY;
        // make sure source rectangle is valid
        if (cx < 0)
            cx = 0;
        if (cy < 0)
            cy = 0;
        if (cw > iw)
            cw = iw;
        if (ch > ih)
            ch = ih;
        ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
    };
    TidalSimulation.prototype.resizeToCanvas = function () {
        this.w = this.canvas.width;
        this.h = this.canvas.height;
    };
    TidalSimulation.prototype.mapToScreen = function (v, scale) {
        var vecScreen = v.clone();
        vecScreen.subtract(this.lookAt);
        // If no scale is provided take default distance scale, otherwise take custom value
        if (scale == null) {
            scale = this.scaleDist;
        }
        vecScreen.multiplyValue(scale);
        vecScreen.addXY(this.w / 2, this.h / 2);
        return vecScreen;
    };
    //-------------------------------------------------------------------------------------------------
    //
    // Moving Earth and Moon
    //
    //-------------------------------------------------------------------------------------------------
    // Set angular Position of Sun, Earth and Moon
    TidalSimulation.prototype.setPositions = function (angleSun, angleMoon) {
        // Earth position is relative to the center of mass
        this.earth.pos.x = -Math.sin(angleMoon) * this.distCenterOfMass;
        this.earth.pos.y = -Math.cos(angleMoon) * this.distCenterOfMass;
        // Moon position relative to the center of mass
        this.moon.pos.x = Math.sin(angleMoon) * (this.distMoonEarth - this.distCenterOfMass);
        this.moon.pos.y = Math.cos(angleMoon) * (this.distMoonEarth - this.distCenterOfMass);
        // Sun motion, shown by beams of light
        this.sun.pos.x = this.earth.pos.x + Math.sin(angleSun) * this.distEarthSun;
        this.sun.pos.y = this.earth.pos.y + Math.cos(angleSun) * this.distEarthSun;
    };
    TidalSimulation.prototype.move = function () {
        if (this.config.autoMove) {
            var angleMoon = this.time * 2 * Math.PI / this.moon.p;
            var angleSun = this.time * 2 * Math.PI / this.earth.p;
            this.setPositions(angleSun, angleMoon);
            this.time += this.ts;
        }
        // update the position vectors
        this.vecEarthMoon = Vec2d.subtractEx(this.moon.pos, this.earth.pos);
        this.vecEarthSun = Vec2d.subtractEx(this.sun.pos, this.earth.pos);
        // compute center of mass
        var v1 = this.earth.pos.clone().multiplyValue(this.earth.m);
        var v2 = this.moon.pos.clone().multiplyValue(this.moon.m);
        this.vecCenterOfMass = Vec2d.addEx(v1, v2).divideValue(this.earth.m + this.moon.m);
        switch (this.config.lookAtTarget) {
            case 'Earth':
                this.lookAt = this.earth.pos.clone();
                break;
            case 'CenterOfMass':
            default:
                this.lookAt = new Vec2d(0, 0);
        }
    };
    //-------------------------------------------------------------------------------------------------
    //
    // Updating the forcefield indicators
    //
    //-------------------------------------------------------------------------------------------------
    TidalSimulation.prototype.update = function () {
        this.move();
        var delta = 2 * Math.PI / this.numArrows;
        if (this.config.scaleForceToModel == null || !this.config.scaleForceToModel) {
            // Disable all the unphysical fancy stuff that is in here to make the
            // vectors point to the moon in the model display
            var scaleSize = 1;
            var scaleDist = 1;
            var scaleCompensation = 1;
            var zerolength = 0;
        }
        else {
            // Produce results that look real but maintain the proper vector directions
            // of the model with the enlarged planets. Bend the laws of physics to make 
            // it look right...
            var scaleSize = this.scaleSize;
            var scaleDist = this.scaleDist;
            // scale compensation is used to bumb up the botched model scale to create comparable 
            // results to the real world data. 
            var scaleCompensation = scaleDist * scaleDist;
            var zerolength = 60; // an arbitrary factor to make the overall vector lengths not suck...
        }
        // Compute the acceleration at the earth center and store it as the first entry
        var accEarthMoon = this.vecEarthMoon.clone();
        accEarthMoon.normalize();
        accEarthMoon.multiplyValue(this.gamma * this.moon.m / Math.pow(zerolength + this.vecEarthMoon.length() * scaleDist, 2));
        this.earth.tidalForce[0] = accEarthMoon.multiplyValue(scaleCompensation);
        var accEarthSun = this.vecEarthSun.clone();
        accEarthSun.normalize();
        accEarthSun.multiplyValue(this.gamma * this.sun.m / Math.pow(zerolength + this.vecEarthSun.length() * scaleDist, 2));
        this.earth.tidalForceSun[0] = accEarthSun.multiplyValue(scaleCompensation);
        // Compute accelerations for the earths surface
        for (var i = 1; i < this.numArrows + 1; ++i) {
            var posSurface = new Vec2d(Math.sin(i * delta) * this.earth.r * scaleSize, Math.cos(i * delta) * this.earth.r * scaleSize);
            //
            // Tidal effect of the moon
            //
            var posMoon = this.vecEarthMoon.clone();
            posMoon.multiplyValue(scaleDist);
            // Create a normalized vector pointing from the earth surface to the moon center and compute 
            // the gavitation force
            var accMoon = Vec2d.subtractEx(posMoon, posSurface);
            accMoon.normalize();
            var len = Vec2d.subtractEx(posMoon, posSurface).length() + zerolength;
            accMoon.multiplyValue(this.gamma * this.moon.m / (len * len));
            // The resulting Gravitational force
            this.earth.tidalForce[i] = accMoon.multiplyValue(scaleCompensation);
            //
            // Tidal effect of the sun
            //
            var posSun = this.vecEarthSun.clone();
            posSun.multiplyValue(scaleDist);
            // Create a normalized vector pointing from the earth surface to the moon center and compute 
            // the gavitation force
            var accSun = Vec2d.subtractEx(posSun, posSurface);
            accSun.normalize();
            len = Vec2d.subtractEx(posSun, posSurface).length() + zerolength;
            accSun.multiplyValue(this.gamma * this.sun.m / (len * len));
            // The resulting Gravitational force
            this.earth.tidalForceSun[i] = accSun.multiplyValue(scaleCompensation);
        }
    };
    //-------------------------------------------------------------------------------------------------
    //
    // Render Functions
    //
    //-------------------------------------------------------------------------------------------------
    TidalSimulation.prototype.renderSun = function () {
        // center of the screen in pixel
        var cm = this.mapToScreen(this.lookAt);
        // Draw an arrow pointing from the sun towards earth
        var posSunScreen = this.mapToScreen(this.sun.pos, this.scaleDist);
        var posEarthScreen = this.mapToScreen(this.earth.pos, this.scaleDist);
        var vecBeam = posSunScreen.clone().subtract(cm).normalize();
        var vecBeamOrtho = new Vec2d(vecBeam.y, -vecBeam.x).multiplyValue(this.earth.r * this.scaleSize);
        var offset = vecBeam.multiplyValue(this.earth.r * this.scaleSize * -1);
        // render 5 lightbeams as an indication of where the sun is
        for (var i = 0; i < 10; ++i) {
            this.ctx.drawArrow(posSunScreen.x, posSunScreen.y, cm.x + i * vecBeamOrtho.x - offset.x, cm.y + i * vecBeamOrtho.y - offset.y, 10, 2, this.style.colSun);
            if (i > 0) {
                this.ctx.drawArrow(posSunScreen.x, posSunScreen.y, cm.x - i * vecBeamOrtho.x - offset.x, cm.y - i * vecBeamOrtho.y - offset.y, 10, 2, this.style.colSun);
            }
        }
    };
    TidalSimulation.prototype.renderMoon = function () {
        // compute the render position of the moon
        var posMoon = this.moon.pos.clone();
        posMoon = this.mapToScreen(posMoon, this.scaleDist);
        var r = this.moon.r * this.scaleSize;
        if (this.config.setup == 0 && this.vecEarthMoon.length() > 100000000) {
            var posEarth = this.mapToScreen(this.earth.pos.clone(), this.scaleDist);
            // If moon is far away just render an arrow pointing towards it
            var buf = this.vecEarthMoon.normalize().multiplyValue(100);
            this.ctx.drawVector(posEarth.x + 3 * buf.x, posEarth.y + 3 * buf.y, buf.x, buf.y, 30, 2, this.style.colMoon);
            this.ctx.font = "20px Arial";
            this.ctx.fillStyle = 'White';
            this.ctx.fillText("Moon (385000 km)", posEarth.x + 3 * buf.x - 40, posEarth.y + 3 * buf.y + 40);
        }
        else {
            // bright side
            var colOutline = this.style.colMoonOutline;
            var thickness = 2;
            if (this.config.setup != 1) {
                var v = Math.round(128 + 128 * Math.sin(this.time * 0.15));
                colOutline = 'rgb(' + v + ',' + v + ',' + v + ')';
                thickness = 4;
            }
            this.ctx.drawCircle(posMoon, r, 0, 2 * Math.PI, this.style.colMoon, colOutline, thickness);
            if (this.config.enableRotation) {
                this.ctx.save();
                this.ctx.translate(posMoon.x, posMoon.y);
                this.ctx.rotate(-this.time * Math.PI * 2 / this.moon.p + Math.PI);
                this.ctx.drawImage(this.moonImage, -r, -r, 2 * r, 2 * r);
                this.ctx.restore();
            }
            else {
                this.ctx.drawImage(this.moonImage, posMoon.x - r, posMoon.y - r, 2 * r, 2 * r);
            }
            // dark side
            if (this.config.showSun) {
                var a1 = this.vecEarthSun.verticalAngle();
                var a2 = a1 + Math.PI;
                this.ctx.drawCircle(posMoon, r, a1, a2, this.style.colMoonDark, this.style.colMoonOutline);
            }
            if (this.config.setup == 0) {
                this.ctx.drawImage(this.dragDropImage, posMoon.x - r, posMoon.y - r, 2 * r, 2 * r);
            }
            var offset = this.moon.r * this.scaleSize;
            this.ctx.font = "20px Arial";
            this.ctx.fillStyle = 'White';
            this.ctx.fillText("Moon", posMoon.x - 24, posMoon.y + offset + 25);
        }
    };
    TidalSimulation.prototype.renderEarth = function () {
        var f = this.accMultiplier;
        var f2 = this.forceMultiplier;
        // visual position of the earth for illustrating center of mass as where it really is inside earth
        // Technically our model is geocentric, yeah you heard that right... (my apologies Galileo) 
        // It doesn't matter, i'm just interested invisualizing the proper period of moon and sun. No harm done
        // by using this simplification. However i'm interested in displaying the correct center of mass 
        // in our fucked up coordinates that scale sizes and distances differently. So here is the correct
        // visual on screen position of the an earth that is scaled differently in size than in distance:
        var posEarthScreen = this.mapToScreen(this.earth.pos, this.scaleSize);
        var r = this.earth.r * this.scaleSize;
        // Daysite
        this.ctx.drawCircle(posEarthScreen, r, 0, 2 * Math.PI, this.style.colEarth, this.style.colEarthOutline);
        // continents
        if (this.config.enableRotation) {
            this.ctx.save();
            this.ctx.translate(posEarthScreen.x, posEarthScreen.y);
            this.ctx.rotate(-this.time * Math.PI * 2 / 86400);
            this.ctx.drawImage(this.continentsImage, -r, -r, 2 * r, 2 * r);
            this.ctx.restore();
        }
        else {
            this.ctx.drawImage(this.continentsImage, posEarthScreen.x - r, posEarthScreen.y - r, 2 * r, 2 * r);
        }
        // Nightside
        if (this.config.showSun) {
            var a1 = this.vecEarthSun.verticalAngle();
            var a2 = a1 + Math.PI;
            this.ctx.drawCircle(posEarthScreen, r, a1, a2, this.style.colEarthDark, this.style.colEarthOutline);
        }
        var tf = this.earth.tidalForce[0].clone();
        var tfs = this.earth.tidalForceSun[0].clone();
        if (this.config.showGravAcc ||
            this.config.showCentAcc ||
            this.config.showTidalAcc ||
            this.config.showTidalAccSun ||
            this.config.showAccSum) {
            var results = [this.numArrows + 1];
            // Draw Vector arrows
            var delta = 2 * Math.PI / this.numArrows;
            for (var i = 1; i < this.numArrows + 1; ++i) {
                // Earth position in world coordinates
                var posScreen = Vec2d.addEx(posEarthScreen, new Vec2d(Math.sin(i * delta) * this.earth.r * this.scaleSize, Math.cos(i * delta) * this.earth.r * this.scaleSize));
                //
                // Tidal force Moon
                //
                var tfi = this.earth.tidalForce[i];
                if (this.config.showGravAcc) {
                    this.ctx.drawVector(posScreen.x, posScreen.y, tfi.x * f, tfi.y * f, 5, 2, this.style.colVec1);
                }
                if (this.config.showCentAcc) {
                    this.ctx.drawVector(posScreen.x, posScreen.y, -tf.x * f, -tf.y * f, 5, 2, this.style.colVec2);
                }
                var v3 = Vec2d.subtractEx(tfi, tf);
                if (this.config.showTidalAcc) {
                    this.ctx.drawVector(posScreen.x, posScreen.y, v3.x * f2, v3.y * f2, 4, 3, this.style.colVec3);
                }
                //
                // Tidal force Sun
                //
                var v6 = Vec2d.subtractEx(this.earth.tidalForceSun[i], tfs);
                if (this.config.showTidalAccSun) {
                    this.ctx.drawVector(posScreen.x, posScreen.y, v6.x * f2, v6.y * f2, 4, 3, this.style.colVec4);
                }
                //
                // Combination of Sun and Moon forces
                //
                results[i] = { x: posScreen.x + f2 * (v3.x + v6.x),
                    y: posScreen.y + f2 * (v3.y + v6.y) };
            }
            if (this.config.showAccSum) {
                this.ctx.fillStyle = this.style.colWater;
                this.ctx.beginPath();
                this.ctx.moveTo(results[0].x, results[0].y);
                for (var i = 1; i < this.numArrows + 1; ++i) {
                    this.ctx.lineTo(results[i].x, results[i].y);
                }
                this.ctx.closePath();
                this.ctx.fill();
            }
            // Draw vectors at the earths center
            if (this.config.showGravAcc) {
                this.ctx.drawVector(posEarthScreen.x, posEarthScreen.y, tf.x * f, tf.y * f, 5, 4, this.style.colVec1);
            }
        }
        if (this.config.showCentAcc) {
            this.ctx.drawVector(posEarthScreen.x, posEarthScreen.y, -tf.x * f, -tf.y * f, 5, 4, this.style.colVec2);
        }
        // Draw Center of the earth and its acceleration vector
        this.ctx.drawCross(posEarthScreen.x, posEarthScreen.y, 2, 5, this.style.colCenterOfEarth);
    }; // function renderEarth
    TidalSimulation.prototype.renderSurfacePoints = function () {
        var f = this.accMultiplier;
        var cm = this.mapToScreen(this.vecCenterOfMass, this.scaleSize);
        // Earth Position on screen
        var posEarthScreen = this.mapToScreen(this.earth.pos, this.scaleSize);
        var orig = new Vec2d(0, this.earth.r * this.scaleSize);
        var len = this.earth.tidalForce[0].clone().length() * f;
        // Orbits of a number of reference points at the earths surface
        var v;
        for (var angle = 0; angle < 360; angle += 120) {
            var ref = orig.rotateEx(angle); // Vector from the earth center to a point at the surface
            var point = Vec2d.addEx(posEarthScreen, ref); // Point on the earth surface
            var refScreen = Vec2d.addEx(cm, ref.clone());
            this.ctx.drawCircle(refScreen, this.distCenterOfMass * this.scaleSize, 0, 2 * Math.PI, null, this.style.colVec1);
            this.ctx.drawCircle(point, 3, 0, 2 * Math.PI, this.style.colVec1, this.style.colVec1);
            // draw centrifugal force vectors
            v = Vec2d.subtractEx(point, refScreen);
            v.normalize();
            v.multiplyValue(len);
            this.ctx.drawVector(point.x, point.y, v.x, v.y, 5, 2, this.style.colVec1, this.style.colVec1);
        }
        // Render an arrow at the earths center
        var ce = this.mapToScreen(this.earth.pos, this.scaleSize);
        this.ctx.drawVector(ce.x, ce.y, v.x, v.y, 5, 2, this.style.colOrbit, 'white');
    };
    TidalSimulation.prototype.renderOverlays = function () {
        // Draw Center of Mass of the system Earth-Moon
        // Use scaling to size since the center of mass shall be drawn at the correct size relative to earth
        var cm = this.mapToScreen(this.vecCenterOfMass, this.scaleSize);
        this.ctx.drawCenterOfMass(cm, 4);
        // Render Reference Frame Origin
        if (this.config.showSurfacePoints) {
            this.renderSurfacePoints();
        }
    };
    TidalSimulation.prototype.renderUnderlay = function () {
        if (this.config.showEarthOrbit || this.config.showMoonOrbit) {
            // Earth Orbit
            if (this.config.showEarthOrbit) {
                // Draw Center of Mass of the system Earth-Moon, use size scaling factor
                var cm = this.mapToScreen(this.vecCenterOfMass, this.scaleSize);
                this.ctx.drawCircle(cm, this.distCenterOfMass * this.scaleSize, 0, 2 * Math.PI, null, this.style.colOrbit);
            }
            // Moon Orbit
            if (this.config.showMoonOrbit) {
                // Draw Center of Mass of the system Earth-Moon, use distance scaling factor
                var cm = this.mapToScreen(this.vecCenterOfMass, this.scaleDist);
                this.ctx.drawCircle(cm, (this.distMoonEarth - this.distCenterOfMass) * this.scaleDist, 0, 2 * Math.PI, null, this.style.colOrbit);
            }
        }
    };
    TidalSimulation.prototype.render = function () {
        if (this.config.showBackgroundImage) {
            this.addBackground();
        }
        else {
            this.ctx.fillStyle = this.style.colBack;
            this.ctx.fillRect(0, 0, this.w, this.h);
        }
        if (this.config.showSun) {
            this.renderSun();
        }
        this.renderUnderlay();
        this.renderEarth();
        if (this.config.showMoon) {
            this.renderMoon();
        }
        this.renderOverlays();
    };
    return TidalSimulation;
}()); // class TidalSimulation
//# sourceMappingURL=tides.js.map