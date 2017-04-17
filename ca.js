var vec = Vec.vec;

function CA(caConfig) {
    const bufferWidth = caConfig.bufferWidth;
    const bufferHeight = caConfig.bufferHeight;
    const roomWidth = caConfig.roomWidth;
    const roomHeight = caConfig.roomHeight;
    const roomWidthInBuff = roomWidth + 1;
    const roomHeightInBuff = roomHeight + 1;
    const roomsCols = (bufferWidth + roomWidthInBuff - 1) / roomWidthInBuff | 0;
    const roomsRows = (bufferHeight + roomHeightInBuff - 1) / roomHeightInBuff | 0;
    const ruleBaseSizePixels = 32;
    const halfRuleSize = ruleBaseSizePixels / 2;
    const ruleTexWidth = roundUpTo2Pow(roomsCols * halfRuleSize);
    const ruleTexHeight = roundUpTo2Pow(roomsRows * 2);

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
    var offset = vec(0, 0);
    var program, renderProgram, caProgram;

    this.setRule = setRule;

    this.init = init;

    this.updateSize = function () {
        cw = canvas.clientWidth;
        ch = canvas.clientHeight;
        resetProgram();
    };

    this.setCenter = function (x, y) {
        offset.x = x * zoom - cw / 2;
        offset.y = y * zoom - ch / 2;
    };

    this.setZoom = function (zo) {
        zoom = Math.round(zo);
        resetProgram();
    };

    this.flushAndFinish = () => {
        gl.flush();
        gl.finish();
    };

    this.iterate = function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferDest);
        prepareIteration();
        drawTex(srcTex);

        [srcTex, destTex] = [destTex, srcTex];
        [frameBufferSrc, frameBufferDest] = [frameBufferDest, frameBufferSrc];
    };

    function prepareIteration() {
        if (program === caProgram)
            return;
        program = caProgram;
        program.use();
        gl.viewport(0, 0, bufferWidth, bufferHeight);
        gl.clearColor(0.0, 0.0, 0.0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        var pixXScale = 1 / bufferWidth * 2;
        var pixYScale = 1 / bufferHeight * 2;
        program.uniform("bs", bufferWidth, bufferHeight);
        program.uniform("rs", roomWidthInBuff, roomHeightInBuff);
        program.uniform("scale", pixXScale, -pixYScale);
        program.uniform("translation", -1, 1);
        program.uniform("ruleTex", 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, ruleTex);
        prepareCommon();
    }

    function resetProgram() {
        program = null;
    }
    
    this.render = function () {
        prepareRendering();
        gl.clear(gl.COLOR_BUFFER_BIT);
        var pixXScale = 1 / cw * 2;
        var pixYScale = 1 / ch * 2;
        program.uniform("translation", -1 - offset.x * pixXScale, 1 + offset.y * pixYScale);
        drawTex(srcTex);
    };

    function prepareRendering() {
        if (program === renderProgram)
            return;
        program = renderProgram;
        program.use();        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cw, ch);
        gl.clearColor(0.0, 0.0, 0.0, 1);
        var pixXScale = 1 / cw * 2;
        var pixYScale = 1 / ch * 2;        
        program.uniform("scale", pixXScale * zoom, -pixYScale * zoom);
        prepareCommon();
    }

    function prepareCommon() {
        program.attribute("pos", vertexBuffer, 2, gl.FLOAT, false, 0, 0);
        program.attribute("texPos", texCoordBuffer, 2, gl.FLOAT, false, 0, 0);
        program.uniform("tex", 0);
        gl.activeTexture(gl.TEXTURE0);
    }
    
    function drawTex(tex) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function genRuleArrayPixel(ruleBLut, ruleSLut) {
        var ar = new Uint8Array(ruleBaseSizePixels * 3);
        for (var i = 0; i < 9; i++) {
            ar[i * 3 + 0] = 255 * ruleBLut[i];
            ar[i * 3 + 1] = 255 * ruleBLut[i];
            ar[i * 3 + 2] = 255 * ruleBLut[i];
            ar[(i + ruleBaseSizePixels / 2) * 3 + 0] = 255 * ruleSLut[i];
            ar[(i + ruleBaseSizePixels / 2) * 3 + 1] = 255 * ruleSLut[i];
            ar[(i + ruleBaseSizePixels / 2) * 3 + 2] = 255 * ruleSLut[i];
        }
        return ar;
    }

    function parseRuleToLuts(rule) {
        var ruleLut = [new Uint8Array(9), new Uint8Array(9)];
        rule.split("/").forEach((subRule, half) =>
            subRule.substring(1).split("").forEach(ch => ruleLut[half][parseInt(ch)] = 1)
        );
        return ruleLut;
    }

    function setRule(rx, ry, rule) {
        if (!rule.match("B[0-9]*/S[0-9]*"))
            throw "invalid rule: " + rule;
        var ruleLuts = parseRuleToLuts(rule);
        var rulesPixels = genRuleArrayPixel(...ruleLuts);
        var offset = rx * halfRuleSize;
        gl.bindTexture(gl.TEXTURE_2D, ruleTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, offset, ry * 2, halfRuleSize, 2, gl.RGB, gl.UNSIGNED_BYTE, rulesPixels);
    }

    function initTextures() {
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
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, ruleTexWidth, ruleTexHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
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

    function createRenderProgram() {
        var vertexShaderSrc = `
                attribute vec2 pos;
                attribute vec2 texPos;
                uniform vec2 scale;
                uniform vec2 translation;
                varying vec2 vTexPos;
        
                void main(void) {
                   gl_Position = vec4(scale * pos + translation, 0, 1);
                   vTexPos = texPos;
                }
        `;

        var fragmentShaderSrc = `
                precision mediump float;
                uniform sampler2D tex;
                varying vec2 vTexPos; 
        
                void main(void) {
                   gl_FragColor = texture2D(tex, vTexPos);        
                }
        `;

        var program = Program.create(vertexShaderSrc, fragmentShaderSrc, gl);
        program.enableAttribute("pos");
        program.enableAttribute("texPos");
        return program;
    }
    
    function createCaProgram() {
        var vertexShaderSrc = `
                attribute vec2 pos;
                attribute vec2 texPos;
                uniform vec2 scale;
                uniform vec2 translation;
                varying vec2 tp;
        
                void main(void) {
                   gl_Position = vec4(scale * pos + translation, 0, 1);
                   tp = texPos;
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
        
                const vec2 rulePixUnit = 
                    vec2(1.0 / float(${ruleTexWidth}), 1.0 / float(${ruleTexHeight}));
        
                const float halfRuleSize = float(${halfRuleSize});
                
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
                   vec2 rulePos = vec2(halfRuleSize * rx + adj + 0.5, ry * 2.0 + current + 0.5); 
                   float ruleCol = texture2D(ruleTex, rulePos * rulePixUnit).r;
                   gl_FragColor = ruleCol == 1.0 ? vec4(1.0, 1.0, 1.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
                   
                }
        `;

        var program = Program.create(vertexShaderSrc, fragmentShaderSrc, gl);
        program.enableAttribute("pos");
        program.enableAttribute("texPos");
        return program;
    }

    function init(canvasElement) {
        canvas = canvasElement;
        this.updateSize();
        gl = canvas.getContext("webgl");
        renderProgram = createRenderProgram();
        caProgram = createCaProgram();

        var vertices = new Float32Array([0, bufferHeight, bufferWidth, bufferHeight, 0, 0, bufferWidth, bufferHeight, 0, 0, bufferWidth, 0]);
        var texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1]);

        vertexBuffer = gl.createBuffer();
        texCoordBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.disable(gl.DEPTH_TEST);

        initTextures();

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
            var roomPixelPos = vec(...room.pos).multiply(roomWidthInBuff, roomHeightInBuff).add(1, 1);
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
        resetProgram();
    }

    function forEachTouch(touchList, callback) {
        for (var i = 0; i < touchList.length; i++)
            callback(touchList.item(i));
    }

    function handleTouchstart(evt) {
        evt.preventDefault();
        forEachTouch(evt.changedTouches, te =>
            touches.push({
                lastPos: vec(te.clientX, te.clientY),
                event: te
            })
        );
    }

    function handleTouchmove(evt) {
        evt.preventDefault();
        if (touches.length === 1) {
            var currentPos = vec(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);
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
            var idx = ((bh - y - 1) * rowSize + x * pixelSize);
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
    this.center = vec(bufferWidth / 2, bufferHeight / 2);
    this.rooms = [];
}


CaConfig.fromJsonCaConfig = function (config) {
    var caConfig = new CaConfig(config.buffer.width, config.buffer.height);
    if (config.room.width)
        caConfig.roomWidth = config.room.width;
    if (config.room.height)
        caConfig.roomHeight = config.room.height;
    if (config.room.rule)
        caConfig.rule = config.room.rule;
    if (config.view.scale)
        caConfig.zoom = config.view.scale;
    if (config.view.center)
        caConfig.center = vec(...config.view.center);
    return caConfig;
};
