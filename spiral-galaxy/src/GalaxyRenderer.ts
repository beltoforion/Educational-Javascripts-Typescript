import { mat4,  vec3 } from 'gl-matrix'

import { Color, GalaxyParam, Vec3, VertexColor, VertexStar, Star } from './Types' 
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
    CREATE_VELOCITY_CURVE = 1 << 5
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

	private camPos : vec3 = vec3.create();
	private camLookAt : vec3 = vec3.create();
	private camOrient : vec3 = vec3.create();

    private time : number = 0;
    private flags : DisplayItem = DisplayItem.VELOCITY | DisplayItem.STARS | DisplayItem.AXIS | DisplayItem.HELP | DisplayItem.DUST | DisplayItem.H2 | DisplayItem.FILAMENTS;

//    private renderUpdateHint : RenderUpdateHint = RenderUpdateHint.DUST;
    private renderUpdateHint : RenderUpdateHint = RenderUpdateHint.STARS |RenderUpdateHint.DENSITY_WAVES | RenderUpdateHint.AXIS | RenderUpdateHint.CREATE_VELOCITY_CURVE;

    private galaxy : Galaxy = new Galaxy();

    private readonly TimeStepSize : number = 100000.0;

    public constructor(canvas : HTMLCanvasElement) {
        this.canvas = canvas;

        this.gl = this.canvas.getContext("webgl2") as WebGL2RenderingContext;
        if (this.gl === null)
            throw new Error("Unable to initialize WebGL2. Your browser may not support it.");

	    this.vertDensityWaves = new VertexBufferLines(this.gl, 2, this.gl.STATIC_DRAW);
        this.vertAxis = new VertexBufferLines(this.gl, 1, this.gl.STATIC_DRAW);
	    this.vertVelocityCurve = new VertexBufferLines(this.gl, 1, this.gl.DYNAMIC_DRAW);
        this.vertStars = new VertexBufferStars(this.gl)

        document.addEventListener('keydown', (event) => this.onKeydown(event));

        this.initGL(this.gl);
        this.initSimulation();

        // Start the main loop
        window.requestAnimationFrame((timeStamp) => this.mainLoop(timeStamp));
    }

    private onKeydown(event : KeyboardEvent) {
        const keyName = event.key;
        console.log("Key " + keyName + " pressed")

        switch(keyName)
        {
            case 'F6':
                this.flags ^= DisplayItem.DENSITY_WAVES;
                break;

            case '+':
                this.scaleAxis(1.1);
                this.setCameraOrientation(vec3.fromValues(0, 1, 0));
                this.renderUpdateHint |= RenderUpdateHint.AXIS | RenderUpdateHint.DENSITY_WAVES;  // ruhDENSITY_WAVES only for the labels!
                break;

            case '-':
                this.scaleAxis(0.9);
                this.setCameraOrientation(vec3.fromValues(0, 1, 0));
                this.renderUpdateHint |= RenderUpdateHint.AXIS | RenderUpdateHint.DENSITY_WAVES;  // ruhDENSITY_WAVES only for the labels!
                break;    
                
            case 'v':
                this.flags ^= DisplayItem.VELOCITY;
                break;

            case 'm':
                this.galaxy.toggleDarkMatter();
                this.renderUpdateHint |= RenderUpdateHint.STARS | RenderUpdateHint.DUST | RenderUpdateHint.CREATE_VELOCITY_CURVE;
                break;
        }
    }

    private scaleAxis(scale : number) : void {
        this.fov *= scale;
	    this.adjustCamera();
    }

    private initSimulation() {
        let param = new GalaxyParam(
            13000,		// radius of the galaxy
            4000,		// radius of the core
            0.0004,	    // angluar offset of the density wave per parsec of radius
            0.85,		// excentricity at the edge of the core
            0.95,		// excentricity at the edge of the disk
            100000,		// total number of stars
            true,		// has dark matter
            2,			// Perturbations per full ellipse
            40,			// Amplitude damping factor of perturbation
            70,			// dust render size in pixel
            4000)
            
        this.galaxy.reset(param)
        this.fov = 35000;
    }
    private initGL(gl : WebGL2RenderingContext) : void {
        if (this.vertAxis==null)
            throw new Error("initGL(): vertAxis is null!");

        if ( this.vertDensityWaves==null)
            throw new Error("initGL(): vertDensityWaves is null!");

        if ( this.vertVelocityCurve==null)
            throw new Error("initGL(): vertVelocityCurve is null!");

        if ( this.vertStars==null)
            throw new Error("initGL(): vertStars is null!");

        this.vertAxis.initialize();
        this.vertDensityWaves.initialize();
	    this.vertVelocityCurve.initialize();
	    this.vertStars.initialize();

        // GL initialization
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    	gl.disable(gl.DEPTH_TEST);
        this.setCameraOrientation(vec3.fromValues(0, 1, 0));
    }

    private setCameraOrientation(orient : vec3) : void {   
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
	
        mat4.lookAt(
            this.matView,
            this.camPos, 
            this.camLookAt, 
            this.camOrient);
    }

    private updateAxis() : void {
        if (this.vertAxis==null)
            throw new Error("Galaxyrenderer.updateAxis(): this.vertAxis is null!");

        console.log("updating axis data.");

        let vert : VertexColor[] = [];
        let idx : number[] = [];

        let s : number = Math.pow(10, Math.floor((Math.log10(this.fov / 2))));
        let l : number = this.fov / 100;
        let p : number = 0;

        let r : number = 0.3;
        let g : number = 0.3;
        let b : number = 0.3;
        let a : number = 0.8;
    
        for (let i = 0; p < this.fov; ++i) {
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
        if (this.vertDensityWaves==null)
            throw new Error("GalaxyRenderer.updateDensityWaves(): this.vertDensityWaves is null!")

        console.log("updating density waves.");

        let vert : VertexColor[] = []
        let idx : number[] = []
    
        //
        // First add the density waves
        //

        const num : number = 100;
        let dr : number = this.galaxy.farFieldRad / num;
        for (let i = 0; i <= num; ++i) {
            let r : number = dr * (i + 1);
            this.addEllipsisVertices(
                vert,
                idx,
                r,
                r * this.galaxy.getExcentricity(r),
                Helper.RAD_TO_DEG * this.galaxy.getAngularOffset(r),
                this.galaxy.pertN,
                this.galaxy.pertAmp,
                new Color(1, 1, 1, 0.2));
        }

        //
        // Add three circles at the boundaries of core, galaxy and galactic medium
        //

        const pertNum : number = 0;
        const pertAmp : number = 0;
        let r : number = this.galaxy.coreRad;
        this.addEllipsisVertices(vert, idx, r, r, 0, pertNum, pertAmp, new Color(1, 1, 0, 0.5));
    
        r = this.galaxy.rad;
        this.addEllipsisVertices(vert, idx, r, r, 0, pertNum, pertAmp, new Color(0, 1, 0, 0.5 ));
    
        r = this.galaxy.farFieldRad;
        this.addEllipsisVertices(vert, idx, r, r, 0, pertNum, pertAmp, new Color(1, 0, 0, 0.5));

        this.vertDensityWaves.createBuffer(vert, idx, this.gl.LINE_STRIP);
    
        this.renderUpdateHint &= ~RenderUpdateHint.DENSITY_WAVES;
    }

    private addEllipsisVertices(
        vert : VertexColor[],
        vertIdx : number[],
        a : number,
        b : number,
        angle : number,
        pertNum : number,
        pertAmp : number,
        col : Color) : void
    {
        const steps : number = 100;
        const x : number = 0;
        const y : number = 0;
        
        // Angle is given by Degree Value
        let beta : number = -angle * Helper.DEG_TO_RAD;
        let sinbeta : number = Math.sin(beta);
        let cosbeta : number = Math.cos(beta);
    
        let firstPointIdx : number = vert.length;
        for (let i = 0; i < 360; i += 360 / steps)
        {
            let alpha : number = i * Helper.DEG_TO_RAD;
            let sinalpha = Math.sin(alpha);
            let cosalpha = Math.cos(alpha);
    
            let fx : number = x + (a * cosalpha * cosbeta - b * sinalpha * sinbeta);
            let fy : number = y + (a * cosalpha * sinbeta + b * sinalpha * cosbeta);
    
            if (pertNum > 0)
            {
                fx += ((a / pertAmp) * Math.sin(alpha * 2 * pertNum));
                fy += ((a / pertAmp) * Math.cos(alpha * 2 * pertNum));
            }
    
            vertIdx.push(vert.length);
    
            let vc : VertexColor = new VertexColor(fx, fy, 0, col.r, col.g, col.b, col.a);
            vert.push(vc);
        }
    
        // Close the loop and reset the element index array
        vertIdx.push(firstPointIdx);
        vertIdx.push(4294967295); 
    }
    
    private updateStars() : void {
        if (this.vertStars==null)
            throw new Error("GalaxyRenderer.updateStars(): this.vertStars is null!")

        console.log("updating stars.");

        let vert : VertexStar[] = [];
        let idx : number[] = [];
    
        let stars : Star[] = this.galaxy.stars;
    
        let a : number = 1;
        let color : Color = new Color(1, 1, 1, a);
    
        for (let i = 1; i < stars.length; ++i)
        {
            let col : Color = Helper.colorFromTemperature(stars[i].temp);
            col.a = a;
    
            idx.push(vert.length);
            vert.push(new VertexStar(stars[i], color));
        }
    
        this.vertStars.createBuffer(vert, idx, this.gl.POINTS);
        this.renderUpdateHint &= ~RenderUpdateHint.STARS;
    }

    private updateVelocityCurve() : void {
        if (this.vertVelocityCurve==null)
            throw new Error("GalaxyRenderer.updateVelocityCurve(): this.vertVelocityCurve is null!")

        console.log("updating velocity curves.");

        let vert : VertexColor[] = [];
	    let idx : number[] = [];

        let dt_in_sec : number = this.TimeStepSize * Helper.SEC_PER_YEAR;
	    let r : number = 0 , v : number = 0;
        let cr : number= 0.5, cg : number= 1, cb : number= 1, ca : number= 1;
        
	    for (let r = 0; r < this.galaxy.farFieldRad; r += 100) {
            let v : number = (this.galaxy.hasDarkMatter) 
                ? Helper.velocityWithDarkMatter(r)
                : Helper.velocityWithoutDarkMatter(r)
               
            idx.push(vert.length);
            vert.push(new VertexColor(r,v * 10, 0,  cr, cg, cb, ca));
	    }

        this.vertVelocityCurve.createBuffer(vert, idx, this.gl.POINTS);
        this.renderUpdateHint &= ~RenderUpdateHint.CREATE_VELOCITY_CURVE;
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
            this.updateVelocityCurve();

        this.camOrient = vec3.fromValues(0, 1, 0 );
        this.camPos = vec3.fromValues(0, 0, 5000);
        this.camLookAt = vec3.fromValues(0, 0, 0);
    }

    private render() {
        this.gl.clearColor(0.0, 0.0, 0.1, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.adjustCamera();

        if (this.vertAxis!=null && this.flags & DisplayItem.AXIS)
            this.vertAxis.draw(this.matView, this.matProjection);

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
            this.vertDensityWaves.draw(this.matView, this.matProjection);
    
        if (this.vertVelocityCurve!=null && this.flags & DisplayItem.VELOCITY)
            this.vertVelocityCurve.draw(this.matView, this.matProjection);
    }

    public mainLoop(timestamp : any) {
        let error : boolean = false;
        try
        {
            this.update();
            this.render();
        }
        catch(Error)
        {
            console.log(Error.message);
            error = true;
        }
        finally
        {
            if (!error)
                window.requestAnimationFrame( (timestamp) => this.mainLoop(timestamp) );
        }
    }

}
