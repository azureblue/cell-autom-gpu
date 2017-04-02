function Board(w, h) {
    var bounds = new Rect(0, 0, w, h);
    var iterationBounds = new Rect(0, 0, w, h);
    var array = new Int32Array(w * h);
    this.checkRange = (x, y) => bounds.inside(x, y);
    this.get = (x, y) => array[y * w + x];
    this.set = (x, y, b) => array[y * w + x] = b;
    this.getArray = () => array;
    this.getIterationBounds = () => iterationBounds;
    this.getWidth = () => w;
    this.getHeight = () => h;
    this.getTile = (x, y) => this.checkRange(x, y) ? this.get(x, y) : undefined;
    this.iteratePositions = function(callbackXYV) {        
        var bw = iterationBounds.width, bh = iterationBounds.height;
        var bx = iterationBounds.x, by = iterationBounds.y;
        var len = bw * bh;
        for (var i = 0; i < len; i++) {
            var x = i % bw + bx;
            var y = (i / bw) + by | 0;
            callbackXYV(x, y, array[y * w + x]);
        }
    };    
}
