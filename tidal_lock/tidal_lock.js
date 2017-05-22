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
/// <reference path="./IntegratorRK4.ts"/>
var MagPend = (function () {
    function MagPend(cfg) {
        var _this = this;
        this.game = new Phaser.Game(cfg.width, cfg.height, Phaser.AUTO, cfg.cvid, {
            preload: function () { return _this.preload(); },
            create: function () { return _this.create(); },
            update: function () { return _this.update(); },
            render: function () { return _this.render(); }
        });
        var model = new ModelMagPend(this.game);
        this.model = model;
        this.renderer = model;
        this.engine = new IntegratorRK4(this.model);
    }
    MagPend.prototype.update = function () {
        this.game.world.bounds.setTo(-1000, -1000, 2000, 2000);
        if (this.game.input.mousePointer.isDown) {
            var x = this.game.input.mousePointer.worldX;
            var y = this.game.input.mousePointer.worldY;
            var vy = 0;
            var vx = 0;
            // let xx : number = this.game.input.worldX;
            // let yy : number = this.game.input.worldY;
            this.game.debug.text("World (w, h): " + this.game.world.width + ", " + this.game.world.height, 20, 210);
            this.game.debug.text("World (x, y): " + this.game.world.x + ", " + this.game.world.y, 20, 230);
            this.game.debug.text("Mouse Down  (world): " + x + ", " + y, 20, 250);
            this.game.debug.text("Mouse Down (canvas): " + this.game.input.x + ", " + this.game.input.y, 20, 270);
            var state = [vx, vy, x, y];
            this.engine.setInitialState(state);
        }
    };
    MagPend.prototype.preload = function () {
    };
    MagPend.prototype.create = function () {
        this.game.input.mouse.capture = true;
        this.renderer.create();
    };
    MagPend.prototype.render = function () {
        this.renderer.render();
        this.game.debug.text("Left Button: " + this.game.input.activePointer.leftButton.isDown, 20, 150);
        this.game.debug.text("Middle Button: " + this.game.input.activePointer.middleButton.isDown, 20, 170);
        this.game.debug.text("Right Button: " + this.game.input.activePointer.rightButton.isDown, 20, 190);
    };
    return MagPend;
}());
//# sourceMappingURL=tidal_lock.js.map