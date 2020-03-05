/// <reference path="../shared/phaser-ce-2.14.0/typescript/phaser.d.ts"/> 
/// <reference path="./doppler_ring.ts"/>
var BackgroundStar = /** @class */ (function () {
    function BackgroundStar() {
    }
    return BackgroundStar;
}());
var DopplerEffect = /** @class */ (function () {
    function DopplerEffect(cfg) {
        var _this = this;
        this.colArrow = 0xffffff;
        this.velStar = 0.5;
        this.velRings = 1;
        this.sizeStar = 20;
        this.tick = 0;
        this.fontHeight = 0;
        this.numStars = 200;
        this.numRings = 20;
        this.distRings = 30;
        this.deltaT = 0.5;
        this.config = cfg;
        if (cfg.sizeStar != null) {
            this.sizeStar = cfg.sizeStar;
        }
        if (cfg.velStar != null) {
            this.velStar = cfg.velStar;
        }
        if (cfg.numStars != null) {
            this.numStars = cfg.numStars;
        }
        this.game = new Phaser.Game(cfg.width, cfg.height, Phaser.CANVAS, cfg.cvid, {
            preload: function () { return _this.preload(); },
            create: function () { return _this.create(); },
            update: function () { return _this.update(); },
            render: function () { return _this.render(); }
        }, cfg.noBackground != null && cfg.noBackground);
    }
    DopplerEffect.prototype.preload = function () {
        this.game.load.image('sun', this.config.assetpath + 'assets/sprites/sun.png');
        this.game.load.image('star', this.config.assetpath + 'assets/sprites/particle.png');
        this.game.load.image('color', this.config.assetpath + 'assets/sprites/color.png');
    };
    DopplerEffect.prototype.create = function () {
        var x = this.game.world.centerX - 100;
        var y = this.game.world.centerY;
        // Background stars
        this.stars = new Array(this.numStars);
        for (var i = 0; i < this.numStars; ++i) {
            var s = new BackgroundStar();
            s.Sprite = this.game.add.sprite(Math.random() * this.game.world.width, Math.random() * this.game.world.height, 'star');
            var size = 8 + Math.random() * 10;
            s.Sprite.scale.setTo(size / s.Sprite.width, size / s.Sprite.width);
            s.vx = this.velStar * 0.5 + Math.random();
            s.vy = 0;
            this.stars[i] = s;
        }
        // doppler rings
        this.graphics = this.game.add.graphics(0, 0);
        this.rings = new Array();
        for (var i = 0; i < this.numRings; ++i) {
            var r = new DopplerRing();
            r.x = x + this.velStar * this.deltaT * i * this.distRings;
            r.y = y;
            r.r = this.distRings * i * this.velRings * this.deltaT;
            this.rings[i] = r;
        }
        // color overlay
        this.colors = this.game.add.sprite(100, 100, 'color');
        this.colors.anchor = new Phaser.Point(0.5, 0.5);
        this.colors.x = this.game.world.centerX;
        this.colors.y = this.game.world.centerY;
        this.colors.alpha = 0.2;
        this.colors.scale.setTo(this.game.world.width / this.colors.width, this.game.world.height / this.colors.width);
        // central star
        this.sun = this.game.add.sprite(100, 100, 'sun');
        this.sun.anchor = new Phaser.Point(0.5, 0.5);
        this.sun.scale.setTo(this.sizeStar / this.sun.width, this.sizeStar / this.sun.width);
        this.sun.x = x;
        this.sun.y = y;
    };
    DopplerEffect.prototype.update = function () {
        this.tick += this.deltaT;
        for (var i = 0; i < this.numStars; ++i) {
            this.stars[i].Sprite.x += this.stars[i].vx * this.deltaT;
            this.stars[i].Sprite.y += this.stars[i].vy * this.deltaT;
            if (this.stars[i].Sprite.x < 0) {
                this.stars[i].Sprite.x = this.game.width;
            }
            if (this.stars[i].Sprite.x > this.game.width) {
                this.stars[i].Sprite.x = 0;
            }
            if (this.stars[i].Sprite.y < 0) {
                this.stars[i].Sprite.y = this.game.width;
            }
            if (this.stars[i].Sprite.y > this.game.height) {
                this.stars[i].Sprite.y = 0;
            }
        }
        for (var i = 0; i < this.numRings; ++i) {
            var c = this.rings[i];
            c.r += this.velRings * this.deltaT;
            c.x += this.velStar * this.deltaT;
            if (c.r * 2 > this.distRings * this.numRings * this.velRings) {
                c.r = 0;
                c.x = this.sun.x;
                c.y = this.sun.y;
            }
        }
    };
    DopplerEffect.prototype.render = function () {
        this.graphics.clear();
        for (var i = 0; i < this.numRings; ++i) {
            var alpha = 1 - (this.rings[i].r * 2) / (this.distRings * this.numRings * this.velRings);
            this.graphics.lineStyle(4, 0xFFFFFF, alpha);
            this.graphics.drawCircle(this.rings[i].x, this.rings[i].y, this.rings[i].r * 2);
        }
    };
    return DopplerEffect;
}());
//# sourceMappingURL=doppler_effect.js.map