/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
var NinePoint = (function () {
    function NinePoint(cfg) {
        var _this = this;
        this.config = cfg;
        this.game = new Phaser.Game(cfg.width, cfg.height, Phaser.CANVAS, cfg.cvid, {
            preload: function () { return _this.preload(); },
            create: function () { return _this.create(); },
            update: function () { return _this.update(); },
            render: function () { return _this.render(); }
        });
        this.game.stage.disableVisibilityChange = true;
    }
    NinePoint.prototype.preload = function () {
        this.game.load.image('point', this.config.assetpath + 'assets/sprites/point.png');
    };
    NinePoint.prototype.create = function () {
        this.game.world.setBounds(-100, -100, 200, 200);
        this.points = new Array(9);
        for (var i = 0; i < 3; ++i) {
            for (var j = 0; j < 3; ++j) {
                var s = this.game.add.sprite((i - 1) * 20, (j - 1) * 20, 'point');
                s.anchor = new Phaser.Point(0.5, 0.5);
                s.scale.setTo(10 / s.width, 10 / s.width);
                this.points[i * 3 + j] = s;
            }
        }
        // this.relArea = (this.sizeJupiter * this.sizeJupiter) / (this.sizeSun * this.sizeSun);
        // this.sun = this.game.add.sprite(100, 100, 'sun');
        // this.sun.anchor = new Phaser.Point(0.5, 0.5);  
        // this.sun.scale.setTo(this.sizeSun/this.sun.width, this.sizeSun/this.sun.width);
        // this.sun.x = this.game.world.centerX;
        // this.sun.y = this.game.world.centerY - 150;
        // this.jupiter = this.game.add.sprite(100, 100, 'jupiter');
        // this.jupiter.anchor = new Phaser.Point(0.5, 0.5);  
        // this.jupiter.scale.setTo(this.sizeJupiter/this.jupiter.width, this.sizeJupiter/this.jupiter.width);
        // this.jupiter.y = this.sun.y;
        // this.jupiter.x = 70;
        // let margin = 70;
        // let height = 200;
        // this.chart = new Chart(this.game, this.game.world.width - 2*margin, height, this.config.font);
        // this.chart.create(margin, this.game.world.height - margin - height);
        // this.chart.setYRange(0.8, 1.1);
        // this.curve = new Array<Phaser.Point>();
    };
    NinePoint.prototype.update = function () {
        // this.jupiter.x += 1;
        // this.tick += 1;
        // if (this.jupiter.x > this.config.width) {
        //   this.jupiter.x = 0;
        //   this.curve = [];
        // }
        // if (   this.tick % 5 == 0 
        //     && this.jupiter.x > this.chart.xpos 
        //     && this.jupiter.x < (this.game.world.width - this.chart.xpos)) {
        //     let bri = this.calcBrightness(this.jupiter.x, this.jupiter.y);
        //     this.curve.push(new Phaser.Point(this.jupiter.x - 50, bri));
        //     console.log(this.curve.length);
        // }
    };
    NinePoint.prototype.render = function () {
    };
    return NinePoint;
}());
//# sourceMappingURL=NinePoint.js.map