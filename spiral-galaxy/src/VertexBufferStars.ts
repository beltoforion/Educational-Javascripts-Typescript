import { Vec3, Color, VertexStar, Star } from './Types'
import { mat4 } from 'gl-matrix'
import { VertexBufferBase, AttributeDefinition } from './VertexBufferBase'


export class VertexBufferStars extends VertexBufferBase<VertexStar>
{
	private pertN : number = 0;
	private dustSize : number = 0;
	private pertAmp : number = 0;
	private time : number = 0;
	private blendFunc : number = 0;
	private blendEquation : number = 0;
    private displayFeatures : number = 0;

    private readonly attTheta0 : number = 0;
    private readonly attVelTheta : number = 1;
    private readonly attTiltAngle : number = 2;
    private readonly attSemiMajorAxis : number = 3;
    private readonly attSemiMinorAxis : number = 4;
    private readonly attTemperature : number = 5;
    private readonly attMagnitude : number = 6;
    private readonly attType : number = 7;
    private readonly attColor : number = 8;

    constructor(gl : WebGLRenderingContext, blendEquation : number, blendFunc : number)
    {
        super(gl, gl.STATIC_DRAW)

        this.blendFunc = blendFunc;
        this.blendEquation = blendEquation;

        this.defineAttributes([
            new AttributeDefinition(this.attTheta0,        1, gl.FLOAT, 0),
            new AttributeDefinition(this.attVelTheta,      1, gl.FLOAT, 4),
            new AttributeDefinition(this.attTiltAngle,     1, gl.FLOAT, 8),
            new AttributeDefinition(this.attSemiMajorAxis, 1, gl.FLOAT, 12),
            new AttributeDefinition(this.attSemiMinorAxis, 1, gl.FLOAT, 16),
            new AttributeDefinition(this.attTemperature,   1, gl.FLOAT, 20),
            new AttributeDefinition(this.attMagnitude,     1, gl.FLOAT, 24),
            new AttributeDefinition(this.attType,          1, gl.INT, 30),
            new AttributeDefinition(this.attColor,         4, gl.FLOAT, Object.keys(Star).length)
        ]);
    }

    public updateShaderVariables(time : number, num : number, amp : number, dustSize : number, displayFeatures : number) : void
	{
		this.pertN = num;
		this.pertAmp = amp;
		this.time = time;
		this.dustSize = dustSize;
		this.displayFeatures = displayFeatures;
	}

	protected getVertexShaderSource() : string
	{
		return `
			uniform mat4 projMat;
			uniform mat4 viewMat;
			uniform int pertN;
			uniform int dustSize;
			uniform int displayFeatures;
			uniform float pertAmp;
			uniform float time;
			uniform float DEG_TO_RAD = 0.01745329251;

			layout(location = 0) in float theta0;
			layout(location = 1) in float velTheta;
			layout(location = 2) in float tiltAngle;
			layout(location = 3) in float a;
			layout(location = 4) in float b;
			layout(location = 5) in float temp;
			layout(location = 6) in float mag;
			layout(location = 7) in int type;
			layout(location = 8) in vec4 color;

			out vec4 vertexColor;
			flat out int vertexType;
			flat out int features;

			vec2 calcPos(float a, float b, float theta, float velTheta, float time, float tiltAngle) {
				float thetaActual = theta + velTheta * time;
				float beta = -tiltAngle;
				float alpha = thetaActual * DEG_TO_RAD;
				float cosalpha = cos(alpha);
				float sinalpha = sin(alpha);
				float cosbeta = cos(beta);
				float sinbeta = sin(beta);
				vec2 center = vec2(0,0);
				vec2 ps = vec2(center.x + (a * cosalpha * cosbeta - b * sinalpha * sinbeta),
						       center.y + (a * cosalpha * sinbeta + b * sinalpha * cosbeta));
				if (pertAmp > 0 && pertN > 0) {
					ps.x += (a / pertAmp) * sin(alpha * 2 * pertN);
					ps.y += (a / pertAmp) * cos(alpha * 2 * pertN);
				}
			return ps;
			}

			void main()
			{
				vec2 ps = calcPos(a, b, theta0, velTheta, time, tiltAngle);
                
                if (type==0) {
					gl_PointSize = mag * 4;
				    vertexColor = color * mag ;
				} else if (type==1) {"	
					gl_PointSize = mag * 5 * dustSize;
				    vertexColor = color * mag;
				} else if (type==2) {"
					gl_PointSize = mag * 2 * dustSize;
				    vertexColor = color * mag;
				} else if (type==3) {
					vec2 ps2 = calcPos(a + 1000, b, theta0, velTheta, time, tiltAngle);
					float dst = distance(ps, ps2);
					float size = ((1000 - dst) / 10) - 50;
					gl_PointSize = size;
				    vertexColor = color * mag * vec4(2, 0.5, 0.5, 1);
				} else if (type==4) {
					vec2 ps2 = calcPos(a + 1000, b, theta0, velTheta, time, tiltAngle);
					float dst = distance(ps, ps2);
					float size = ((1000 - dst) / 10) - 50;
					gl_PointSize = size/10;
				    vertexColor = vec4(1,1,1,1);
			   }
				gl_Position =  projMat * vec4(ps, 0, 1);
				vertexType = type;
				features = displayFeatures;
			}`;
	}

	protected getFragmentShaderSource() : string
	{
		return `
			in vec4 vertexColor;
			flat in int vertexType;
			flat in int features;
			out vec4 FragColor;
			void main()
			{
				if (vertexType==0) {
					if ( (features & 1) ==0)
						discard;
					FragColor = vertexColor;
					vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
					float alpha =1-length(circCoord);
					FragColor = vec4(vertexColor.xyz, alpha);
				} else if (vertexType==1) {
					if ( (features & 2) ==0)
						discard;
					vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
					float alpha = 0.05 * (1-length(circCoord));
					FragColor = vec4(vertexColor.xyz, alpha);
				} else if (vertexType==2) {
					if ( (features & 4) ==0)
						discard;
					vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
					float alpha = 0.07 * (1-length(circCoord));
					FragColor = vec4(vertexColor.xyz, alpha);
				} else if (vertexType==3) {
					if ((features & 8) == 0)
						discard;
					vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
					float alpha = 1-length(circCoord);
					FragColor = vec4(vertexColor.xyz, alpha);
				} else if (vertexType==4) {
					if ((features & 8)== 0)
						discard;
					vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
					float alpha = 1-length(circCoord);
					FragColor = vec4(vertexColor.xyz, alpha);
			   }
			}`;
    }
    
    protected onSetCustomShaderVariables() : void
	{
        if (this.shaderProgram==null)
            throw new Error("onSetCustomShaderVariables(): Shader program is null!");

		let varDustSize = this.gl.getUniformLocation(this.shaderProgram, "dustSize");
		this.gl.uniform1i(varDustSize, this.dustSize);

		let varPertN = this.gl.getUniformLocation(this.shaderProgram, "pertN");
		this.gl.uniform1i(varPertN, this.pertN);

		let varPertAmp = this.gl.getUniformLocation(this.shaderProgram, "pertAmp");
		this.gl.uniform1f(varPertAmp, this.pertAmp);

		let varTime = this.gl.getUniformLocation(this.shaderProgram, "time");
		this.gl.uniform1f(varTime, this.time);

		let varDisplayFeatures = this.gl.getUniformLocation(this.shaderProgram, "displayFeatures");
		this.gl.uniform1i(varDisplayFeatures, this.displayFeatures);
    }
    
    public draw(matView : mat4, matProjection: mat4) : void
	{
        if (this.shaderProgram==null)
            throw new Error("draw(...): Shader program is null!");

		this.gl.useProgram(this.shaderProgram);
/*
		let viewMatIdx = this.gl.getUniformLocation(this.shaderProgram, "viewMat");
		this.gl.uniformMatrix4fv(viewMatIdx, 1, this.gl.FALSE, glm::value_ptr(matView));

		let projMatIdx = this.gl.getUniformLocation(this.shaderProgram, "projMat");
		this.gl.uniformMatrix4fv(projMatIdx, 1, GL_FALSE, glm::value_ptr(matProjection));

		this.onSetCustomShaderVariables();

		this.gl.enable(this.gl.BLEND);
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.blendFunc);
		this.gl.blendEquation(this.blendEquation);
		this.gl.enable(this.gl.PROGRAM_POINT_SIZE);
		this.gl.enable(this.gl.POINT_SPRITE);
        
        this.onBeforeDraw();

		glBindVertexArray(GetVertexArrayObject());
		glDrawElements(GetPrimitiveType(), GetArrayElementCount(), GL_UNSIGNED_INT, nullptr);
		glBindVertexArray(0);

		glDisable(GL_POINT_SPRITE);
		glDisable(GL_PROGRAM_POINT_SIZE);
		glDisable(GL_BLEND);
		glBlendEquation(GL_FUNC_ADD);
*/
		this.gl.useProgram(0);
	}
}
