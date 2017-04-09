/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
var GalaxySimulator = (function () {
    function GalaxySimulator(cfg) {
        var _this = this;
        this.config = cfg;
        this.game = new Phaser.Game(cfg.width, cfg.height, Phaser.WEBGL, cfg.cvid, {
            preload: function () { return _this.preload(); },
            create: function () { return _this.create(); },
            update: function () { return _this.update(); },
            render: function () { return _this.render(); }
        }, cfg.noBackground != null && cfg.noBackground);
    }
    GalaxySimulator.prototype.preload = function () {
        //      this.game.load.image('planet', this.config.assetpath + 'assets/sprites/planet.png');
    };
    GalaxySimulator.prototype.create = function () {
        // this.sun = this.game.add.sprite(100, 100, 'sun');
        // this.sun.anchor = new Phaser.Point(0.5, 0.5);  
        // this.sun.scale.setTo(this.sizeStar/this.sun.width, this.sizeStar/this.sun.width);
        // this.sun.x = this.game.world.centerX;
        // this.sun.y = this.game.world.centerY - 100;
    };
    GalaxySimulator.prototype.update = function () {
    };
    GalaxySimulator.prototype.render = function () {
    };
    return GalaxySimulator;
}());
//
// Start the simulation
// 
/*
window.onload = () => {
  var game = new TransitSimulator();
};
*/
//# sourceMappingURL=galaxy_simulator.js.map