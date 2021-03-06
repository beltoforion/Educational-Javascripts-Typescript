/// <reference path="../shared/phaser-ce-2.14.0/typescript/phaser.d.ts"/> 
/// <reference path="./chart.ts"/>
var TransitSimulator = /** @class */ (function () {
    function TransitSimulator(cfg) {
        var _this = this;
        this.sizeSun = 300;
        this.sizeJupiter = 40;
        this.tick = 0;
        this.colCurve = 0x0085ff;
        this.config = cfg;
        if (cfg.sizeSun != null) {
            this.sizeSun = cfg.sizeSun;
        }
        if (cfg.sizePlanet != null) {
            this.sizeJupiter = cfg.sizePlanet;
        }
        this.game = new Phaser.Game(cfg.width, cfg.height, Phaser.CANVAS, cfg.cvid, {
            preload: function () { return _this.preload(); },
            create: function () { return _this.create(); },
            update: function () { return _this.update(); },
            render: function () { return _this.render(); }
        });
        //      this.game.stage.disableVisibilityChange = true;
    }
    TransitSimulator.prototype.preload = function () {
        this.game.load.image('jupiter', this.config.assetpath + 'assets/sprites/jupiter.png');
        this.game.load.image('sun', this.config.assetpath + 'assets/sprites/sun.png');
    };
    TransitSimulator.prototype.create = function () {
        this.relArea = (this.sizeJupiter * this.sizeJupiter) / (this.sizeSun * this.sizeSun);
        this.sun = this.game.add.sprite(100, 100, 'sun');
        this.sun.anchor = new Phaser.Point(0.5, 0.5);
        this.sun.scale.setTo(this.sizeSun / this.sun.width, this.sizeSun / this.sun.width);
        this.sun.x = this.game.world.centerX;
        this.sun.y = this.game.world.centerY - 150;
        this.jupiter = this.game.add.sprite(100, 100, 'jupiter');
        this.jupiter.anchor = new Phaser.Point(0.5, 0.5);
        this.jupiter.scale.setTo(this.sizeJupiter / this.jupiter.width, this.sizeJupiter / this.jupiter.width);
        this.jupiter.y = this.sun.y;
        this.jupiter.x = 70;
        var margin = 70;
        var height = 200;
        this.chart = new Chart(this.game, this.game.world.width - 2 * margin, height, this.config.font);
        this.chart.create(margin, this.game.world.height - margin - height);
        this.chart.setYRange(0.9, 1.05);
        this.chart.setXRange(margin, this.game.world.width - margin);
        this.chart.setXTitle("Zeit");
        this.chart.setYTitle("Helligkeit");
        this.curve = new Array();
    };
    TransitSimulator.prototype.calcBrightness = function (xpos, ypos) {
        var dist = Math.sqrt(Math.pow(this.sun.x - this.jupiter.x, 2) + Math.pow(this.sun.y - this.jupiter.y, 2));
        var radSun = this.sizeSun / 2;
        var radJup = this.sizeJupiter / 2;
        var areaSun = Math.PI * radSun * radSun;
        var areaJup = Math.PI * radJup * radJup;
        var distSurface = dist - radSun;
        var maxBri = 1;
        var minBri = 1 - (areaJup / areaSun);
        var noise = 0.01;
        if (distSurface > radJup) {
            // Full brightness 
            return maxBri + noise * this.game.rnd.frac();
        }
        else if (distSurface > 0 && distSurface <= radJup) {
            var perc = (distSurface / radJup);
            var v = Math.pow((1 - perc), 4);
            var delta = (maxBri - minBri);
            return maxBri - v * delta + noise * this.game.rnd.frac();
        }
        else {
            var x = this.jupiter.x - this.sun.x;
            var c = Math.sqrt(Math.pow(this.sizeSun / 2, 2) - Math.pow(x, 2)) * 0.0005;
            return minBri - c + noise * this.game.rnd.frac();
        }
    };
    TransitSimulator.prototype.update = function () {
        this.jupiter.x += 1;
        this.tick += 1;
        if (this.jupiter.x > this.config.width) {
            this.jupiter.x = 0;
            this.curve = [];
        }
        if (this.tick % 5 == 0
            && this.jupiter.x > this.chart.xpos
            && this.jupiter.x < (this.game.world.width - this.chart.xpos)) {
            var bri = this.calcBrightness(this.jupiter.x, this.jupiter.y);
            this.curve.push(new Phaser.Point(this.jupiter.x, bri));
        }
    };
    TransitSimulator.prototype.render = function () {
        this.chart.clear();
        this.chart.render(this.curve, this.colCurve);
    };
    return TransitSimulator;
}());
//# sourceMappingURL=exoplanet_transit.js.map