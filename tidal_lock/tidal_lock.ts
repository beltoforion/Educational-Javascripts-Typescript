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

/// <reference path="../shared/context2d.ts"/>
/// <reference path="./simulation.ts"/>

class TidalLock extends Simulation {
    
    private config : any;       // simulation config
    
    private canvas : any;       // the html canvas 
    
    private w : number;         // simulation with in pixel
    
    private h : number;         // Simulation height in pixel
    
    private ctx : any;          // 2d drawing context
    
    private ts : number;        // time step size

    // simulation constants and timekeeping
    private gamma : number = 6.67408e-11;   // gravitation constant in m³/(kg*s²)
    
    private time : number = 0;              // simulation time

    private model : any;                    // the underlying simulation model

    // style
    private style : any = {
            colBack : '#112255'           
    };

    constructor(cfg : any) {
        super();

        this.config = cfg;

        // The primary drawing canvas
        this.canvas = <HTMLCanvasElement> document.getElementById(cfg.cvid)
        this.ctx = Context2d.Create(this.canvas);
        this.w = this.canvas.width
        this.h = this.canvas.height

        this.init();
    }

    protected init() : void {
        if (this.config.isRunning) {
            window.setInterval(this.tick.bind(this), 30)            
        } else {
            this.tick();
        }
    }

    protected update() : void {
    }

    protected render() : void {
        this.ctx.fillStyle = this.style.colBack;
        this.ctx.fillRect(0,0, this.w, this.h);
    }
}