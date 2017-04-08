function CA(caConfig) {
    const bufferWidth = caConfig.bufferWidth;
    const bufferHeight = caConfig.bufferHeight;
    const roomWidth = caConfig.roomWidth;
    const roomHeight = caConfig.roomHeight;
    const roomWidthInBuff = roomWidth + 1;
    const roomHeightInBuff = roomHeight + 1;
    const roomsCols = (bufferWidth + roomWidthInBuff - 1) / roomWidthInBuff | 0;
    const roomsRows = (bufferHeight + roomHeightInBuff - 1) / roomHeightInBuff | 0;
    const ruleSizePixels = 32; 
    
    const minZoom = 1 / (1 << 4);
    var canvas;
    var zoom = 2;
    var srcTex, destTex, ruleTex;
    var vertexBuffer, texCoordBuffer;
    var frameBufferSrc, frameBufferDest;
    var gl;
    var cw, ch;
    var mouse_down_point, mouse_move_point, dragging = false;
    var touches = [];
    var offset = new Vec(0, 0);
    var currentProgram, drawProgram, caProgram;
    
    this.setRule = setRule;
    
    this.init = init;

    this.updateSize = function() {
        cw = canvas.clientWidth;
        ch = canvas.clientHeight;
    };
    
    this.render = function() {
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
        drawTex(srcTex);
    };
    
    this.setCenter = function(x, y) {
        offset.x = x * zoom - cw / 2;
        offset.y = y * zoom - ch / 2;
    };
    
    this.setZoom = function(zo) {
        zoom = Math.round(zo);
    };

    this.iterate = function() {
        currentProgram = caProgram;
        currentProgram.use();
        caProgram.setCASize(bufferWidth, bufferHeight);
        caProgram.setCARoomSize(roomWidthInBuff, roomHeightInBuff);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferDest);
        gl.viewport(0, 0, bufferWidth, bufferHeight);
        var pixXScale = 1 / bufferWidth * 2;
        var pixYScale = 1 / bufferHeight * 2;
        currentProgram.scale(pixXScale, -pixYScale);
        gl.clearColor(0.0, 0.0, 0.0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        currentProgram.translate(-1, 1);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, ruleTex);
        gl.uniform1i(currentProgram.ruleTexSamplerUnif, 1);   
        drawTex(srcTex);
        
        [srcTex, destTex] = [destTex, srcTex];
        [frameBufferSrc, frameBufferDest] = [frameBufferDest, frameBufferSrc];
    };
    
    function drawTex(tex) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(currentProgram.posAttr, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(currentProgram.texCordAttr, 2, gl.FLOAT, false, 0, 0);        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(currentProgram.texSamplerUnif, 0);        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    
    function genRuleArrayPixel(ruleBLut, ruleSLut) {
        var ar = new Uint8Array(ruleSizePixels * 3);
        for (var i = 0; i < 9; i++) {
            ar[i * 3 + 0] = 255 * ruleBLut[i];
            ar[i * 3 + 1] = 255 * ruleBLut[i];
            ar[i * 3 + 2] = 255 * ruleBLut[i];
            ar[(i + ruleSizePixels / 2) * 3 + 0] = 255 * ruleSLut[i];
            ar[(i + ruleSizePixels / 2) * 3 + 1] = 255 * ruleSLut[i];
            ar[(i + ruleSizePixels / 2) * 3 + 2] = 255 * ruleSLut[i];            
        }
        return ar;
    }
    
    function parseRuleToLuts(rule) {
        var ruleLut = [new Uint8Array(9), new Uint8Array(9)];
        rule.split("/").forEach((subRule, idx) => 
            subRule.substring(1).split("").forEach(ch => ruleLut[idx][parseInt(ch)] = 1)
        );
        return ruleLut;
    }
    
    function setRule(rx, ry, rule) {
        if (!rule.match("B[0-9]*/S[0-9]*"))
            throw "invalid rule: " + rule;
        var ruleLuts = parseRuleToLuts(rule);
        var rulesPixels = genRuleArrayPixel(...ruleLuts);
        var offset = ry * roomsCols * ruleSizePixels + rx * ruleSizePixels;
        gl.bindTexture(gl.TEXTURE_2D, ruleTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, offset, 0, ruleSizePixels, 1, gl.RGB, gl.UNSIGNED_BYTE, rulesPixels);    
    };

    function initTexture() {
        var srcBufferPixelArray = new Uint8Array(bufferWidth * bufferHeight * 3);

        srcTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, bufferWidth, bufferHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, srcBufferPixelArray);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        destTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, destTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, bufferWidth, bufferHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        ruleTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, ruleTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, roomsCols * roomsRows * ruleSizePixels, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
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
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, bufferWidth, bufferHeight, gl.RGB, gl.UNSIGNED_BYTE, srcBufferPixelArray);
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
                varying vec2 tp;
        
                void main(void) {
                   gl_Position = scale * vec4(pos, 1) + translation;
                   tp = aTexPos;
                }
        `;

        var fragmentShaderSrc = `
                precision mediump float;
        
                uniform sampler2D tex;
                uniform sampler2D ruleTex;
                uniform vec2 bs;
                uniform vec2 rs;
                varying vec2 tp;                 
        
                vec2 cs = vec2(1.0, 1.0) / bs;
                vec2 bsEdge = bs - 0.5;
        
                const float ruleUnit = 1.0 / (float(${roomsCols}) * float(${roomsCols}) * float(${ruleSizePixels}));
                const float ruleSize = float(${ruleSizePixels});
                const float ruleTexRowSize = float(${roomsCols}) * ruleSize;
                
                void main(void) {
                   float modx = mod(gl_FragCoord.x, rs.x);
                   float mody = mod(bs.y - gl_FragCoord.y, rs.y);
                   if (modx == 0.5 || gl_FragCoord.x == bsEdge.x || mody == 0.5 || bs.y - gl_FragCoord.y == bsEdge.y) {
                       gl_FragColor = vec4(0, 0.15, 0.35, 1.0);
                       return;
                    }
        
                   float rx = floor(gl_FragCoord.x / rs.x);
                   float ry = floor((bs.y - gl_FragCoord.y) / rs.y);
        
                   float adj = 0.0;
                   adj += texture2D(tex, vec2(tp.x - cs.x, tp.y - cs.y)).r;
                   adj += texture2D(tex, vec2(tp.x,        tp.y - cs.y)).r;
                   adj += texture2D(tex, vec2(tp.x + cs.x, tp.y - cs.y)).r;
                   adj += texture2D(tex, vec2(tp.x - cs.x, tp.y       )).r;
                   adj += texture2D(tex, vec2(tp.x + cs.x, tp.y       )).r;
                   adj += texture2D(tex, vec2(tp.x - cs.x, tp.y + cs.y)).r;
                   adj += texture2D(tex, vec2(tp.x,        tp.y + cs.y)).r;
                   adj += texture2D(tex, vec2(tp.x + cs.x, tp.y + cs.y)).r;
        
                   float current = texture2D(tex, vec2(tp.x, tp.y)).r;
                   float ruleOffset = ruleUnit * (ruleTexRowSize * ry + ruleSize * (rx + current * 0.5));
                   float ruleCol = texture2D(ruleTex, vec2(ruleOffset + (adj + 0.5) * ruleUnit, 0.0)).r;
                   gl_FragColor = ruleCol == 1.0 ? vec4(1.0, 1.0, 1.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
                   
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
        
        this.posAttr = gl.getAttribLocation(drawProgram, "pos");
        this.texCordAttr = gl.getAttribLocation(drawProgram, "aTexPos");
        gl.enableVertexAttribArray(this.posAttr);
        gl.enableVertexAttribArray(this.texCordAttr);
        
        var translation = gl.getUniformLocation(drawProgram, "translation");
        var scale = gl.getUniformLocation(drawProgram, "scale");
        var buffSize = gl.getUniformLocation(drawProgram, "bs");
        var roomSize = gl.getUniformLocation(drawProgram, "rs");

        this.texSamplerUnif = gl.getUniformLocation(drawProgram, "tex");
        this.ruleTexSamplerUnif = gl.getUniformLocation(drawProgram, "ruleTex");
        
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
        
        this.setCASize = function (width, height) {
            gl.uniform2f(buffSize, width, height);
        };
        
        this.setCARoomSize = function (width, height) {
            gl.uniform2f(roomSize, width, height);
        };
        
        this.use = function() {
             gl.useProgram(drawProgram);
        };
    }
    
    function init(canvasElement) {
        canvas = canvasElement;
        this.updateSize();
        gl = canvas.getContext("webgl");
        drawProgram = new DrawProgram();
        caProgram = new CAProgram();
        currentProgram = drawProgram;
        currentProgram.use();

        var vertices = new Float32Array([0, bufferHeight, bufferWidth, bufferHeight, 0, 0, bufferWidth, bufferHeight, 0, 0, bufferWidth, 0]);
        var texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1]);

        vertexBuffer = gl.createBuffer();
        texCoordBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        initTexture();
        this.iterate();
        
        this.setZoom(caConfig.zoom);
        this.setCenter(...caConfig.center);
        
        canvas.addEventListener("touchstart", handleTouchstart);
        canvas.addEventListener("touchend", handleTouchend);
        canvas.addEventListener("touchmove", handleTouchmove);
        canvas.addEventListener("mousemove", handle_mouse_move);
        canvas.addEventListener("mousedown", handle_mouse_down);
        canvas.addEventListener("mouseup", handle_mouse_drag_stop);
        canvas.addEventListener("mouseout", handle_mouse_drag_stop);
        canvas.addEventListener("wheel", handle_mouse_wheel);
        
        caConfig.rooms.forEach(room => {
            var roomPixelPos = new Vec(...room.pos).multiply(roomWidthInBuff, roomHeightInBuff).add(1, 1);
            this.putBoard(room.board, ...roomPixelPos);
            this.setRule(...room.pos, room.rule);
        });
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
    
    function forEachTouch(touchList, callback) {
        for (var i = 0; i < touchList.length; i++)
            callback(touchList.item(i));
    } 
    
    function handleTouchstart(evt) {
        evt.preventDefault();
        forEachTouch(evt.changedTouches, te =>
            touches.push({
                lastPos: new Vec(te.clientX, te.clientY),
                event: te
            })
        );
    }

    function handleTouchmove(evt) {
        evt.preventDefault();
        if (touches.length === 1) {
            var currentPos = new Vec(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);
            var dxy = currentPos.vector_to(touches[0].lastPos);
            touches[0].lastPos = currentPos;
            offset.move(dxy);
        }
    }

    function handleTouchend(evt) {
        forEachTouch(evt.changedTouches, te =>
            touches = touches.filter(tc => tc.event.identifier !== te.identifier)
        );
    }
    
    this.putBoard = function (board, xx, yy) {
        var bw = board.getWidth();
        var bh = board.getHeight();
        var black = new Color(0, 0, 0);
        var white = new Color(255, 255, 255);
        var pixelSize = 3;
        var alignment = gl.getParameter(gl.UNPACK_ALIGNMENT);
        var rowSize = Math.floor((bw * pixelSize + alignment - 1) / alignment) * alignment;
        var srcBufferPixelArray = new Uint8Array(rowSize * bh);
        board.iteratePositions((x, y, v) => {
            var idx = ((bh - y - 1) * rowSize + x * pixelSize) ;
            var color = v === 0 ? black : white;            
            srcBufferPixelArray[idx + 0] = color.r;
            srcBufferPixelArray[idx + 1] = color.g;
            srcBufferPixelArray[idx + 2] = color.b;
        });
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, xx, bufferHeight - yy - bh, bw, bh, gl.RGB, gl.UNSIGNED_BYTE, srcBufferPixelArray);
    };
}

function CaConfig(bufferWidth, bufferHeight) {
    this.bufferWidth = bufferWidth;
    this.bufferHeight = bufferHeight;
    this.roomWidth = bufferWidth;
    this.roomHeight = bufferHeight;
    this.rule = "B3/S23";
    this.zoom = 1;
    this.center = new Vec(bufferWidth / 2, bufferHeight / 2);
    this.rooms = [];
}


CaConfig.fromJsonCaConfig = function(config) {
    var caConfig = new CaConfig(config.buffer.width, config.buffer.height);
    if (config.room.width) caConfig.roomWidth = config.room.width;
    if (config.room.height) caConfig.roomHeight = config.room.height;
    if (config.room.rule) caConfig.rule = config.room.rule;
    if (config.view.scale) caConfig.zoom = config.view.scale;
    if (config.view.center) caConfig.center = new Vec(...config.view.center);
    return caConfig;
};
