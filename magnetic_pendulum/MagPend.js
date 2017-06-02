//-------------------------------------------------------------------------------------------------
//
//      Simulating Tidal Locking of Planets
//
//      (C) Ingo Berg 2017
//      http://articles.beltoforion.de/article.php?a=tides_explained
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
//-------------------------------------------------------------------------------------------------
/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
/// <reference path="../shared/box2d.ts"/>
/// <reference path="./IntegratorRK4.ts"/>
var MagPend = (function () {
    function MagPend(cfg) {
        var _this = this;
        this.xx = 0;
        this.yy = 0;
        this.doScan = true;
        this.refLength = 0;
        this.game = new Phaser.Game(cfg.width, cfg.height, Phaser.AUTO, cfg.cvid, {
            preload: function () { return _this.preload(); },
            create: function () { return _this.create(); },
            update: function () { return _this.update(); },
            render: function () { return _this.render(); }
        }, false, // transparency
        false); // antialiasing
        var model = new ModelMagPend(this.game);
        this.model = model;
        //        this.engine = new IntegratorRK4(this.model);
        this.engine = new IntegratorRK5(this.model);
    }
    MagPend.rgb2hex = function (red, green, blue) {
        var rgb = blue | (green << 8) | (red << 16);
        return rgb;
    };
    MagPend.prototype.trace = function (state, drawTrace) {
        var vx = state[0];
        var vy = state[1];
        var x = state[2];
        var y = state[3];
        if (drawTrace) {
            this.game.debug.text("Start Point: x=" + x.toPrecision(3) + "; y=" + y.toPrecision(3), 20, 20);
        }
        // set start conditions
        this.engine.setInitialState(state);
        this.model.restIdx = -1;
        // Compute new trace
        var isRunning = true;
        if (drawTrace) {
            this.gfx.clear();
            this.gfx.lineStyle(6, ModelMagPend.rgb2hex(255, 255, 0), 4);
        }
        var length = 0;
        for (var ct = 0; isRunning; ++ct) {
            state = this.engine.singleStep();
            var dx = state[0] * this.engine.getStepSize();
            var dy = state[1] * this.engine.getStepSize();
            length += Math.sqrt(dx * dx + dy * dy);
            if (ct == 0 && drawTrace) {
                this.gfx.moveTo(state[2], state[3]);
            }
            if (this.model.isFinished(state) || ct > 30000) {
                isRunning = false;
            }
            if (drawTrace) {
                this.gfx.lineTo(state[2], state[3]);
            }
        }
        if (drawTrace) {
            this.game.debug.text("Stopped at Magnet: " + this.model.restIdx, 20, 40);
        }
        return length;
    };
    MagPend.prototype.update = function () {
        var xscale = this.game.world.width / this.bitmap.width;
        var yscale = this.game.world.height / this.bitmap.height;
        for (var k = 0; k < 10 && this.doScan; ++k) {
            this.xx += 1;
            if (this.xx >= this.bitmap.width) {
                this.xx = 0;
                this.yy += 1;
                if (this.yy >= this.bitmap.height) {
                    this.yy = 0;
                    this.doScan = false;
                }
            }
            var updateRefLength = (this.yy == 0 && this.xx == 1);
            var x_1 = this.xx - (this.bitmap.width / 2);
            var y_1 = this.yy - (this.bitmap.height / 2);
            var length_1 = this.trace([0, 0, x_1 * xscale, y_1 * yscale], false);
            if (updateRefLength) {
                this.refLength = length_1;
            }
            var idxMag = this.model.restIdx;
            this.putPixel(this.xx, this.yy, idxMag, length_1, this.refLength);
        }
        var x = this.game.input.mousePointer.worldX / this.game.world.scale.x;
        var y = this.game.input.mousePointer.worldY / this.game.world.scale.y;
        this.trace([0, 0, x, y], true);
    };
    MagPend.prototype.preload = function () {
    };
    MagPend.prototype.create = function () {
        this.game.input.mouse.capture = true;
        this.game.world.setBounds(-1000, -1000, 2000, 2000);
        this.game.world.scale.setTo(this.game.width / this.game.world.width, this.game.height / this.game.world.height);
        this.bitmap = this.game.make.bitmapData(100, 100);
        this.bitmap.addToWorld(this.game.world.centerX, this.game.world.centerY, 0.5, 0.5, this.game.world.width / this.bitmap.width, this.game.world.height / this.bitmap.height);
        this.gfx = this.game.add.graphics(0, 0);
        this.model.create();
    };
    MagPend.prototype.render = function () {
    };
    MagPend.prototype.setFriction = function (friction) {
        this.xx = 0;
        this.yy = 0;
        this.doScan = true;
        this.model.friction = friction;
    };
    MagPend.prototype.setStrength = function (strength) {
        this.xx = 0;
        this.yy = 0;
        this.doScan = true;
        this.model.setPendStrength(strength);
    };
    MagPend.prototype.putPixel = function (x, y, idx, length, refLength) {
        refLength *= 1.2;
        var bri = 1 / (Math.exp(Math.log(256) / (refLength * refLength) * (length * length)));
        var baseBri = 255;
        switch (idx) {
            case -1:
                this.bitmap.setPixel(x, y, 0, 0, 0);
                return;
            case 1:
                this.bitmap.setPixel(x, y, baseBri * bri, 0, 0);
                return;
            case 2:
                this.bitmap.setPixel(x, y, 0, baseBri * bri, 0);
                return;
            case 3:
                this.bitmap.setPixel(x, y, 0, 0, baseBri * bri);
                return;
        }
    };
    return MagPend;
}());
//# sourceMappingURL=MagPend.js.map