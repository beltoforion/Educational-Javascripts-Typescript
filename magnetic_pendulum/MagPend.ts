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
/// <reference path="../shared/box2d.ts"/>
/// <reference path="./IntegratorRK4.ts"/>

class MagPend  {

    public static rgb2hex(red : number, green : number, blue : number) : number {
        var rgb = blue | (green << 8) | (red << 16);
        return rgb;
    }

    private game : Phaser.Game;

    private engine : IIntegrator;

    private model : ModelMagPend;

    private mouseX : number;

    private mouseY : number;

    private bitmap : Phaser.BitmapData;

    private gfx : Phaser.Graphics;

    private xx : number = 0;

    private yy : number = 0;

    private doScan : boolean = true;

    constructor(cfg : any) {

        this.game = new Phaser.Game(cfg.width, 
                                    cfg.height, 
                                    Phaser.AUTO,
                                    cfg.cvid, 
                                    { 
                                        preload: () => this.preload(), 
                                        create:  () => this.create(), 
                                        update:  () => this.update(), 
                                        render:  () => this.render() 
                                    }, 
                                    false,  // transparency
                                    false); // antialiasing
        let model = new ModelMagPend(this.game);
        this.model = model;

//        this.engine = new IntegratorRK4(this.model);
        this.engine = new IntegratorRK5(this.model);
    }

    private trace(state : number [], drawTrace : boolean) : number {
        let vx : number = state[0];
        let vy : number = state[1];
        let x  : number = state[2];
        let y  : number = state[3];
        
        if (drawTrace) {
            this.game.debug.text("Start Point: x=" + x.toPrecision(3) + "; y=" + y.toPrecision(3), 20, 20);
        }
    
        // set start conditions
        this.engine.setInitialState(state);
        this.model.restIdx = -1;

        // Compute new trace
        let isRunning : boolean = true;
        
        if (drawTrace) {
            this.gfx.clear();
            this.gfx.lineStyle(6, ModelMagPend.rgb2hex(255, 255, 0), 4);
        }

        let length : number = 0;            
        for (var ct = 0; isRunning; ++ct) {
            state = this.engine.singleStep();

            let dx = state[0] * this.engine.getStepSize();
            let dy = state[1] * this.engine.getStepSize();
            length += Math.sqrt(dx * dx + dy * dy);

            if (ct==0 && drawTrace) {
                this.gfx.moveTo(state[2], state[3]);
            }

            if (this.model.isFinished(state) || ct > 30000) {
                isRunning = false;
            }

            if (drawTrace) {
                this.gfx.lineTo(state[2], state[3]);
            }
        }

        if (drawTrace) {
            this.game.debug.text("Stopped at Magnet: " + this.model.restIdx, 20, 40);
        }

        return length;
    }

    private refLength : number = 0;

    public update() : void {

        let xscale : number = this.game.world.width / this.bitmap.width;
        let yscale : number = this.game.world.height / this.bitmap.height;

        for (var k=0; k<10 && this.doScan; ++k) {
            this.xx += 1;
            if (this.xx >= this.bitmap.width) {
                this.xx = 0;
                this.yy += 1;

                if (this.yy >= this.bitmap.height) {
                    this.yy = 0;
                    this.doScan = false;
                }
            }

            let updateRefLength : boolean = (this.yy==0 && this.xx==1);
            let x : number  = this.xx - (this.bitmap.width / 2);
            let y : number  = this.yy - (this.bitmap.height / 2);
            let length : number = this.trace([ 0, 0, x * xscale, y * yscale ], false);

            if (updateRefLength) {
                this.refLength = length;
            }
            
            let idxMag : number = this.model.restIdx;

            this.putPixel(this.xx, this.yy, idxMag, length, this.refLength);
        }

        let x : number = this.game.input.mousePointer.worldX / this.game.world.scale.x;
        let y : number = this.game.input.mousePointer.worldY / this.game.world.scale.y;
        this.trace([ 0, 0, x, y ], true);
    }

    public preload() : void {
    }

    public create() : void { 
        this.game.input.mouse.capture = true;
        this.game.world.setBounds(-1000, -1000, 2000, 2000); 
        this.game.world.scale.setTo(this.game.width / this.game.world.width,
                                    this.game.height / this.game.world.height);

        this.bitmap = this.game.make.bitmapData(100, 100);
        this.bitmap.addToWorld(this.game.world.centerX, 
                               this.game.world.centerY, 0.5, 0.5,
                               this.game.world.width / this.bitmap.width, 
                               this.game.world.height / this.bitmap.height);
        
        this.gfx = this.game.add.graphics(0,0);

        this.model.create();
    }

    public render() : void {
    }

    public setFriction(friction : number) : void {
        this.xx = 0;
        this.yy = 0;
        this.doScan = true;
        this.model.friction = friction;
    }

    public setStrength(strength : number) : void {
        this.xx = 0;
        this.yy = 0;
        this.doScan = true;
        this.model.setPendStrength(strength);
    }

    private putPixel(x : number, y : number, idx : number, length : number, refLength : number) : void {
        refLength *= 1.2;
        let bri : number = 1 / (Math.exp(Math.log(256) / (refLength*refLength) * (length * length)));
        let baseBri : number = 255;        
        
        switch(idx) {
            case -1:
                this.bitmap.setPixel(x, y, 0, 0, 0);
                return;

            case 1:
                this.bitmap.setPixel(x, y, baseBri * bri, 0, 0);
                return;

            case 2:
                this.bitmap.setPixel(x, y, 0, baseBri * bri, 0);
                return;
        
            case 3:
                this.bitmap.setPixel(x, y, 0, 0, baseBri * bri);
                return;
        }
    }
}