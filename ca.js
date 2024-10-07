

function CA(width, height) {
    const bufferWidth = width;
    const bufferHeight = height;

    const n = 2000;

    const minZoom = 1 / (1 << 4);
    var canvas;
    var zoom = 1;
    var tex, perTex;
    var rMsBuffer;
    var vertexBuffer, texCoordBuffer;
    var rMs = new Float32Array(n * 4 * 12);
     /**
      * @type WebGLRenderingContext
      */
    var gl;
    var cw, ch;
    var mouse_down_point, mouse_move_point, dragging = false;
    var touches = [];
    var offset = vec(0, 0);
    var program, renderProgram, caProgram;

    let vertices = new Float32Array(n * 12);
    let texCoords = new Float32Array(n * 12);

    this.init = init;

    this.updateSize = function () {
        cw = canvas.clientWidth;
        ch = canvas.clientHeight;
    };

    this.setCenter = function (x, y) {
        offset.x = x * zoom - cw / 2;
        offset.y = y * zoom - ch / 2;
    };

    this.setZoom = function (zo) {
        zoom = Math.round(zo);
    };

    this.flushAndFinish = () => {
        gl.flush();
        gl.finish();
    };

    let frame = new Frame();

    function entityToQuad(entity, size, offset) {
        let rad = -Math.atan2(entity.v.x, entity.v.y) + Math.PI;
        frame.reset(size);
        frame.rotate(rad);
        frame.translate(entity.pos.x, entity.pos.y);
        const pts = frame.points;
        // vertices.set([x, y, x + w, y + h, x + w, y, x, y, x + w, y + h, x, y + h], offset);
        vertices.set([
            pts[0].x, pts[0].y, 
            pts[1].x, pts[1].y,
            pts[2].x, pts[2].y,
            pts[0].x, pts[0].y,
            pts[3].x, pts[3].y,
            pts[2].x, pts[2].y
        ], offset);
    }

    function entityFrame(entity, offset) {

       
        
        let txArrSizePx = 1024;
        let frameSizePx = 64;
        let frameSize = frameSizePx / txArrSizePx;
        let frameX = framesMap[Math.floor(entity.frame)].x * frameSize; frameY = framesMap[Math.floor(entity.frame)].y * frameSize;
        let txC = [
            frameX, frameY, 
            frameX, frameY + frameSize, 
            frameSize + frameX, frameY + frameSize, 
            frameX, frameY, 
            frameX + frameSize, frameY, 
            frameSize + frameX, frameY + frameSize
        ];
        
        texCoords.set(txC, offset);
        
       
    }
    this.render = function (entities) {
        
        for (let i = 0; i < entities.length; i++) {
            entityToQuad(entities[i], 50, i * 12);
            entityFrame(entities[i], i * 12);
            entities[i].nextFrame();
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);        
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW);

        prepareRendering();
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        var pixXScale = 1 / cw * 2;
        var pixYScale = 1 / ch * 2;
        program.uniform("translation", -1 - offset.x * pixXScale, 1 + offset.y * pixYScale);
        gl.bindTexture(gl.TEXTURE_2D, perTex);
        gl.drawArrays(gl.TRIANGLES, 0, 6 * entities.length);
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

    async function initTextures() {
        // let im = new Image();
        // im.src = "img/particle.png";
        // let p1 =  new Promise((resolve, reject) => {
        //     im.addEventListener('load', function () {
        //         tex = gl.createTexture();
        //         // Now that the image has loaded make copy it to the texture.
        //         gl.bindTexture(gl.TEXTURE_2D, tex);
        //         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        //         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        //         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        //         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        //         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        //         resolve();
        //     });
        // });

        let im2 = new Image();
        im2.src = "img/out.png";
        let p2 = new Promise((resolve, reject) => {
            im2.addEventListener('load', function () {
                perTex = gl.createTexture();
                // Now that the image has loaded make copy it to the texture.
                gl.bindTexture(gl.TEXTURE_2D, perTex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im2);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                resolve();
            });
        });

        return p2;
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

    function genQuads(x, y, w, h) {
        return {
            ver: [x, y, x + w, y + h, x + w, y, x, y, x + w, y + h, x, y + h],
            tex: [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1]
        }
    }

    async function init(canvasElement) {
        canvas = canvasElement;
        this.updateSize();
        gl = canvas.getContext("webgl", { premultipliedAlpha: false})
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        renderProgram = createRenderProgram();

        let w = 32;
        for (let i = 0; i < n; i++) {
            let x = Math.random() * cw - w / 2;
            let y = Math.random() * ch - w / 2;
            let quads = genQuads(x, y, w, w);
            vertices.set(quads.ver, 12 * i);
            texCoords.set(quads.tex, 12 * i);
        }
        rMsBuffer = gl.createBuffer();
        vertexBuffer = gl.createBuffer();
        texCoordBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.disable(gl.DEPTH_TEST);

        await initTextures();

        // canvas.addEventListener("touchstart", handleTouchstart);
        // canvas.addEventListener("touchend", handleTouchend);
        // canvas.addEventListener("touchmove", handleTouchmove);
        // canvas.addEventListener("mousemove", handle_mouse_move);
        // canvas.addEventListener("mousedown", handle_mouse_down);
        // canvas.addEventListener("mouseup", handle_mouse_drag_stop);
        // canvas.addEventListener("mouseout", handle_mouse_drag_stop);
        // canvas.addEventListener("wheel", handle_mouse_wheel);

    }

    // function handle_mouse_down(event) {
    //     if (event.button === 2) {
    //         event.preventDefault();
    //         return;
    //     }

    //     mouse_down_point = Vec.from_event(event);
    //     mouse_move_point = Vec.from_event(event);

    //     dragging = true;
    // }

    // function handle_mouse_drag_stop(event) {
    //     if (!dragging)
    //         return;

    //     dragging = false;
    // }

    // function handle_mouse_move(event) {
    //     if (!dragging)
    //         return;

    //     var temp_mouse_move_point = Vec.from_event(event);
    //     var dxy = temp_mouse_move_point.vector_to(mouse_move_point);

    //     offset.move(dxy);

    //     mouse_move_point = temp_mouse_move_point;
    // }

    // function handle_mouse_wheel(event) {
    //     var nz = ((event.deltaY < 0) ? zoom * 2 : zoom / 2);
    //     changeZoom(nz, Vec.from_event(event));
    // }

    // function changeZoom(scale, mousePos) {
    //     let oldTileSize = zoom;
    //     zoom = scale;
    //     if (zoom < minZoom)
    //         zoom = minZoom;
    //     let xo = offset.x + mousePos.x;
    //     let yo = offset.y + mousePos.y;
    //     offset.x += Math.round(xo * zoom / oldTileSize - xo);
    //     offset.y += Math.round(yo * zoom / oldTileSize - yo);
    //     resetProgram();
    // }

    // function forEachTouch(touchList, callback) {
    //     for (var i = 0; i < touchList.length; i++)
    //         callback(touchList.item(i));
    // }

    // function handleTouchstart(evt) {
    //     evt.preventDefault();
    //     forEachTouch(evt.changedTouches, te =>
    //         touches.push({
    //             lastPos: vec(te.clientX, te.clientY),
    //             event: te
    //         })
    //     );
    // }

    // function handleTouchmove(evt) {
    //     evt.preventDefault();
    //     if (touches.length === 1) {
    //         var currentPos = vec(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);
    //         var dxy = currentPos.vector_to(touches[0].lastPos);
    //         touches[0].lastPos = currentPos;
    //         offset.move(dxy);
    //     }
    // }

    // function handleTouchend(evt) {
    //     forEachTouch(evt.changedTouches, te =>
    //         touches = touches.filter(tc => tc.event.identifier !== te.identifier)
    //     );
    // }

}