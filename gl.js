function Program(prog, gl) {
    var uniformSetters = Program.createUniformSettersMap(gl);
    var uniforms = {};
    var attributes = {};

    var unifs = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < unifs; i++) {
        var info = gl.getActiveUniform(prog, i);
        var name = info.name;
        var setter = uniformSetters.get(info.type);
        if (setter === undefined)
            throw "unsupported type for: " + name;
        uniforms[name] = {
            location: gl.getUniformLocation(prog, name),
            setter: setter.bind(gl)
        };
    }

    var atribs = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
    for (var i = 0; i < atribs; i++) {
        var info = gl.getActiveAttrib(prog, i);
        var name = info.name;
        attributes[name] = {
            location: gl.getAttribLocation(prog, name)
        };
    }

    this.use = function () {
        gl.useProgram(prog);
    };

    this.enableAttribute = function (name) {
        gl.enableVertexAttribArray(attributes[name].location);
    };

    this.disableAttribute = function (name) {
        gl.disableVertexAttribArray(attributes[name].location);
    };

    this.attribute = function (name, buffer, size, type, normalized, stride, offset) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(attributes[name].location, size, type, normalized, stride, offset);
    };

    this.uniform = function (name, ...values) {
        uniforms[name].setter(uniforms[name].location, ...values);
    };
}

Program.createUniformSettersMap = function(gl) {
    var map = new Map();
    map.set(gl.FLOAT_VEC2, gl.uniform2f);
    map.set(gl.FLOAT_VEC3, gl.uniform3f);
    map.set(gl.FLOAT_MAT4, gl.uniformMatrix4fv);
    map.set(gl.SAMPLER_2D, gl.uniform1i);
    return map;
};

Program.create = function (vertexShaderSrc, fragmentShaderSrc, gl) {
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSrc);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        throw "vertex shader compilation failed: " + gl.getShaderInfoLog(vertexShader);

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSrc);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        throw "fragment shader compilation failed: " + gl.getShaderInfoLog(fragmentShader);

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw "program linkage failed: " + gl.getProgramInfoLog(program);

    return new Program(program, gl);
};
