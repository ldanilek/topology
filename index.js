
// Affine transformation matrix in 2 dimensions.
// The source space is the reference frame of an object, with (0, 0) as its center of mass.
// Apply this transform to any point on the object to find where it should be displayed
// in the resting reference frame of the universe.
class Transform {
    constructor(a, b, c, d, e, f) {
        this.c = [a, b, c, d, e, f];
    }
    display() {
        return (    "[" + this.c[0] + " " + this.c[1] + " " + this.c[2] + "]\n"
                +   "[" + this.c[3] + " " + this.c[4] + " " + this.c[5] + "]\n"
                +   "[0 0 1]");
    }
    apply(x) {
        return [x[0] * this.c[0] + x[1] * this.c[1] + this.c[2], x[0] * this.c[3] + x[1] * this.c[4] + this.c[5]];
    }
    // Computes t * this, so in the resulting transform "this" is applied first, and then "t" is applied.
    compose(t) {
        return new Transform(
            t.c[0] * this.c[0] + t.c[1] * this.c[3],
            t.c[0] * this.c[1] + t.c[1] * this.c[4],
            t.c[0] * this.c[2] + t.c[1] * this.c[5] + t.c[2],
            t.c[3] * this.c[0] + t.c[4] * this.c[3],
            t.c[3] * this.c[1] + t.c[4] * this.c[4],
            t.c[3] * this.c[2] + t.c[4] * this.c[5] + t.c[5]
        );
    }
    linearPart() {
        return new Transform(this.c[0], this.c[1], 0, this.c[3], this.c[4], 0);
    }
    translatePart() {
        return new Transform(1, 0, this.c[2], 0, 1, this.c[5]);
    }
    /*
    scale(s) {
        return new Transform(
            s * this.c[0], s * this.c[1], s * this.c[2],
            s * this.c[3], s * this.c[4], s * this.c[5],
        );
    }
    */
    get determinant() {
        return this.c[0]*this.c[4] - this.c[1]*this.c[3];
    }
    isReflected() {
        return this.determinant < 0;
    }

    // This may not technically be the inverse matrix, but it inverts the linear and translations independently.
    inverse() {
        const d = this.determinant;
        return new Transform(this.c[4]/d, -this.c[1]/d, -this.c[2], -this.c[3]/d, this.c[0]/d, -this.c[5]);
    }
    conjugate(t) {
        return t.inverse().compose(this.compose(t));
    }
}

const zero = new Transform(0, 0, 0, 0, 0, 0);
const identity = new Transform(1, 0, 0, 0, 1, 0);
const translate = (dx, dy) => new Transform(1, 0, dx, 0, 1, dy);
const rotate = (a) => new Transform(Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0);
const reflectOverX = new Transform(1, 0, 0, 0, -1, 0);
const reflectOverY = new Transform(-1, 0, 0, 0, 1, 0);
const reflectOverXY = new Transform(0, 1, 0, 1, 0, 0);

const magnitude = (v) => Math.sqrt(v[0]*v[0]+v[1]*v[1]);

const width = 500;
const height = 500;


class MassObject {
    constructor(x, y, dx, dy) {
        this.transform = translate(x, y);
        this.velocity = translate(dx, dy);
        this.angularVelocity = identity;
    }

    topologyAdjust() {
        const [x, y] = this.transform.apply([0, 0]);
        switch (topology) {
            case "plane":
                break;
            // Note the fallthroughs.
            case "proj_plane":
                if (x < 0 || x > width) {
                    this.applyTransform(reflectOverX.conjugate(translate(width/2, height/2)));
                }
            case "klein":
                if (y < 0 || y > height) {
                    this.applyTransform(reflectOverY.conjugate(translate(width/2, height/2)));
                }
            case "torus":
                if (x < 0) {
                    this.transform = this.transform.compose(translate(width, 0));
                }
                if (x > width) {
                    this.transform = this.transform.compose(translate(-width, 0));
                }
                if (y < 0) {
                    this.transform = this.transform.compose(translate(0, height));
                }
                if (y > height) {
                    this.transform = this.transform.compose(translate(0, -height));
                }
                break;
            case "sphere":
                if (x < 0) {
                    this.applyTransform(rotate(-Math.PI/2));
                }
                if (y < 0) {
                    this.applyTransform(rotate(Math.PI/2));
                }
                if (x > width) {
                    this.applyTransform(rotate(-Math.PI/2).conjugate(translate(width, height)));
                }
                if (y > height) {
                    this.applyTransform(rotate(-Math.PI/2).conjugate(translate(width, height)));
                }
                break;
        }
    }
    get orientation() {
        return this.transform.linearPart();
    }

    step() {
        // Have to multiply in this order or else "constant velocity" will always be changing direction.
        const linearPart = this.orientation.compose(this.angularVelocity);
        const translatePart = this.transform.translatePart().compose(this.velocity);
        this.transform = linearPart.compose(translatePart);
        this.topologyAdjust();
    }
    accelerate(vx, vy) {
        // Velocity in direction object is facing.
        const relativeTranslation = translate(vx, vy).conjugate(this.orientation);
        this.velocity = this.velocity.compose(relativeTranslation);
    }
    angularAccelerate(a) {
        const relativeTransform = rotate(a).conjugate(this.orientation);
        this.angularVelocity = this.angularVelocity.compose(relativeTransform);
    }
    applyTransform(r) {
        this.transform = this.transform.compose(r);
        const orientation = r.linearPart();
        this.velocity = this.velocity.conjugate(orientation);
        this.angularVelocity = this.angularVelocity.conjugate(orientation);
        //console.log(this.transform.display(), this.velocity.display(), this.angularVelocity.display());
    }

    draw(ctx) {
        throw Error("must override");
    }
}

class Ball extends MassObject {
    constructor(x, y, vx, vy, radius) {
        super(x, y, vx, vy);
        this.radius = radius;
    }
    draw(ctx) {
        ctx.fillStyle = "blue";
        ctx.strokeStyle = "blue";
        ctx.beginPath();
        const [x, y] = this.transform.apply([0, 0]);
        // If we allow skew transforms this could be an oval, but we don't.
        const radius = magnitude(this.transform.linearPart().apply([this.radius, 0]));
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
    }
}

class Player extends MassObject {
    constructor(x, y) {
        super(x, y, 0, 0);
        this.LENGTH = 30;
        this.WIDTH = 14;
        this.ANGULAR_ACCELERATION = 0.02;
        this.ACCELERATION = 0.5;
    }
    draw(ctx) {
        const points = [
            [0, 0],
            [0, -this.WIDTH/2],
            [this.LENGTH, -this.WIDTH/2],
            [this.LENGTH, 0],
            [this.LENGTH, this.WIDTH/2],
            [0, this.WIDTH/2],
            [this.LENGTH+this.WIDTH/2*Math.sqrt(3), 0],
        ].map((p) => this.transform.apply(p));
        // bottom rectangle
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        ctx.lineTo(points[1][0], points[1][1]);
        ctx.lineTo(points[2][0], points[2][1]);
        ctx.lineTo(points[3][0], points[3][1]);
        ctx.lineTo(points[0][0], points[0][1]);
        ctx.closePath();
        ctx.fill();
        // top rectangle
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        ctx.lineTo(points[3][0], points[3][1]);
        ctx.lineTo(points[4][0], points[4][1]);
        ctx.lineTo(points[5][0], points[5][1]);
        ctx.lineTo(points[0][0], points[0][1]);
        ctx.closePath();
        ctx.fill();
        // tip triangle
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.moveTo(points[2][0], points[2][1]);
        ctx.lineTo(points[4][0], points[4][1]);
        ctx.lineTo(points[6][0], points[6][1]);
        ctx.lineTo(points[2][0], points[2][1]);
        ctx.closePath();
        ctx.fill();
    }
    left() {
        this.angularAccelerate(-this.ANGULAR_ACCELERATION);
    }
    right() {
        this.angularAccelerate(this.ANGULAR_ACCELERATION);
    }
    forward() {
        this.accelerate(this.ACCELERATION, 0);
    }
    reverse() {
        this.accelerate(-this.ACCELERATION, 0);
    }
}

class Universe {
    constructor(balls, player) {
        this.balls = balls;
        this.player = player;
    }

    step(dt) {
        for (let ball of this.balls) {
            ball.step(dt);
        }
        this.player.step(dt);
    }

    draw(ctx) {
        for (let ball of this.balls) {
            ball.draw(ctx);
        }
        this.player.draw(ctx);
    }
}

let player;
let universe;

const reset = () => {
    player = new Player(250, 250);
    universe = new Universe(
        [new Ball(200, 300, 0.2, 0.3, 10)],
        player,
    );
};
reset();

const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d");

const dtMS = 50;
const dt = dtMS / 1000;

const draw = () => {
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.rect(0, 0, 500, 500);
    ctx.fill();

    universe.draw(ctx);
    universe.step(dt);
};

setInterval(draw, dtMS);


document.onkeydown = (e) => {
    switch (e.key) {
        case 'a':
            player.left();
            break;
        case 'd':
            player.right();
            break;
        case 'w':
            player.forward();
            break;
        case 's':
            player.reverse();
            break;
    }
};

let topology = "torus";

const changeTopology = () => {
    const selector = document.getElementById("topology");
    topology = selector.value;
    reset();
};
