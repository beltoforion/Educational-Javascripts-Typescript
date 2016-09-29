var Vec2d = (function () {
    function Vec2d(x, y) {
        this.x = x;
        this.y = y;
    }
    Vec2d.prototype.clone = function () {
        return new Vec2d(this.x, this.y);
    };
    Vec2d.prototype.length = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };
    Vec2d.prototype.lengthSqr = function () {
        return this.x * this.x + this.y * this.y;
    };
    Vec2d.prototype.add = function (v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    };
    Vec2d.prototype.subtract = function (v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    };
    Vec2d.prototype.rotate = function (angle) {
        var fi = angle * Math.PI / 180;
        this.x = this.x * Math.cos(fi) - this.y * Math.sin(fi);
        this.y = this.x * Math.sin(fi) + this.y * Math.cos(fi);
        return this;
    };
    Vec2d.prototype.orthoNormal = function () {
        var ret = new Vec2d(this.y, this.x);
        return ret.multiplyValue(ret.length());
    };
    // Angle towards the positive y axis in radians
    Vec2d.prototype.verticalAngle = function () {
        return Math.PI - Math.atan2(this.x, this.y);
    };
    // Angle towards the positive y axis in radians
    Vec2d.prototype.verticalAngleDeg = function () {
        return this.verticalAngle() * 180.0 / Math.PI;
    };
    Vec2d.prototype.addXY = function (x, y) {
        this.x += x;
        this.y += y;
        return this;
    };
    Vec2d.prototype.normalize = function () {
        var l = this.length();
        this.divideValue(l);
        return this;
    };
    Vec2d.prototype.multiplyValue = function (s) {
        this.x *= s;
        this.y *= s;
        return this;
    };
    Vec2d.prototype.divideValue = function (s) {
        this.x /= s;
        this.y /= s;
        return this;
    };
    //-------------------------------------------------------------------------------------------------
    // Static functions that do not alter the arguments
    //-------------------------------------------------------------------------------------------------
    Vec2d.prototype.rotateEx = function (angle) {
        var fi = angle * Math.PI / 180;
        var v = new Vec2d(this.x * Math.cos(fi) - this.y * Math.sin(fi), this.x * Math.sin(fi) + this.y * Math.cos(fi));
        return v;
    };
    Vec2d.subtractEx = function (v1, v2) {
        return new Vec2d(v1.x - v2.x, v1.y - v2.y);
    };
    Vec2d.addEx = function (v1, v2) {
        return new Vec2d(v1.x + v2.x, v1.y + v2.y);
    };
    return Vec2d;
}());
//# sourceMappingURL=vec2d.js.map