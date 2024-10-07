class Entity {
    constructor(x, y) {
        this.pos = vec(x, y);
        this.v = vec(0, 0);
    }

    logicTick() {
    }

    updatePos(dt) {
        this.pos.x += this.v.x * dt;
        this.pos.y += this.v.y * dt;
    }
}

// let framesMap = [vec(0, 0)];
let framesMap = [];

for (let i = 0; i < 16; i++)
    framesMap.push(vec(i, 1));
for (let i = 0; i < 9; i++)
    framesMap.push(vec(i, 2));

// for (let i = 1; i < 10; i++)
//     framesMap.push(vec(9 - i, 1));

// framesMap.push(vec(0, 0));

// for (let i = 0; i < 10; i++)
//     framesMap.push(vec(i, 2));

// for (let i = 1; i < 10; i++)
//     framesMap.push(vec(9 - i, 2));


class RandomWalkingEntity extends Entity {

    constructor(pos, angle) {
        super(pos.x, pos.y);
        this.v = vec(1, 0);
        this.v.rotate(angle);
        this.frame = Math.floor(Math.random() * framesMap.length);
        this._state = 0;
        this.av = 0;
    }


    nextFrame() {
        this.frame = this.frame + 0.7;
        if (this.frame >= framesMap.length)
            this.frame = 0;

        if (this._state == RandomWalkingEntity.STATE_ROTATING) {
            this.v.rotate(this.av);
            if (Math.random() < 0.1) {
                this._state = RandomWalkingEntity.STATE_WALKING;
            }
        }
    }


    logicTick() {
        if (this._state == RandomWalkingEntity.STATE_WALKING) {
            this._state = RandomWalkingEntity.STATE_ROTATING;
            this.av = (Math.random() - 0.5) * Math.PI / 30;
        }
    }

    static STATE_WALKING = 0;
    static STATE_ROTATING = 1;

}