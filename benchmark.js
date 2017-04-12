function CaBenchmark(canvas, width, height, iterations, starts) {
    var fps = new Array(starts);
    var caConfig = new CaConfig(width, height);
    var board = new Board((width - 2), (height - 2));
    board.set(1, 0, 1);
    board.set(2, 1, 1);
    board.set(0, 2, 1);
    board.set(1, 2, 1);
    board.set(2, 2, 1);
    caConfig.center = new Vec(150, 75);
    caConfig.zoom = 4;
            
    caConfig.rooms = [
        {
            rule: "B3/S23",
            board: board,
            pos: new Vec(0, 0)
        }
    ];

    var initStart = performance.now();
    var ca = new CA(caConfig);
    ca.init(canvas);
    var initTime = performance.now() - initStart;
    
    function start() {
        var start = performance.now();
        for (var i = 0; i < iterations; i++)
            ca.iterate();
        var total = (performance.now() - start);
        return total;
    }

    this.renderCa = ca.render;

    this.runBenchmark = async function() {
        updateCanvasSize();
        return await new Promise(resolve => {
            var bStart = performance.now();
            var currentStart = 0;
            function handleStart() {                
                var time = start();
                fps[currentStart++] = 1000 / time * iterations;
                if (currentStart === starts) {
                    resolve({
                        initTime: initTime,
                        fps: fps,
                        realFps: 1000 / (performance.now() - bStart) * starts * iterations
                    });
                    return;
                }
                requestAnimationFrame(handleStart);
             }
            requestAnimationFrame(handleStart);
        });
    };
}
