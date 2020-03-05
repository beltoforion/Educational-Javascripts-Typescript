/// <reference path="../shared/box2d.ts"/>
/// <reference path="../shared/debug.ts"/>
/// <reference path="./IModel.ts"/>
var ModelMagPend = /** @class */ (function () {
    function ModelMagPend(game) {
        this.x = [];
        this.y = [];
        this.k = [];
        this.r = [];
        this.col = [
            ModelMagPend.rgb2hex(255, 255, 255),
            ModelMagPend.rgb2hex(200, 30, 30),
            ModelMagPend.rgb2hex(30, 200, 30),
            ModelMagPend.rgb2hex(30, 30, 200),
            ModelMagPend.rgb2hex(179, 178, 86),
            ModelMagPend.rgb2hex(131, 255, 0),
            ModelMagPend.rgb2hex(255, 194, 0),
            ModelMagPend.rgb2hex(255, 0, 162),
            ModelMagPend.rgb2hex(152, 0, 255),
            ModelMagPend.rgb2hex(0, 67, 255),
            ModelMagPend.rgb2hex(0, 245, 255),
            ModelMagPend.rgb2hex(0, 255, 76),
            ModelMagPend.rgb2hex(179, 134, 86),
            ModelMagPend.rgb2hex(0, 64, 64),
            ModelMagPend.rgb2hex(133, 147, 142),
            ModelMagPend.rgb2hex(128, 0, 64),
            ModelMagPend.rgb2hex(255, 0, 0)
        ];
        this.abort = false;
        this.restIdx = 0;
        this.game = game;
        this.friction = 0.001;
        // pendulum mount 
        this.x.push(0);
        this.y.push(0);
        this.k.push(0.00001); //0.00001); 
        this.r.push(20);
        // inner ring of magnets 
        var rad = 300;
        for (var i = 0; i < 360; i += 120 /* 72 */) {
            this.x.push(rad * Math.sin(i * Math.PI / 180.0));
            this.y.push(rad * Math.cos(i * Math.PI / 180.0));
            this.k.push(150);
            this.r.push(30);
        }
        // all arrays must hav equal length!
        Debug.assert(this.x.length == this.y.length);
        Debug.assert(this.x.length == this.r.length);
        Debug.assert(this.x.length == this.k.length);
    }
    ModelMagPend.rgb2hex = function (red, green, blue) {
        var rgb = blue | (green << 8) | (red << 16);
        return rgb;
    };
    ModelMagPend.prototype.eval = function (state, time, deriv) {
        // velocity
        var vel_x = state[0];
        var vel_y = state[1];
        // position
        var pos_x = state[2];
        var pos_y = state[3];
        // Pendel
        var acc_x = 0;
        var acc_y = 0;
        var checkAbort = false;
        var n = this.x.length;
        for (var i = 0; i < n; ++i) {
            var xx = this.x[i];
            var yy = this.y[i];
            var f = this.k[i];
            var r = this.r[i];
            if (i == 0) {
                acc_x += f * (xx - pos_x);
                acc_y += f * (yy - pos_y);
            }
            else {
                var d = Math.sqrt((xx - pos_x) * (xx - pos_x) +
                    (yy - pos_y) * (yy - pos_y) +
                    15 * 15);
                if (d < r)
                    checkAbort = true;
                var dddd = d * d * d; //*d;
                acc_x += (f / dddd) * (xx - pos_x);
                acc_y += (f / dddd) * (yy - pos_y);
            }
        }
        // Friction
        acc_x -= this.friction * vel_x;
        acc_y -= this.friction * vel_y;
        // derivation of the state array
        deriv[0] = acc_x;
        deriv[1] = acc_y;
        deriv[2] = vel_x;
        deriv[3] = vel_y;
        this.abort = checkAbort && ((vel_x * vel_x + vel_y * vel_y) < 2);
    };
    ModelMagPend.prototype.getName = function () {
        return "Magnetic Pendulum";
    };
    ModelMagPend.prototype.getDim = function () {
        return 4;
    };
    ModelMagPend.prototype.setEngine = function (engine) {
        this.engine = engine;
    };
    ModelMagPend.prototype.isFinished = function (state) {
        if (!this.abort)
            return false;
        var pos_x = state[2];
        var pos_y = state[3];
        var minDist = Number.MAX_VALUE;
        var n = this.x.length;
        for (var i = 0; i < n; ++i) {
            var xx = this.x[i];
            var yy = this.y[i];
            var dist = Math.sqrt((xx - pos_x) * (xx - pos_x) +
                (yy - pos_y) * (yy - pos_y));
            if (dist < minDist) {
                this.restIdx = i;
                minDist = dist;
            }
        }
        return this.abort;
    };
    ModelMagPend.prototype.setPendStrength = function (strength) {
        this.k[0] = strength;
    };
    ModelMagPend.prototype.create = function () {
        this.gfx = this.game.add.graphics(0, 0);
        // Pendulum Mount Point
        this.gfx.lineStyle(3, this.col[0], 1);
        this.gfx.moveTo(this.x[0] - this.r[0], this.y[0]);
        this.gfx.lineTo(this.x[0] + this.r[0], this.y[0]);
        this.gfx.moveTo(this.x[0], this.y[0] - this.r[0]);
        this.gfx.lineTo(this.x[0], this.y[0] + this.r[0]);
        // Magnets
        this.gfx.lineStyle(0);
        var n = this.x.length;
        for (var i = 1; i < n; ++i) {
            this.gfx.beginFill(this.col[i]);
            this.gfx.drawCircle(this.x[i], this.y[i], 2 * this.r[i]);
            this.gfx.endFill();
        }
    };
    return ModelMagPend;
}());
//# sourceMappingURL=ModelMagPend.js.map