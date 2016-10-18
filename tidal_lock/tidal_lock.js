//-------------------------------------------------------------------------------------------------
//
//      Simulating Tidal Locking of Planets
//
//      (C) Ingo Berg 2016
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/// <reference path="../shared/context2d.ts"/>
/// <reference path="./simulation.ts"/>
var TidalLock = (function (_super) {
    __extends(TidalLock, _super);
    function TidalLock(cfg) {
        _super.call(this);
        // simulation constants and timekeeping
        this.gamma = 6.67408e-11; // gravitation constant in m³/(kg*s²)
        this.time = 0; // simulation time
        // style
        this.style = {
            colBack: '#112255'
        };
        this.config = cfg;
        // The primary drawing canvas
        this.canvas = document.getElementById(cfg.cvid);
        this.ctx = Context2d.Create(this.canvas);
        this.w = this.canvas.width;
        this.h = this.canvas.height;
        this.init();
    }
    TidalLock.prototype.init = function () {
        if (this.config.isRunning) {
            window.setInterval(this.tick.bind(this), 30);
        }
        else {
            this.tick();
        }
    };
    TidalLock.prototype.update = function () {
    };
    TidalLock.prototype.render = function () {
        this.ctx.fillStyle = this.style.colBack;
        this.ctx.fillRect(0, 0, this.w, this.h);
    };
    return TidalLock;
}(Simulation));
//# sourceMappingURL=tidal_lock.js.map