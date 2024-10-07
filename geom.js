Math.radians = function(degrees) {
	return degrees * 0.017453292519943295;
}

Math.degrees = function(radians) {
	return radians * 57.29577951308232;
}

function Vec(x, y) {
    this.x = x === undefined ? 0 : x;
    this.y = y === undefined ? 0 : y;
    
}

Vec.prototype.vector_to = function (vec) {
    return new Vec(vec.x - this.x, vec.y - this.y);
};


Vec.prototype.rotate = function (angle) {
    let xx = this.x * Math.cos(angle) - this.y * Math.sin(angle);
    let yy = this.x * Math.sin(angle) + this.y * Math.cos(angle);
    this.x = xx;
    this.y = yy;
}


Vec.prototype.rotations = [...(function* () {
    for (let deg = 0; deg < 720; deg++) {
        let v = new Vec(1, 0);
        v.rotate(Math.radians(deg / 2.0));
        yield v;
    }
})()]

Vec.prototype.set = function (x, y) {
    this.x = x;
    this.y = y;
    return this;
};

Vec.prototype.same_position = function (vec) {
    return (this.x === vec.x) && (this.y === vec.y);
};

Vec.prototype.copy = function() {
    return new Vec(this.x, this.y);
};

Vec.prototype.move = function (point) {
    this.x += point.x;
    this.y += point.y;
    return this;
};

Vec.prototype.inverse = function () {
    this.x *= -1;
    this.y *= -1;
    return this;
};

Vec.prototype.transform = function(op) {
    this.x = op(this.x);
    this.y = op(this.y);
    return this;
};

Vec.prototype.multiply = function(m, n) {
    this.x *= m;
    this.y *= (n === undefined) ? m : n; 
    return this;
};

Vec.prototype.translate = function(x, y) {
    this.x += x;
    this.y += y;
    return this;
}

Vec.prototype.add = function(m, n) {
    this.x += m;
    this.y += n || m;
    return this;
};

Vec.prototype[Symbol.iterator] = function*() {
    yield this.x;
    yield this.y;
};

Vec.vec = function(x, y) {
    return new Vec(x, y);
};

Vec.dist = function(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    
    return Math.sqrt(dx * dx + dy * dy);
};

Vec.from_event = function (event) {
    return new Vec(event.offsetX, event.offsetY);
};

class Frame {
    constructor() {
        this.points = [vec(0, 0), vec(0, 0), vec(0, 0), vec(0, 0)];
    }
    reset(size) {
        let halfSize = size / 2;
        this.points[0].set(-halfSize, -halfSize);
        this.points[1].set(-halfSize, halfSize);
        this.points[2].set(halfSize, halfSize);
        this.points[3].set(halfSize, -halfSize);
    }

    translate(x, y) {
        this.points[0].translate(x, y);
        this.points[1].translate(x, y);
        this.points[2].translate(x, y);
        this.points[3].translate(x, y);
    }
    
    rotate(alpha) {
        this.points[0].rotate(alpha);
        this.points[1].rotate(alpha);
        this.points[2].rotate(alpha);
        this.points[3].rotate(alpha);
        // let rm = [
        //     Math.cos(alpha), -Math.sin(alpha), 
        //     Math.sin(alpha), Math.cos(alpha)
        // ];

    }
}



function vec(a, b) {
    return Vec.vec(a, b);
}