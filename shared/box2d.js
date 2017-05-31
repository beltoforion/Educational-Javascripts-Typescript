/// <reference path="./vec2d.ts"/>
var Box2d = (function () {
    function Box2d() {
        this.ll = new Vec2d(0, 0);
        this.ur = new Vec2d(0, 0);
    }
    Box2d.prototype.set = function (ll, ur) {
        this.ll = ll;
        this.ur = ur;
    };
    Box2d.prototype.width = function () {
        return Math.abs(this.ll.x - this.ur.x);
    };
    Box2d.prototype.height = function () {
        return Math.abs(this.ll.y - this.ur.y);
    };
    return Box2d;
}());
//# sourceMappingURL=box2d.js.map