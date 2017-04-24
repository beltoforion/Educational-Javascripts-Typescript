/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
/// <reference path="./chart.ts"/>
var PulsarTimingSimulator = (function () {
    function PulsarTimingSimulator(cfg) {
        var _this = this;
        this.colOrbits = 0x886633;
        this.colTintBeamLeft = 0xFFFF33;
        this.centerOfMassY = 250;
        // distance of the star from the center of mass
        this.distStar = 70;
        // Distance of the Planet from the center of mass
        this.distPlanet = 140;
        // render size of the center of mass
        this.sizeCenterOfMass = 10;
        // render size of the star
        this.sizeStar = 70;
        // render size of the planet
        this.sizeExoplanet = 20;
        this.sizeEarth = 50;
        this.tick = 0;
        this.chart_x = 0;
        this.font = "30px Arial";
        this.fontHeight = 0;
        this.config = cfg;
        if (cfg.noDeltaV == null) {
            cfg.noDeltaV = false;
        }
        if (cfg.noSpectrum == null) {
            cfg.noSpectrum = false;
        }
        if (cfg.sizeStar != null) {
            this.sizeStar = cfg.sizeStar;
        }
        if (cfg.sizeExoplanet != null) {
            this.sizeExoplanet = cfg.sizeExoplanet;
        }
        if (cfg.distStar != null) {
            this.distStar = cfg.distStar;
        }
        if (cfg.distPlanet != null) {
            this.distPlanet = cfg.distPlanet;
        }
        if (cfg.font != null) {
            this.font = cfg.font;
        }
        if (cfg.centerOfMassY != null) {
            this.centerOfMassY = cfg.centerOfMassY;
        }
        this.game = new Phaser.Game(cfg.width, cfg.height, Phaser.CANVAS, cfg.cvid, {
            preload: function () { return _this.preload(); },
            create: function () { return _this.create(); },
            update: function () { return _this.update(); },
            render: function () { return _this.render(); }
        });
    }
    PulsarTimingSimulator.prototype.preload = function () {
        this.game.load.image('beam', this.config.assetpath + 'assets/sprites/beam.png');
        this.game.load.image('beam2', this.config.assetpath + 'assets/sprites/beam2.png');
        this.game.load.image('planet', this.config.assetpath + 'assets/sprites/planet.png');
        this.game.load.image('earth', this.config.assetpath + 'assets/sprites/earth.png');
        this.game.load.image('planet_shadow', this.config.assetpath + 'assets/sprites/planet_shadow.png');
        this.game.load.image('pulsar', this.config.assetpath + 'assets/sprites/pulsar.png');
        this.game.load.image('center_of_mass', this.config.assetpath + 'assets/sprites/center_of_mass.png');
    };
    PulsarTimingSimulator.prototype.create = function () {
        var center_left_x = this.game.world.width / 2 - 250;
        var center_right_x = this.game.world.width / 2 + 250;
        var center_y = this.centerOfMassY;
        this.game.stage.backgroundColor = "#000000";
        // 
        // Left Side
        //
        var style = { font: this.font, fill: "#ffffff", wordWrap: false, align: "center", backgroundColor: "#000000" };
        this.caption_left = this.game.add.text(center_left_x, 20, "Pulsar mit Exoplanet", style);
        this.caption_left.anchor = new Phaser.Point(0.5, 0.5);
        this.mask_left = this.game.add.graphics(0, 0);
        this.mask_left.drawRect(0, 0, this.game.width / 2, this.game.height / 2 + 100);
        this.orbits = this.game.add.graphics(0, 0);
        this.orbits.alpha = 0.5;
        this.orbits.lineStyle(2, this.colOrbits, 1);
        this.orbits.drawCircle(center_left_x, center_y, 2 * this.distStar);
        this.orbits.drawCircle(center_left_x, center_y, 2 * this.distPlanet);
        this.beam_left = this.game.add.sprite(100, 100, 'beam');
        this.beam_left.anchor = new Phaser.Point(0.5, 0.5);
        this.beam_left.scale.setTo(1.1, 0.6);
        this.beam_left.x = this.game.world.centerX;
        this.beam_left.y = this.game.world.centerY - 100;
        this.beam_left.mask = this.mask_left;
        this.pulsar_left = this.game.add.sprite(100, 100, 'pulsar');
        this.pulsar_left.anchor = new Phaser.Point(0.5, 0.5);
        this.pulsar_left.scale.setTo(this.sizeStar / this.pulsar_left.width, this.sizeStar / this.pulsar_left.width);
        this.pulsar_left.x = this.beam_left.x;
        this.pulsar_left.y = this.beam_left.y;
        this.earth_left = this.game.add.sprite(200, 200, 'earth');
        this.earth_left.anchor = new Phaser.Point(0.5, 0.5);
        this.earth_left.scale.setTo(this.sizeEarth / this.earth_left.width, this.sizeEarth / this.earth_left.width);
        this.earth_left.y = center_y + 300;
        this.earth_left.x = center_left_x;
        this.center_of_mass = this.game.add.sprite(100, 100, 'center_of_mass');
        this.center_of_mass.scale.setTo(this.sizeCenterOfMass / this.center_of_mass.width, this.sizeCenterOfMass / this.center_of_mass.width);
        this.center_of_mass.anchor = new Phaser.Point(0.5, 0.5);
        this.center_of_mass.x = center_left_x;
        this.center_of_mass.y = center_y;
        this.planet = this.game.add.sprite(100, 100, 'planet');
        this.planet.anchor = new Phaser.Point(0.5, 0.5);
        this.planet.scale.setTo(this.sizeExoplanet / this.planet.width, this.sizeExoplanet / this.planet.width);
        this.planet.y = this.pulsar_left.y;
        this.planet.x = center_left_x;
        //
        // Right Side
        //
        this.caption_right = this.game.add.text(center_right_x, 20, "Pulsar ohne Exoplanet", style);
        this.caption_right.anchor = new Phaser.Point(0.5, 0.5);
        this.mask_right = this.game.add.graphics(0, 0);
        this.mask_right.drawRect(this.game.width / 2, 0, this.game.width / 2, this.mask_left.height);
        this.beam_right = this.game.add.sprite(100, 100, 'beam2');
        this.beam_right.anchor = new Phaser.Point(0.5, 0.5);
        this.beam_right.scale.setTo(1.1, 0.6);
        this.beam_right.x = center_right_x;
        this.beam_right.y = center_y;
        this.beam_right.mask = this.mask_right;
        this.pulsar_right = this.game.add.sprite(100, 100, 'pulsar');
        this.pulsar_right.anchor = new Phaser.Point(0.5, 0.5);
        this.pulsar_right.scale.setTo(this.sizeStar / this.pulsar_right.width, this.sizeStar / this.pulsar_right.width);
        this.pulsar_right.x = this.beam_right.x;
        this.pulsar_right.y = this.beam_right.y;
        this.earth_right = this.game.add.sprite(200, 200, 'earth');
        this.earth_right.anchor = new Phaser.Point(0.5, 0.5);
        this.earth_right.scale.setTo(this.sizeEarth / this.earth_right.width, this.sizeEarth / this.earth_right.width);
        this.earth_right.y = this.earth_left.y;
        this.earth_right.x = center_right_x;
        // 
        // Chart
        //
        var margin = 60;
        var height = 200;
        this.chart = new Chart(this.game, this.game.world.width - 2 * margin, height, this.config.font);
        this.chart.create(margin, this.game.world.height - margin - height);
        this.chart.setYRange(0.0, 1.1);
        this.chart.setXRange(0, 300);
        this.chart.setXTitle("Zeit");
        this.chart.setYTitle("Amplitude");
        this.curve = new Array();
        this.curve2 = new Array();
    };
    PulsarTimingSimulator.prototype.addData = function () {
        if (this.chart_x > this.chart.getXMax()) {
            this.curve = new Array();
            this.curve2 = new Array();
            this.chart_x = 0;
        }
        var speed = 0.3;
        var delta = 5;
        var detectionAngle = 90 - Math.atan2(this.earth_left.x - this.pulsar_left.x, this.earth_left.y - 50 - this.pulsar_left.y) * 180 / Math.PI;
        var val = 0;
        if (Math.abs(this.beam_left.angle) > Math.abs(detectionAngle - delta) && Math.abs(this.beam_left.angle) < Math.abs(detectionAngle + delta)) {
            val = 0.7;
            speed = 1;
        }
        else {
            val = 0.3;
        }
        this.curve.push(new Phaser.Point(this.chart_x, val));
        var detectionAngle2 = 90 - Math.atan2(this.earth_right.x - this.pulsar_right.x, this.earth_right.y - 50 - this.pulsar_right.y) * 180 / Math.PI;
        var val2 = 0;
        if (Math.abs(this.beam_right.angle) > Math.abs(detectionAngle2 - delta) && Math.abs(this.beam_right.angle) < Math.abs(detectionAngle2 + delta)) {
            val2 = 0.7;
            speed = 1;
        }
        else {
            val2 = 0.3;
        }
        this.chart_x += speed;
        this.curve2.push(new Phaser.Point(this.chart_x, val2));
    };
    PulsarTimingSimulator.prototype.update = function () {
        this.tick += 1;
        var c1 = 0.005;
        var angle = this.tick * c1;
        var newX = this.center_of_mass.x + this.distStar * Math.sin(angle);
        var newY = this.center_of_mass.y + this.distStar * Math.cos(angle);
        this.pulsar_left.x = newX;
        this.pulsar_left.y = newY;
        this.beam_right.angle -= 3;
        this.beam_left.angle -= 3;
        this.beam_left.x = this.pulsar_left.x;
        this.beam_left.y = this.pulsar_left.y;
        this.planet.x = this.center_of_mass.x - this.distPlanet * Math.sin(angle);
        this.planet.y = this.center_of_mass.y - this.distPlanet * Math.cos(angle);
        this.planet.angle = -angle * 180 / Math.PI + 180;
        // beam detection
        this.addData();
    };
    PulsarTimingSimulator.prototype.render = function () {
        if (this.chart_x < 2) {
            this.chart.clear();
        }
        else {
            this.chart.render2(this.curve, 0x0085ff, this.curve2, 0x00ff85);
        }
    };
    return PulsarTimingSimulator;
}());
//# sourceMappingURL=exoplanet_pulsar.js.map