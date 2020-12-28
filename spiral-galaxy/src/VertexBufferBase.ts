import { mat4 } from 'gl-matrix'

export class AttributeDefinition
{
    constructor(
        attribIdx : number = 0,
        size : number = 0,
        type : number = 0,
        offset : number = 0)
    {
        this.attribIdx = attribIdx;
        this.size = size;
        this.type = type;
        this.offset = offset;
    }

    attribIdx : number = 0;
    size : number = 0;
    type : number = 0;
    offset : number = 0;
}


export abstract class VertexBufferBase<TVertex>
{
    private vbo : WebGLBuffer | null = null;
	private ibo : WebGLBuffer | null = null;
	private vao : WebGLBuffer | null = null;

	private vert : TVertex[] = [];
	private idx : number[] = [];

	protected shaderProgram? : WebGLProgram | null = null;
	private primitiveType : number = 0;

	protected bufferMode : number = 0;
    protected readonly gl : WebGLRenderingContext;

    private attributes : AttributeDefinition[] = [];

    public constructor(gl : WebGLRenderingContext, bufferMode : number)
	{
        this.gl = gl;
		this.bufferMode = bufferMode;
    }
    
    protected defineAttributes(attribList : AttributeDefinition[] ) : void
	{
		this.attributes = [];
        
        for (let i=0; i<attribList.length; ++i)
		{
            this.attributes.push(attribList[i]);
        }
	}

    protected abstract  getVertexShaderSource() : string;

    protected abstract getFragmentShaderSource() : string;

	private createShader(shaderType : number, shaderSource : string) : WebGLShader
	{
		let shader : WebGLShader = this.gl.createShader(shaderType) as WebGLShader;
		this.gl.shaderSource(shader, shaderSource);
		this.gl.compileShader(shader);

		let isCompiled : number = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
		if (!isCompiled)
		{
			let msg = this.gl.getShaderInfoLog(shader);

			// We don't need the shader anymore.
			this.gl.deleteShader(shader);
			throw new Error("VertexBuffer: Shader compilation failed: " + msg);
		}

		return shader;
	}
	
	public initialize() : void
	{
		this.vbo = this.gl.createBuffer();
		this.ibo = this.gl.createBuffer();
		this.vao = this.gl.createBuffer();

		let  srcVertex : string = this.getVertexShaderSource();
		let vertexShader : WebGLShader = this.createShader(this.gl.VERTEX_SHADER, srcVertex);

		let srcFragment : string = this.getFragmentShaderSource();
		let fragmentShader : WebGLShader = this.createShader(this.gl.FRAGMENT_SHADER, srcFragment);

		this.shaderProgram = this.gl.createProgram();
		if (this.shaderProgram == null)
			throw new Error("VertexBufferBase.initialize(): shaderProgram cannot be created!");

		this.gl.attachShader(this.shaderProgram, vertexShader);
		this.gl.attachShader(this.shaderProgram, fragmentShader);
		this.gl.linkProgram(this.shaderProgram);

		var linked : any = this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS);
		if (!linked)
		{
			let infoLog : string | null = this.gl.getProgramInfoLog(this.shaderProgram);

			this.gl.deleteProgram(this.shaderProgram);
			this.gl.deleteShader(vertexShader);
			this.gl.deleteShader(fragmentShader);

			throw new Error("VertexBufferBase.initialize():: shader program linking failed!\r\n" + infoLog);
		}

		// Always detach shaders after a successful link.
		this.gl.detachShader(this.shaderProgram, vertexShader);
		this.gl.detachShader(this.shaderProgram, fragmentShader);
	}

	public draw(matView : mat4, matProjection : mat4) : void
	{
		if (this.shaderProgram==null)
			throw new Error("VertexBufferBase.draw(): shader program is null!");
		
		this.gl.useProgram(this.shaderProgram);

		let viewMatIdx = this.gl.getUniformLocation(this.shaderProgram, "viewMat");
		let projMatIdx = this.gl.getUniformLocation(this.shaderProgram, "projMat");
/*
		this.gl.uniformMatrix4fv(viewMatIdx, 1, GL_FALSE, glm::value_ptr(matView));
		this.gl.uniformMatrix4fv(projMatIdx, 1, GL_FALSE, glm::value_ptr(matProjection));

		this.onSetCustomShaderVariables();

		this.gl.enable(this.gl.PRIMITIVE_RESTART);
		this.gl.enable(this.gl.BLEND);
		this.gl.primitiveRestartIndex(0xFFFF);

		this.onBeforeDraw();

		glBindVertexArray(_vao);
		glDrawElements(_primitiveType, (int)_idx.size(), GL_UNSIGNED_INT, nullptr);
		glBindVertexArray(0);

		this.gl.disable(GL_BLEND);
		glDisable(GL_PRIMITIVE_RESTART);
*/		
		this.gl.useProgram(0);
	}
/*
	void Release()
	{
		ReleaseAttribArray();

		glBindBuffer(GL_ARRAY_BUFFER, 0);
		glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
		glBindVertexArray(0);

		if (_vbo != 0)
			glDeleteBuffers(1, &_vbo);

		if (_ibo != 0)
			glDeleteBuffers(1, &_ibo);

		if (_vao != 0)
			glDeleteVertexArrays(1, &_vao);
	}

	void CreateBuffer(const std::vector<TVertex>& vert, const std::vector<int>& idx, GLuint type)  noexcept(false)
	{
		_vert = vert;
		_idx = idx;
		_primitiveType = type;

		glBindBuffer(GL_ARRAY_BUFFER, _vbo);
		glBufferData(GL_ARRAY_BUFFER, _vert.size() * sizeof(TVertex), _vert.data(), _bufferMode);

		glBindVertexArray(_vao);
		glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, _ibo);

		// Set up vertex buffer array
		glBindBuffer(GL_ARRAY_BUFFER, _vbo);

		// Set up vertex buffer attributes
		for (const AttributeDefinition &attrib : _attributes)
		{
			glEnableVertexAttribArray(attrib.attribIdx);
			if (attrib.type == GL_INT)
			{
				glVertexAttribIPointer(attrib.attribIdx, attrib.size, GL_INT, sizeof(TVertex), (GLvoid*)attrib.offset);
			}
			else
			{
				glVertexAttribPointer(attrib.attribIdx, attrib.size, attrib.type, GL_FALSE, sizeof(TVertex), (GLvoid*)attrib.offset);
			}
		}

		// Set up index buffer array
		glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, _ibo);
		glBufferData(GL_ELEMENT_ARRAY_BUFFER, _idx.size() * sizeof(int), _idx.data(), GL_STATIC_DRAW);

		auto errc = glGetError();
		if (errc != GL_NO_ERROR)
		{
			std::stringstream ss;
			ss << "VertexBufferBase: Cannot create vbo! (Error 0x" << std::hex << errc << ")" << std::endl;
			throw std::runtime_error(ss.str());
		}

		glBindVertexArray(0);
	}

	void UpdateBuffer(const std::vector<TVertex>& vert) noexcept(false)
	{
		if (_bufferMode == GL_STATIC_DRAW)
			throw std::runtime_error("VertexBufferBase: static buffers cannot be updated!");

		glBindBuffer(GL_ARRAY_BUFFER, _vbo);
		glBufferSubData(GL_ARRAY_BUFFER, 0, _vert.size() * sizeof(TVertex), vert.data());
		glBindBuffer(GL_ARRAY_BUFFER, 0);
	}

	virtual void OnSetCustomShaderVariables()
	{}



	void ReleaseAttribArray() const 
	{
		for (const auto &attrib : _attributes)
		{
			glDisableVertexAttribArray(attrib.attribIdx);
		}
	}

	virtual void OnBeforeDraw() 
	{
	}

protected:

	struct AttributeDefinition
	{
		int attribIdx;
		int size;
		int type;
		uintptr_t offset;
	};

	int GetPrimitiveType() const
	{
		return _primitiveType;
	}

	int GetArrayElementCount() const
	{
		return (int)_idx.size();
	}

	GLuint GetVertexArrayObject() const
	{
		return _vao;
	}

private:


*/    
}
