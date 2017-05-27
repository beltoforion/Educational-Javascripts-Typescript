/// <reference path="../shared/box2d.ts"/>
/// <reference path="../shared/debug.ts"/>
/// <reference path="./IModel.ts"/>

class ModelMagPend implements IModel, IRenderer {

    public static rgb2hex(red : number, green : number, blue : number) : number {
        var rgb = blue | (green << 8) | (red << 16);
        return rgb;
    }

    private engine : IIntegrator;

    public friction : number;

    private x : number [] =  [];

    private y : number [] =  [];

    private k : number [] =  [];

    private r : number [] =  [];

    private col : number[] = [
                ModelMagPend.rgb2hex(255, 255, 255),
                ModelMagPend.rgb2hex(200,  30,  30),
                ModelMagPend.rgb2hex( 30, 200,  30),
                ModelMagPend.rgb2hex( 30,  30, 200),
                ModelMagPend.rgb2hex(179, 178,  86),
                ModelMagPend.rgb2hex(131, 255,   0),
                ModelMagPend.rgb2hex(255, 194,   0),
                ModelMagPend.rgb2hex(255,   0, 162),
                ModelMagPend.rgb2hex(152,   0, 255),
                ModelMagPend.rgb2hex(  0,  67, 255),
                ModelMagPend.rgb2hex(  0, 245, 255),
                ModelMagPend.rgb2hex(  0, 255,  76),
                ModelMagPend.rgb2hex(179, 134,  86),
                ModelMagPend.rgb2hex(  0,  64,  64),
                ModelMagPend.rgb2hex(133, 147, 142),
                ModelMagPend.rgb2hex(128,   0,  64),
                ModelMagPend.rgb2hex(255,   0,   0) ];

    private abort : boolean = false;

    public restIdx : number = 0;

    private game : Phaser.Game;

    private gfx : Phaser.Graphics;

    constructor(game : Phaser.Game) {
        this.game = game;

        this.friction = 0.001;

        // pendulum mount 
        this.x.push(0); 
        this.y.push(0); 
        this.k.push(0.00001); //0.00001); 
        this.r.push(20);

        // inner ring of magnets 
        let rad : number = 300;
        for (var i = 0; i < 360; i += 120 /* 72 */) {
            this.x.push(rad * Math.sin(i*Math.PI/180.0)); 
            this.y.push(rad * Math.cos(i*Math.PI/180.0)); 
            this.k.push(150); 
            this.r.push(30);
        }

        // all arrays must hav equal length!
        Debug.assert(this.x.length == this.y.length);
        Debug.assert(this.x.length == this.r.length);
        Debug.assert(this.x.length == this.k.length);
    }


    public eval(state : number[], time : number, deriv : number[]) : void {
        // velocity
        let vel_x : number = state[0];
        let vel_y : number = state[1];

        // position
        let pos_x : number = state[2];
        let pos_y : number = state[3];

        // Pendel
        let acc_x : number = 0;
        let acc_y : number = 0;

        let checkAbort : boolean = false;

        let n = this.x.length;
        for (var i = 0; i < n; ++i) {
            let xx : number = this.x[i];
            let yy : number = this.y[i];
            let f : number = this.k[i];
            let r : number = this.r[i];

            if (i==0) {
                acc_x += f * (xx - pos_x);
                acc_y += f * (yy - pos_y);
            } else {
                let d : number = Math.sqrt( (xx - pos_x) * (xx - pos_x) +
                                            (yy - pos_y) * (yy - pos_y) + 
                                            15 * 15);

                if (d < r)
                    checkAbort = true;
      
                let dddd : number = d*d*d; //*d;
                acc_x += (f / dddd) * (xx - pos_x);
                acc_y += (f / dddd) * (yy - pos_y);
            }
        }

        // Friction
        acc_x -= this.friction * vel_x;
        acc_y -= this.friction * vel_y;

        // derivation of the state array
        deriv[0] = acc_x;
        deriv[1] = acc_y;
        deriv[2] = vel_x;
        deriv[3] = vel_y;

        this.abort = checkAbort && ( (vel_x * vel_x + vel_y * vel_y) < 4);
    }


    public getName() : string {
        return "Magnetic Pendulum";
    }

    /**
     * Dimension of the state vector of the model.
     */
    public getDim() : number {
        return 4;
    }

    public isFinished(state : number[]) : boolean {
        if (!this.abort) 
            return false;

        let pos_x : number = state[2];
        let pos_y : number = state[3];

        let minDist : number =  Number.MAX_VALUE;
            
        let n = this.x.length;
        for (var i = 0; i < n; ++i) {
            let xx = this.x[i];
            let yy = this.y[i];

            let dist : number = Math.sqrt( (xx - pos_x) * (xx - pos_x) +
                                           (yy - pos_y) * (yy - pos_y) );      

            if (dist < minDist) {
                    this.restIdx = i;
                    minDist = dist;
            }
        }

        return this.abort;
    }

    public setEngine(engine : IIntegrator) : void {
        this.engine = engine;
    }


    //---------------------------------------------------------------------------------------------
    //  IRenderer interface
    //---------------------------------------------------------------------------------------------

    public create() : void {
        this.gfx = this.game.add.graphics(0,0);

        // Pendulum Mount Point
        this.gfx.lineStyle(3, this.col[0], 1)
        this.gfx.moveTo(this.x[0] - this.r[0], this.y[0]);
        this.gfx.lineTo(this.x[0] + this.r[0], this.y[0]);
        this.gfx.moveTo(this.x[0], this.y[0] - this.r[0]);
        this.gfx.lineTo(this.x[0], this.y[0] + this.r[0]);

        // Magnets
        this.gfx.lineStyle(0)
        let n = this.x.length;
        for (var i=1; i<n; ++i) {
            this.gfx.beginFill(this.col[i]);
            this.gfx.drawCircle(this.x[i], this.y[i], 2*this.r[i]);
            this.gfx.endFill();            
        }
    }

    public update() : void {
    }
    
    public render() : void {
    }
}