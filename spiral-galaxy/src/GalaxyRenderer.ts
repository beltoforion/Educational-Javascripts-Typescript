import { mat4 } from 'gl-matrix'

import { Vec3, VertexColor } from './Types' 
import { Helper } from './Helper'
import { VertexBufferLines } from './VertexBufferLines'
import { VertexBufferStars } from './VertexBufferStars';
import { Galaxy } from './Galaxy'

enum DisplayItem {
    NONE          = 0,
    AXIS          = 0b0000000001,
    STARS         = 0b0000000010,
    HELP          = 0b0000001000,
    DENSITY_WAVES = 0b0000100000,
    VELOCITY      = 0b0001000000,
    DUST          = 0b0010000000,
    H2            = 0b0100000000,
    FILAMENTS     = 0b1000000000,
}


enum RenderUpdateHint {
    NONE = 0,
    DENSITY_WAVES = 1 << 1,
    AXIS = 1 << 2,
    STARS = 1 << 3,
    DUST = 1 << 4,
    CREATE_VELOCITY_CURVE = 1 << 5,
    CREATE_TEXT = 1 << 7
}


export class GalaxyRenderer {
    private canvas : HTMLCanvasElement;
    private gl : WebGL2RenderingContext;

	private vertDensityWaves : VertexBufferLines | null = null;
	private vertAxis : VertexBufferLines | null = null;
	private vertVelocityCurve : VertexBufferLines| null = null;
    private vertStars : VertexBufferStars | null = null;

    private fov : number = 0;

    private matProjection : mat4 = mat4.create();
	private matView : mat4 = mat4.create();

	private camPos : Vec3 = new Vec3();
	private camLookAt : Vec3 = new Vec3();
	private camOrient : Vec3 = new Vec3();

    private time : number = 0;
    private flags : DisplayItem = DisplayItem.STARS | DisplayItem.AXIS | DisplayItem.HELP | DisplayItem.DUST | DisplayItem.H2 | DisplayItem.FILAMENTS;

    private renderUpdateHint : RenderUpdateHint = RenderUpdateHint.DENSITY_WAVES | RenderUpdateHint.AXIS | RenderUpdateHint.STARS | RenderUpdateHint.DUST | RenderUpdateHint.CREATE_VELOCITY_CURVE | RenderUpdateHint.CREATE_TEXT;

    private galaxy : Galaxy = new Galaxy();

    private readonly TimeStepSize : number = 100000.0;

    public constructor(canvas : HTMLCanvasElement) {
        this.canvas = canvas;

        this.gl = this.canvas.getContext("webgl2") as WebGL2RenderingContext;
        if (this.gl === null)
            throw new Error("Unable to initialize WebGL2. Your browser may not support it.");

//	    this.vertDensityWaves.initialize();
        this.vertAxis = new VertexBufferLines(this.gl, 1, this.gl.STATIC_DRAW);
//        this.vertDensityWaves = new VertexBufferLines(this.gl, 2, this.gl.STATIC_DRAW);
//	    this.vertVelocityCurve = new VertexBufferLines(this.gl, 1, this.gl.DYNAMIC_DRAW);

        this.initGL(this.gl);

        // Start the main loop
        window.requestAnimationFrame((timeStamp) => this.mainLoop(timeStamp));
    }

    private initGL(gl : WebGL2RenderingContext) : void {
        if (this.vertAxis==null)
            throw new Error("initGL(): vertAxis is null!");

        this.vertAxis.initialize();
//	    this.vertVelocityCurve.initialize();
//	    this.vertStars.initialize();

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(this.gl.COLOR_BUFFER_BIT);

        // GL initialization
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    	gl.disable(gl.DEPTH_TEST);
	    gl.clearColor(0.0, .0, 0.08, 0.0);
	    this.setCameraOrientation(new Vec3(0, 1, 0));
    }

    private setCameraOrientation(orient : Vec3) : void {   
	    this.camOrient = orient;
	    this.adjustCamera();
    }

    private adjustCamera() : void {
	    let l : number = this.fov / 2.0;
	    let aspect : number = this.canvas.width / this.canvas.height;

	    mat4.ortho(
            this.matProjection,
    	 	-l * aspect, l * aspect, 
	     	-l, l, 
		    -l, l);
	
    	// glm::dvec3 camPos(_camPos.x, _camPos.y, _camPos.z);
    	// glm::dvec3 camLookAt(_camLookAt.x, _camLookAt.y, _camLookAt.z);
	    // glm::dvec3 camOrient(_camOrient.x, _camOrient.y, _camOrient.z);
        // _matView = glm::lookAt(camPos, camLookAt, camOrient);
    }

    private updateAxis() : void {
        if (this.vertAxis==null)
            throw new Error("Galaxyrenderer.updateAxis(): this.vertAxis is null!");

        console.log("updating axis data.");

        let vert : VertexColor[] = [];
        let idx : number[] = [];

        let s : number = Math.pow(10, (Math.log10(this.fov / 2)));
        let l : number = this.fov / 100;
        let p : number = 0;

        let r : number = 0.3;
        let g : number = 0.3;
        let b : number = 0.3;
        let a : number = 0.8;
    
        for (let i = 0; p < this.fov; ++i)
        {
            p += s;
            idx.push(vert.length);
            vert.push(new VertexColor(p, -l, 0, r, g, b, a));
    
            idx.push(vert.length);
            vert.push(new VertexColor( p,  l, 0, r, g, b, a ));
    
            idx.push(vert.length);
            vert.push(new VertexColor( -p, -l, 0, r, g, b, a ));
    
            idx.push(vert.length);
            vert.push(new VertexColor( -p,  0, 0, r, g, b, a ));
    
            idx.push(vert.length);
            vert.push(new VertexColor( -l, p, 0, r, g, b, a ));
    
            idx.push(vert.length);
            vert.push(new VertexColor( 0, p, 0, r, g, b, a ));
    
            idx.push(vert.length);
            vert.push(new VertexColor( -l, -p, 0, r, g, b, a ));
    
            idx.push(vert.length);
            vert.push(new VertexColor( 0, -p, 0, r, g, b, a ));
        }
    
        idx.push(vert.length);
        vert.push(new VertexColor( -this.fov, 0, 0, r, g, b, a ));
    
        idx.push(vert.length);
        vert.push(new VertexColor( this.fov, 0, 0, r, g, b, a ));
    
        idx.push(vert.length);
        vert.push(new VertexColor( 0, -this.fov, 0, r, g, b, a ));
    
        idx.push(vert.length);
        vert.push(new VertexColor( 0, this.fov, 0, r, g, b, a ));
    
        this.vertAxis.createBuffer(vert, idx, this.gl.LINES);
        this.renderUpdateHint &= ~RenderUpdateHint.AXIS;        
    }

    private updateDensityWaves() : void {
//        console.log("updating density waves.");
    }

    private updateStars() : void {
//        console.log("updating stars.");
    }

    private updateVelocityCurve(updateOnly : boolean) : void {
//        console.log("updating velocity curves.");
    }

    private updateText() : void {
//        console.log("updating text.");
    }

    private update() : void {
        this.time += this.TimeStepSize;

        if ((this.renderUpdateHint & RenderUpdateHint.AXIS) != 0)
            this.updateAxis();

        if ((this.renderUpdateHint & RenderUpdateHint.DENSITY_WAVES) != 0)
            this.updateDensityWaves();

        if ((this.renderUpdateHint & RenderUpdateHint.STARS) != 0)
            this.updateStars();

        if ((this.renderUpdateHint & RenderUpdateHint.CREATE_VELOCITY_CURVE) != 0)
            this.updateVelocityCurve(false);

        if ((this.flags & DisplayItem.VELOCITY) != 0)
            this.updateVelocityCurve(true); // Update Data Only, no buffer recreation!

        if ((this.renderUpdateHint & RenderUpdateHint.CREATE_TEXT) != 0)
            this.updateText();

        this.camOrient = new Vec3(0, 1, 0 );
        this.camPos = new Vec3(0, 0, 5000);
        this.camLookAt = new Vec3(0, 0, 0);
    }

    private render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.adjustCamera();

        if (this.vertAxis!=null && this.flags & DisplayItem.AXIS)
        {
            this.vertAxis.draw(this.matView, this.matProjection);
//            this.textAxisLabel.draw(_width, _height, _matView, _matProjection);
        }

        let features : number = 0;
        if (this.flags & DisplayItem.STARS)
            features |= 1 << 0;
    
        if (this.flags & DisplayItem.DUST)
            features |= 1 << 1;
    
        if (this.flags & DisplayItem.FILAMENTS)
            features |= 1 << 2;
    
        if (this.flags & DisplayItem.H2)
            features |= 1 << 3;

        if (this.vertStars!=null && features != 0)
        {
            this.vertStars.updateShaderVariables(this.time, this.galaxy.pertN, this.galaxy.pertAmp, this.galaxy.dustRenderSize, features);
            this.vertStars.draw(this.matView, this.matProjection);
        }

        if (this.vertDensityWaves!=null && this.flags & DisplayItem.DENSITY_WAVES)
        {
            this.vertDensityWaves.draw(this.matView, this.matProjection);
//            this.textGalaxyLabels.Draw(this.canvas.width, this.canvas.height, this.matView, this.matProjection);
        }
    
        if (this.vertVelocityCurve!=null && this.flags & DisplayItem.VELOCITY)
        {
//            this.gl.pointSize(2);
            this.vertVelocityCurve.draw(this.matView, this.matProjection);
        }
    
        // if (this.flags & DisplayItem.HELP)
        // {
        //     this.textHelp.draw(this.canvas.width, this.canvas.height, this.matView, this.matProjection);
        // }
    }

    public mainLoop(timestamp : any) {
        try
        {
            this.update();
            this.render();
        }
        catch(Error)
        {
            console.log(Error.message);
        }
        finally
        {
            window.requestAnimationFrame( (timestamp)=>this.mainLoop(timestamp) );
        }
    }

}
