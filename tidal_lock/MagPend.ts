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

class MagPend  {

    public static rgb2hex(red : number, green : number, blue : number) : number {
        var rgb = blue | (green << 8) | (red << 16);
        return rgb;
    }

    private game : Phaser.Game;

    private engine : IIntegrator;

    private model : IModel;

    private renderer : IRenderer;

    private mouseX : number;

    private mouseY : number;

    private gfx : Phaser.Graphics;

    constructor(cfg : any) {

        this.game = new Phaser.Game(cfg.width, 
                                    cfg.height, 
                                    Phaser.WEBGL, // .AUTO,
                                    cfg.cvid, 
                                    { 
                                        preload: () => this.preload(), 
                                        create:  () => this.create(), 
                                        update:  () => this.update(), 
                                        render:  () => this.render() 
                                    });

        let model = new ModelMagPend(this.game);
        this.model = model;
        this.renderer = model;

        this.engine = new IntegratorRK4(this.model);
    }

   
    public update() : void {

        let x : number = this.game.input.mousePointer.worldX / this.game.world.scale.x;
        let y : number = this.game.input.mousePointer.worldY / this.game.world.scale.y;
        this.game.debug.text("world:  x=" + x + "; y=" + y, 20, 150);
        this.game.debug.text("canvas: x=" + this.game.input.x + "; y=" + this.game.input.y, 20, 170);

        if (this.mouseX != x || this.mouseY!=y) {
            this.mouseX = x;
            this.mouseY = y;

            let vy : number = 0;
            let vx : number = 0;
            this.game.debug.text("vy=" + vx + "; vy=" + vy + "; x=" + x + "; y=" + y, 20, 190);
    
            let state : number [] = [ vx, vy, x, y ];
            this.engine.setInitialState(state);
            let isRunning : boolean = true;

            // Compute new trace

            this.gfx.clear();
            this.gfx.lineStyle(3, ModelMagPend.rgb2hex(255, 255, 255), 1);
            this.gfx.moveTo(x, y);
            
            for (var ct = 0; isRunning; ++ct) {
                state = this.engine.singleStep();

                if (this.model.isFinished(state)) {
                    isRunning = false;
                }

                if (ct > 50000) {
                    isRunning = false;
                }

                this.gfx.lineTo(state[2], state[3]);
            }
        }
    }

    public preload() : void {
    }

    public create() : void { 
        this.gfx = this.game.add.graphics(0,0);

        this.game.input.mouse.capture = true;
        this.game.world.setBounds(-1000, -1000, 2000, 2000); 
        this.game.world.scale.setTo(this.game.width / this.game.world.width,
                                    this.game.height / this.game.world.height);
        this.renderer.create();
    }

    public render() : void {
        this.renderer.render();

        this.game.debug.cameraInfo(this.game.camera, 50, 50);
    }
}