function CA(canvas, board) {
    const size = board.getWidth();
    const bufferSize = size + 2;
    const minZoom = 1 / (1 << 4);
    var zoom = 2;
    var srcTex, destTex;
    var vertices;
    var texCoords;
    var vertexBuffer;
    var texCoordBuffer;
    var frameBufferSrc, frameBufferDest;
    var gl;
    var cw, ch;
    var mouse_down_point, mouse_move_point, dragging = false;
    var touches = [];
    var offset = new Vec(0, 0);
    var currentProgram, drawProgram, caProgram;
    
    canvas.addEventListener("touchstart", handleTouchstart);
    canvas.addEventListener("touchend", handleTouchend);
    canvas.addEventListener("touchmove", handleTouchmove);
    canvas.addEventListener("mousemove", handle_mouse_move);
    canvas.addEventListener("mousedown", handle_mouse_down);
    canvas.addEventListener("mouseup", handle_mouse_drag_stop);
    canvas.addEventListener("mouseout", handle_mouse_drag_stop);
    canvas.addEventListener("wheel", handle_mouse_wheel);
    
    initGl();
    

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
        var pixXScale = 1 / cw * 2;
        var pixYScale = 1 / ch * 2;
        currentProgram.scale(pixXScale * zoom, -pixYScale * zoom);
        gl.clearColor(0.0, 0.0, 0.0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        currentProgram.translate(-1 - offset.x * pixXScale, 1 + offset.y * pixYScale);       
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        destTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, destTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, bufferSize, bufferSize, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
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
                uniform int buffSize;
                varying vec2 vTexPos;                 
                float bs = float(buffSize);
                float cellSize = 1.0 / bs;
                void main(void) {
                   if (mod(gl_FragCoord.x, bs) < 1.0)
                       discard;
                   if (mod(gl_FragCoord.x, bs) > bs - 1.0)
                       discard;
                   if (mod(gl_FragCoord.y, bs) < 1.0)
                       discard;
                   if (mod(gl_FragCoord.y, bs) > bs - 1.0)
                       discard;
        
                   float adj = 0.0;
                   adj += texture2D(uSampler, vec2(vTexPos.x - cellSize, vTexPos.y - cellSize)).r;
                   adj += texture2D(uSampler, vec2(vTexPos.x, vTexPos.y - cellSize)).r;
                   adj += texture2D(uSampler, vec2(vTexPos.x + cellSize, vTexPos.y - cellSize)).r;
                   adj += texture2D(uSampler, vec2(vTexPos.x - cellSize, vTexPos.y)).r;
                   adj += texture2D(uSampler, vec2(vTexPos.x + cellSize, vTexPos.y)).r;
                   adj += texture2D(uSampler, vec2(vTexPos.x - cellSize, vTexPos.y + cellSize)).r;
                   adj += texture2D(uSampler, vec2(vTexPos.x, vTexPos.y + cellSize)).r;
                   adj += texture2D(uSampler, vec2(vTexPos.x + cellSize, vTexPos.y + cellSize)).r;
                   
                   if (texture2D(uSampler, vec2(vTexPos.x, vTexPos.y)).r == 1.0)
                       gl_FragColor = (adj == 2.0 || adj == 3.0) ? vec4(1.0, 1.0, 1.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
                   else
                       gl_FragColor = (adj == 3.0) ? vec4(1.0, 1.0, 1.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);         
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
        var buffSize = gl.getUniformLocation(drawProgram, "buffSize");

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
            gl.uniform1i(buffSize, size);
        };
        
        this.use = function() {
             gl.useProgram(drawProgram);
        };
    }
    
    function initGl() {
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
    
    function handle_mouse_down(event) {
        if (event.button === 2) {
            event.preventDefault();
            return;
        }

        mouse_down_point = Vec.from_event(event);
        mouse_move_point = Vec.from_event(event);

        dragging = true;
    }

    function handle_mouse_drag_stop(event) {
        if (!dragging)
            return;
        
        dragging = false;
    }

    function handle_mouse_move(event) {
        if (!dragging)
            return;

        var temp_mouse_move_point = Vec.from_event(event);
        var dxy = temp_mouse_move_point.vector_to(mouse_move_point);

        offset.move(dxy);

        mouse_move_point = temp_mouse_move_point;
    }
    
    function handle_mouse_wheel(event) {
        var nz = ((event.deltaY < 0) ? zoom * 2 : zoom / 2);
        changeZoom(nz, Vec.from_event(event));
    }

    function changeZoom(scale, mousePos) {
        let oldTileSize = zoom;
        zoom = scale;
        if (zoom < minZoom)
            zoom = minZoom;
        let xo = offset.x + mousePos.x;
        let yo = offset.y + mousePos.y;
        offset.x += Math.round(xo * zoom / oldTileSize - xo);
        offset.y += Math.round(yo * zoom / oldTileSize - yo);
    }
    
     function handleTouchstart(evt) {
        forEachTouch(evt.changedTouches, te =>
            touches.push({
                lastPos: new Vec(te.clientX, te.clientY),
                event: te
            })
        );
    }

    function handleTouchmove(evt) {
        if (touches.length === 1) {
            var currentPos = new Vec(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);
            var dxy = currentPos.vector_to(touches[0].lastPos);
            touches[0].lastPos = currentPos;
            offset.move(dxy);
            render();
        }
    }

    function handleTouchend(evt) {
        forEachTouch(evt.changedTouches, te =>
            touches = touches.filter(tc => tc.event.identifier !== te.identifier)
        );
    }
}
