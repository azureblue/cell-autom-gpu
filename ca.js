function CA(canvas, board) {
    const size = board.getWidth();
    const bufferSize = size + 2;
    var srcTex, destTex;
    var vertices;
    var texCoords;
    var vertexBuffer;
    var texCoordBuffer;
    var frameBufferSrc, frameBufferDest;
    var gl;
    var cw, ch;
    var currentProgram, drawProgram, caProgram;
    
    init();

    this.updateSize = function() {
        cw = canvas.clientWidth;
        ch = canvas.clientHeight;
    };

    this.iterateAndRender = function() {
        currentProgram = caProgram;
        currentProgram.use();
        caProgram.setCASize(bufferSize);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferDest);
        gl.viewport(0, 0, bufferSize, bufferSize);
        var pixScale = 1 / bufferSize * 2;
        currentProgram.scale(pixScale, -pixScale);
        gl.clearColor(0.0, 0.0, 0.0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        currentProgram.translate(-1, 1);
        this.drawTex(srcTex);
        
        currentProgram = drawProgram;
        currentProgram.use();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cw, ch);
        var pixXScale = 1 / cw * 4;
        var pixYScale = 1 / ch * 4;
        currentProgram.scale(pixXScale, -pixYScale);
        gl.clearColor(0.0, 0.0, 0.0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        currentProgram.translate(-1, 1);       
        this.drawTex(destTex);
        
        var temp = srcTex;
        srcTex = destTex;
        destTex = temp;
        temp = frameBufferDest;
        frameBufferDest = frameBufferSrc;
        frameBufferSrc = temp;
    };

    this.getSize = () => size;

    this.draw = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(currentProgram.posAttr, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(currentProgram.texCordAttr, 2, gl.FLOAT, false, 0, 0);        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.uniform1i(currentProgram.texSamplerUnif, 0);        
        gl.drawArrays(gl.TRIANGLES, 0, 6);        
    };
    
    this.drawTex = function (tex) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(currentProgram.posAttr, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(currentProgram.texCordAttr, 2, gl.FLOAT, false, 0, 0);        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(currentProgram.texSamplerUnif, 0);        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    function initTexture() {
        var texPixelArray = new Uint8Array(size * size * 3);
        var black = new Color(0, 0, 0);
        var white = new Color(255, 255, 255);
        board.iteratePositions((x, y, v) => {
            var idx = (x + y * size) * 3;
            var color = v === 0 ? black : white;            
            texPixelArray[idx + 0] = color.r;
            texPixelArray[idx + 1] = color.g;
            texPixelArray[idx + 2] = color.b;            
        });   

        var srcBufferPixelArray = new Uint8Array(bufferSize * bufferSize * 3);
        board.iteratePositions((x, y, v) => {
            var idx = ((y + 1) * bufferSize + 1 + x) * 3;
            var color = v === 0 ? black : white;            
            srcBufferPixelArray[idx + 0] = color.r;
            srcBufferPixelArray[idx + 1] = color.g;
            srcBufferPixelArray[idx + 2] = color.b;
        });
        
        srcTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, bufferSize, bufferSize, 0, gl.RGB, gl.UNSIGNED_BYTE, srcBufferPixelArray);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        destTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, destTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, bufferSize, bufferSize, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        frameBufferDest = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferDest);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, destTex, 0);
        
        frameBufferSrc = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferSrc);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, srcTex, 0);
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, bufferSize, bufferSize, gl.RGB, gl.UNSIGNED_BYTE, srcBufferPixelArray);
    
        
    }
    
    function DrawProgram() {
        var vertexShaderSrc = `
                attribute vec3 pos;
                attribute vec2 aTexPos;
                uniform mat4 scale;
                uniform vec4 translation;
                varying vec2 vTexPos;
        
                void main(void) {
                   gl_Position = scale * vec4(pos, 1) + translation;
                   vTexPos = aTexPos;
                }
        `;

        var fragmentShaderSrc = `
                precision mediump float;
                uniform sampler2D uSampler;
                varying vec2 vTexPos; 
        
                void main(void) {
                   gl_FragColor = texture2D(uSampler, vTexPos);        
                }
        `;
        
        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSrc);
        gl.compileShader(vertexShader);

        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSrc);
        gl.compileShader(fragmentShader);
        
        var drawProgram = gl.createProgram();
        gl.attachShader(drawProgram, vertexShader);
        gl.attachShader(drawProgram, fragmentShader);
        gl.linkProgram(drawProgram);
        
        var translation = gl.getUniformLocation(drawProgram, "translation");
        var scale = gl.getUniformLocation(drawProgram, "scale");

        this.posAttr = gl.getAttribLocation(drawProgram, "pos");
        this.texCordAttr = gl.getAttribLocation(drawProgram, "aTexPos");
        this.texSamplerUnif = gl.getUniformLocation(drawProgram, "uSampler");
        gl.enableVertexAttribArray(this.posAttr);
        gl.enableVertexAttribArray(this.texCordAttr);
        
        this.translate = function (x, y) {
            gl.uniform4f(translation, x, y, 0, 0);
        };
        
        this.scale = function (scx, scy) {
            gl.uniformMatrix4fv(scale, false, new Float32Array([
                scx, 0, 0, 0,
                0, scy, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]));
        };
        
        this.use = function() {
             gl.useProgram(drawProgram);
        };
    }
    
    
    function CAProgram() {
        var vertexShaderSrc = `
                attribute vec3 pos;
                attribute vec2 aTexPos;
                uniform mat4 scale;
                uniform vec4 translation;
                varying vec2 vTexPos;
        
                void main(void) {
                   gl_Position = scale * vec4(pos, 1) + translation;
                   vTexPos = aTexPos;
                }
        `;

        var fragmentShaderSrc = `
                precision mediump float;
                uniform sampler2D uSampler;
                uniform float cellSize;
                varying vec2 vTexPos; 
                
                void main(void) {
                   int adj = 0;
                   if (texture2D(uSampler, vec2(vTexPos.x - cellSize, vTexPos.y - cellSize))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x, vTexPos.y - cellSize))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x + cellSize, vTexPos.y - cellSize))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x - cellSize, vTexPos.y))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x + cellSize, vTexPos.y))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x - cellSize, vTexPos.y + cellSize))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x, vTexPos.y + cellSize))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x + cellSize, vTexPos.y + cellSize))[0] > 0.0) adj++;
                   if (texture2D(uSampler, vec2(vTexPos.x, vTexPos.y))[0] > 0.0) {
                      if (adj == 2 || adj == 3)
                        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
                      else
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                   } else if (adj == 3)
                        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
                     else
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);      
                }
        `;
        
        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSrc);
        gl.compileShader(vertexShader);

        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSrc);
        gl.compileShader(fragmentShader);
        
        var drawProgram = gl.createProgram();
        gl.attachShader(drawProgram, vertexShader);
        gl.attachShader(drawProgram, fragmentShader);
        gl.linkProgram(drawProgram);
        
        var translation = gl.getUniformLocation(drawProgram, "translation");
        var scale = gl.getUniformLocation(drawProgram, "scale");
        var cellSize = gl.getUniformLocation(drawProgram, "cellSize");

        this.posAttr = gl.getAttribLocation(drawProgram, "pos");
        this.texCordAttr = gl.getAttribLocation(drawProgram, "aTexPos");
        this.texSamplerUnif = gl.getUniformLocation(drawProgram, "uSampler");
        gl.enableVertexAttribArray(this.posAttr);
        gl.enableVertexAttribArray(this.texCordAttr);
        
        this.translate = function (x, y) {
            gl.uniform4f(translation, x, y, 0, 0);
        };
        
        this.scale = function (scx, scy) {
            gl.uniformMatrix4fv(scale, false, new Float32Array([
                scx, 0, 0, 0,
                0, scy, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]));
        };
        
        this.setCASize = function (size) {
            gl.uniform1f(cellSize, 1 / size);
        };
        
        this.use = function() {
             gl.useProgram(drawProgram);
        };
    }
    
    function init() {
        gl = canvas.getContext("webgl");
        drawProgram = new DrawProgram();
        caProgram = new CAProgram();
        currentProgram = drawProgram;
        currentProgram.use();

        vertices = new Float32Array([0, bufferSize, bufferSize, bufferSize, 0, 0, bufferSize, bufferSize, 0, 0, bufferSize, 0]);
        texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1]);

        vertexBuffer = gl.createBuffer();
        texCoordBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        initTexture();
    }
}
