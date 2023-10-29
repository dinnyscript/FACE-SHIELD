

let canvas = dgei('c');
let txt = dgei('txt');
const gl = canvas.getContext('webgl');
const ctx = txt.getContext('2d');

//Configuration and Input
let Configs = {
    resolution: [1920,1080],
    scale: 1,//conversion factor from pixels to in game length
    xdim : 24, //what the width of the screen should be in in-game length
};
let Input = {
    wasd : [0,0,0,0],
    esc : false,
    dx : [0,-1,0,1],
    dy : [1,0,-1,0],
    get vector() {
        let vector = [0,0];
        for (var i = 0; i < this.wasd.length; i++) {
            vector[0] += this.dx[i]*this.wasd[i];
            vector[1] += this.dy[i]*this.wasd[i];
        }
        return normalize(vector);
    },
    delta : 0,
    mousepos : [0,0],
    get centeredMousePos() {
        let pos = scale(subtract(this.mousepos,[ctx.canvas.width/2,ctx.canvas.height/2]), Configs.scale);
        return [pos[0],-pos[1]];
    },
    get bLMousePos() {
        let pos = scale(this.mousepos, Configs.scale);
        return [pos[0], 13.5 - pos[1]];
    },
    click : false,
};

let ScreenManager = {
    currentScreen : "start",
    currentLevel : 0,
};

//Audio
let Audio = {
    collision : dgei('collision'),
    die : dgei('die'),
    lc : dgei('levelcomplete'),
    mc : dgei('menuclose'),
    mo : dgei('menuopen'),
    pu : dgei('pickup'),
    s : dgei('select'),
    liquid : dgei('liquid'),
    play(type) {
        this[type].currentTime = 0;
        this[type].play();
    }
}
Audio.liquid.volume = 0.2;
//webGL
let Programs = {
}
function initPrograms() {
    Programs.c = twgl.createProgramInfo(gl, ["vs-c","fs-c"]);
    Programs.l = twgl.createProgramInfo(gl, ["vs-l","fs-l"]);
    Programs.t = twgl.createProgramInfo(gl, ["vs-t","fs-t"]);
}
initPrograms();
let GlManager = {
    circleQueue : {},
    numcirclev: 0, //number of circle vertices
    resetCircle() {
        this.circleQueue.a_pos = {numComponents: 3, data: [] };
        this.circleQueue.a_color = {numComponents: 4, data: [] };
        this.circleQueue.a_center = {numComponents: 3, data: [] };
        this.circleQueue.a_r = {numComponents: 1, data: [] };
        this.circleQueue.a_R = {numComponents: 1, data: [] };
        this.circleQueue.a_s1 = {numComponents: 1, data: [] };
        this.circleQueue.a_s2 = {numComponents: 1, data: [] };
        this.circleQueue.a_theta = {numComponents: 1, data: [] };
        this.numcirclev = 0;
    },
    corners : {
        x : [-1,-1,1,-1,1,1],
        y : [-1,1,-1,1,1,-1],
    },
    addCircle(col, center, r, R, s1, s2,theta, z) {
        for (var i = 0; i < this.corners.x.length; i++) {
            let point = [center[0] + R*this.corners.x[i], center[1] + R*this.corners.y[i],z];
            this.circleQueue.a_pos.data.push(...point);
            this.circleQueue.a_color.data.push(...col);
            this.circleQueue.a_center.data.push(...center);
            this.circleQueue.a_r.data.push(r);
            this.circleQueue.a_R.data.push(R);
            this.circleQueue.a_s1.data.push(s1);
            this.circleQueue.a_s2.data.push(s2);
            this.circleQueue.a_theta.data.push(theta);
        }
        this.numcirclev += 6;
    },
    lineQueue : {},
    numlinev : 0,
    resetLine() {
        this.lineQueue.a_pos = {numComponents: 3, data: [] };
        this.lineQueue.a_color = {numComponents: 4, data: [] };
        this.lineQueue.a_p1 = {numComponents: 3, data: [] };
        this.lineQueue.a_p2 = {numComponents: 3, data: [] };
        this.lineQueue.a_r = {numComponents: 1, data: [] };
        this.numlinev = 0;
    },
    addLine(col, p1, p2, r, z) {
        let x1 = Math.min(p1[0],p2[0])-r;
        let x2 = Math.max(p1[0],p2[0])+r;
        let y1 = Math.min(p1[1],p2[1])-r;
        let y2 = Math.max(p1[1],p2[1])+r;
        let pts = [[x1,y1],[x1,y2],[x2,y1],[x1,y2],[x2,y2],[x2,y1]];
        for (var i = 0; i < pts.length; i++) {
            this.lineQueue.a_pos.data.push(...pts[i]);
            this.lineQueue.a_pos.data.push(z);
            this.lineQueue.a_color.data.push(...col);
            this.lineQueue.a_p1.data.push(...p1);
            this.lineQueue.a_p2.data.push(...p2);
            this.lineQueue.a_r.data.push(r);
        }
        this.numlinev += 6;
    },
    triQueue : {},
    numtriv : 0,
    resetTri() {
        this.triQueue.a_pos = {numComponents: 3, data: [] };
        this.triQueue.a_color = {numComponents: 4, data: []};
        this.triQueue.a_center = {numComponents: 3, data: []};
        this.triQueue.a_r = {numComponents: 1, data: []};
        this.triQueue.a_R = {numComponents: 1, data: []};
        this.triQueue.a_s = {numComponents: 1, data: []};
        this.numtriv = 0;
    },
    addTri(col, center, r, R, s) {
        for (var i = 0; i < this.corners.x.length; i++) {
            let point = [center[0] + R*this.corners.x[i], center[1] + R*this.corners.y[i],0];
            this.triQueue.a_pos.data.push(...point);
            this.triQueue.a_color.data.push(...col);
            this.triQueue.a_center.data.push(...center);
            this.triQueue.a_r.data.push(r);
            this.triQueue.a_R.data.push(R);
            this.triQueue.a_s.data.push(s);
        }
        this.numtriv += 6;
    },
    screenMat : twgl.m4.scale(twgl.m4.identity(), [1/Configs.xdim,1/(Configs.xdim*9/16),1]),
};
GlManager.resetCircle();
GlManager.resetLine();
GlManager.resetTri();
let rSelect = [[1,2],[0,2],[0,1]];
let mLineLength = 8;
//Game variables
class Bullet {
    constructor(type, center, vx, vy, time, duration) {
        this.type = type;
        this.center = center;
        this.B = toBlock(this.center[0], this.center[1]); this.reassigned = false;
        this.delDur = 0.2; //time to deletion
        this.del = this.delDur;
        this.vx = vx;
        this.vy = vy;
        this.creation = time; //time of creation
        this.duration = duration;
        this.curR = 0; //current radius
        if (type == 0) {
            this.r = 0.2;
            this.color = [1.,.5,.5,1.];
            this.mass = 1;
            this.q = 1;
        } else if (type == 1) {
            this.r = 0.3;
            this.color = [1.,.3,.3,1.];
            this.mass = 3;
            this.q = 1;
        } else if (type == 2) {
            this.r = 0.4;
            this.color = [1.,.1,.1,1.];
            this.mass = 4;
            this.q = 1;
        } else if (type == 3) {
            this.r = 0.5;
            this.color = [1.,.0,.0,1.];
            this.mass= 7;
            this.q = 1;
        }
        RegionHandler[this.B[0]][this.B[1]].bullets.push(this);
    }
    distToForce(dist, sforce, oforce, R) {
        if (dist == 0) {dist = 0.001; }
        let d2 = Math.pow(dist, 2);
        let f = sforce * this.q * 1/d2; //stores the radial force
        let cdist = R - dist; //the distance from the rim of the circle
        if (cdist > 0) {
            let scaledCDist = 3*cdist/R; //the three is arbitrary; from a graph
            f -= 0.3 * sforce * this.q * Math.pow(Math.pow(1/2,scaledCDist),scaledCDist);
        } else {
            f *= oforce;
        }
        return f;
    }
    simCircle(circle, delta) {
        if (circle.type == 2 || circle.type == 3) {
            return;
        }
        let dist = distance(this.center, circle.center);
        let radial = subtract(this.center, circle.center);
        let cos = radial[0]/dist; let sin = radial[1]/dist;
        let f = this.distToForce(dist, circle.sforce, circle.oforce, circle.R);
        let a = f / this.mass;
        this.vx += a * cos * delta;
        this.vy += a * sin * delta;
    }
    simLine(line, delta) {
        let offset = scale(line.perp, line.R);
        let dist1 = line.distTo(this.center, offset);
        let dist = line.distTo(this.center, [0,0]);
        if (dist[0] < this.r + line.r + 0.3 && line.type == 0) {
            this.del = this.del - delta;
            this.vx = 0; this.vy = 0;
        }
        if (dist1[1] > 0 && dist1[1] < 1) { //if projection onto line is in range
            if (dist1[0] < dist[0] && dist[0] > line.R) { //if the point is too far behind the segment
                return;
            }
            let radial = [-line.perp[0],-line.perp[1]];
            let f = this.distToForce(dist1[0], line.sforce, line.oforce, line.R);
            let a = f / this.mass;
            //this.color = [1,1,1,1];
            this.vx += a * radial[0]*delta;
            this.vy += a * radial[1]*delta;
        }
    }
    simPlayer(delta) {
        let future = add(this.center, [this.vx*delta, this.vy*delta]);
        let dist = distance(future, [Player.x,Player.y]);
        let radial = subtract(future, [Player.x, Player.y]);
        let angle = Math.atan2(radial[1], radial[0]);
        let arcs = [[Player.shieldState[0][0]+Player.angle-toRad(90),Player.shieldState[0][1]+Player.angle-toRad(90)],[Player.shieldState[1][0]+Player.angle-toRad(90),Player.shieldState[1][1]+Player.angle-toRad(90)]];
        if (dist < 1.3 + this.r && (btwn(angle,arcs[0]) || btwn(angle,arcs[1]))) {
            if (3-this.type >= Player.faces[Player.shieldType]) {
                this.del = this.del - delta;
                this.vx = 0; this.vy = 0;
                Audio.play('collision');
            }
        }
    }
    simulate(delta, x, y) {
        this.reassigned = false;
        if (Game.time - this.creation > this.duration || this.del < this.delDur) {
            let dif = Game.time - this.creation - this.duration;
            this.del = Math.max(this.del - delta, 0);
            if (dif > this.del) {
                this.del = 0;
            }
        }
        
        this.curR = Math.min(Math.min(this.r, Game.time - this.creation), this.del/this.delDur*this.r);

        if (this.del == this.delDur) {
            let proxim = RegionHandler[x][y].proxim;
            for (var i = 0; i < proxim.length; i++) {
                let block = RegionHandler[proxim[i][0]][proxim[i][1]];
                for (var j = 0; j < block.circles.length; j++) {
                    this.simCircle(block.circles[j], delta);
                }
                for (var j = 0; j < block.lines.length; j++) {
                    this.simLine(block.lines[j], delta);
                }
            }
            this.simPlayer(delta);
        }

        this.center[0] += this.vx * delta;
        this.center[1] += this.vy * delta;
    }
    reassign(i, x, y) {
        if (this.reassigned) {
            return;
        }
        if (this.del == 0) {
            RegionHandler[x][y].bullets.splice(i,1);
            return;
        }
        
        this.reassigned = true;
        let newB = toBlock(this.center[0], this.center[1]);
        
        if (!isValid(newB)) {
            this.del -= 0.000001;
        }
        if (this.del == this.delDur) {
            if (newB[0] != x || newB[1] != y) {
                RegionHandler[x][y].bullets.splice(i,1);
                RegionHandler[newB[0]][newB[1]].bullets.push(this);
            }
        }
        GlManager.addCircle(this.color, this.center, this.curR/2, this.curR, -1, 7, 0, 0);
    }
}
let numBulletTypes = 4;
class Repeller {
    constructor(type, center, r, R, s1, s2, probs, rate, sforce, oforce, faces) {
        this.type = type;
        this.center = center;
        this.reassigned = false;
        this.r = r;
        this.R = R;
        this.s1 = toRad(s1);
        this.s2 = toRad(s2);
        this.tPerShot = 1/rate; //time per shot
        this.accum = 0;//an accumulator to help keep track of shooting rate
        this.sforce = sforce;
        this.oforce = oforce; //force scalar outside of repeller
        this.blockC = toBlock(this.center[0],this.center[1]);
        this.probs = probs;
        if (type == 0) {
            this.color = [1.,0.5,0.5,1];
        } else if (type == 1) {
            this.color = [1.,0.5, 0.5,1];
        } else if (type == 2) {
            this.color = [0.5,1,1,1];
            this.R = 0.9;
            this.r = 0.9;
            this.s1 = -1;
            this.s2 = 7;
            this.faces = faces;
            this.hit = false;
            this.fill = 0;
        } else if (type == 3) {
            this.color = [0,1,0,1];
        }
        while (this.probs.length < numBulletTypes) {
            this.probs.push(0);
        }
    }
    materializeBullet() {
        let angle = rand(this.s1, this.s2);
        let dist = rand(this.r/4, this.r);
        let pos = [Math.cos(angle) * dist + this.center[0], Math.sin(angle) * dist + this.center[1], 0];
        new Bullet(randBullet(this.probs), pos, 0, 0, Game.time, 10);
    }
    simulate(delta) {
        this.reassigned = false;
        this.accum += delta;
        if (this.type == 1) {
            for (this.accum; this.accum > this.tPerShot; this.accum -= this.tPerShot) {
                this.materializeBullet();
            }
        }
        if (this.type == 2) {
            if (this.hit) {
                if (this.fill == 0) { Audio.play('pu'); }
                this.fill = Math.min(this.fill + delta*6, 1);
            } else {
                this.fill = Math.max(this.fill - delta*6, 0);
            }
        }
    }
    reassign(i, x, y) {
        if (this.reassigned) {
            return;
        }
        this.reassigned = true;
        let newB = toBlock(this.center[0], this.center[1]);
        if (newB[0] != x || newB[1] != y) {
            RegionHandler[x][y].circles.splice(i,1);
            RegionHandler[newB[0]][newB[1]].circles.push(this);
        }
        if (this.type == 0 || this.type == 1) {
            GlManager.addCircle(this.color, this.center, 0, this.r/4, -1, 7, 0, 0);
            GlManager.addCircle(this.color, this.center, this.r-0.06, this.r, this.s1, this.s2, 0, 0);
            GlManager.addCircle(this.color, this.center, this.R-0.06, this.R, -1, 7, 0, 0);
        } else if (this.type == 3) {
            GlManager.addCircle(this.color, this.center, 0, this.r*(Math.sin(Game.time*3)/3+0.5), -1, 7, 0, 0);
            GlManager.addCircle(this.color, this.center, this.r*(Math.sin(Game.time*3)/3+0.6)-0.06, this.r*(Math.sin(Game.time*3)/3+0.6), -1, 7, 0, 0);
            GlManager.addCircle(this.color, this.center, this.R-0.06, this.R, -1, 7, 0, 0);
        } else if (this.type == 2) {
            GlManager.addCircle([this.color[0], this.color[1], this.color[2], this.fill/2], this.center, 0, this.R+0.1, -1, 7, 0, 0);
            GlManager.addCircle(this.color, this.center, this.R+0.06, this.R+0.12, -1, 7, 0, 0);
            GlManager.addTri(this.color, this.center, this.R/3, this.R, Game.time);
        }
    }
}
class Segment {
    constructor(type, p1, p2, probs, rate, sforce, oforce, r, R) {
        this.type = type;
        this.p1 = p1;
        this.p2 = p2;
        this.reassigned = false;
        this.probs = probs;
        this.tPerShot = 1/rate; this.accum = 0;
        this.sforce = sforce;
        this.oforce = oforce;
        this.r = r;
        this.R = R;
        this.vector = normalize(subtract(p2,p1));
        this.length = distance(this.p1, this.p2);
        this.perp = [this.vector[1], -this.vector[0]]; //a vector
        if (type == 0) {
            this.color = [1.,.1,.1,1.];
            this.sforce = 0;
            this.oforce = 0;
        } else if (type == 1) {
            this.color = [1., .3, .3, 1.];
        } else if (type == 2) {
            this.color = [1.,.1,.1,1.];
        }
        while (this.probs.length < numBulletTypes) {
            this.probs.push(0);
        }
    }
    materializeBullet() {
        let dist = scale(this.perp, rand(this.R/2, this.R*4/5));
        let vec = scale(this.vector, rand(this.r, this.length-this.r));
        let pos = [dist[0] + vec[0] + this.p1[0], dist[1] + vec[1] + this.p1[1], 0];
        
        new Bullet(randBullet(this.probs), pos, 0, 0, Game.time, 10);
    }
    distTo(point, offset) { //apply an offset to the line segment
        let p1 = [this.p1[0]+offset[0],this.p1[1]+offset[1]];
        let p2 = [this.p2[0]+offset[0],this.p2[1]+offset[1]];
        let l2 = Math.pow(distance(p1,p2), 2.);
        let t = clamp(dot(subtract(point, p1),subtract(p2,p1))/l2,0.,1.);
        let j = add(p1, scale(subtract(p2,p1),t));
        return [distance(point,j), t, j];
    }
    simulate(delta) {
        this.reassigned = false;
        this.accum += delta;
        if (this.type == 1) {
            for (this.accum; this.accum > this.tPerShot; this.accum -= this.tPerShot) {
                this.materializeBullet();
            }
        }
    }
    reassign(i,x,y) {
        if (this.reassigned) {
            return;
        }
        this.reassigned = true;

        let newB = toBlock(this.p1[0], this.p1[1]);
        if (newB[0] != x || newB[1] != y) {
            RegionHandler[x][y].lines.splice(i,1);
            RegionHandler[newB[0]][newB[1]].lines.push(this);
        }
        let c = Math.cos(Game.time*3 + this.p1[0] + this.p1[1])/6 + 0.1;
        let col = [this.color[0], this.color[1]+c, this.color[2], this.color[3]];
        GlManager.addLine(col, this.p1, this.p2, this.r, 0);
        GlManager.addCircle(col, this.p1, this.r*7-0.04, this.r*7, -1, 7, 0, 0);
        GlManager.addCircle(col, this.p2, this.r*7-0.04, this.r*7, -1, 7, 0, 0);
    }
}
class BlockPiece {
    constructor(x,y) {
        this.bullets = [];
        this.circles = [];
        this.lines = [];
        this.proxim = proximB([x,y]);
        this.x = x;
        this.y = y;
    }
    simulate(delta) {
        for (var i = 0; i < this.lines.length; i++) {
            this.lines[i].simulate(delta);
        }
        for (var i = 0; i < this.circles.length; i++) {
            this.circles[i].simulate(delta);
        }
        for (var i = 0; i < this.bullets.length; i++) {
            this.bullets[i].simulate(delta, this.x, this.y);
        }
    }
    reassign() {//Note: the reassign function is also where renders get pushed to the queues
        for (var i = this.lines.length-1; i >= 0; i--) {
            this.lines[i].reassign(i, this.x, this.y);
        }
        for (var i = this.circles.length-1; i >= 0; i--) {
            this.circles[i].reassign(i, this.x, this.y);
        }
        for (var i = this.bullets.length-1; i >= 0; i--) {
            this.bullets[i].reassign(i, this.x, this.y);
        }
    }
}
class Text {
    constructor(text, x, y, font, fillStyle, proxim) {
        this.text = text;
        this.x = x/2;
        this.y = y/2;
        this.font = font;
        this.fillStyle = fillStyle;
        this.proxim = proxim;
        this.alpha = 1;
    }
    render(delta) {
        ctx.textAlign = 'center';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(.1/Configs.scale, .1/Configs.scale);
        ctx.font = this.font;
        ctx.fillStyle = this.fillStyle;
        let dist = distance([this.x*2,this.y*2],[Player.x,Player.y]);
        if (dist > this.proxim) {
            this.alpha = approach(this.alpha, 0, 3*delta);
        } else if (dist < this.proxim) {
            this.alpha = approach(this.alpha, 1, 3*delta);
        }
        ctx.globalAlpha = this.alpha;
        ctx.fillText(this.text, 10*(this.x+Game.cam[0]/2+12), 10*(13.5-this.y-Game.cam[1]/2-6.75));
        ctx.globalAlpha = 1;
    }
}
let blockSize = 16;
class Level {
    constructor(startPt, faces, dims, circles, lines, text) {
        this.startPt = startPt;
        this.faces = faces;
        this.dims = dims;
        this.blockSize = blockSize;
        this.circles = circles;
        this.lines = lines;
        this.text = text;
    }
    start() {
        Player.set();
        Player.x = this.startPt[0];
        Player.y = this.startPt[1];
        Player.faces = this.faces;
        let bW = this.dims[0];
        let bH = this.dims[1];
        RegionHandler = new Array(bW);
        for (var i = 0; i < RegionHandler.length; i++) {
            RegionHandler[i] = new Array(bH);
            for (var j = 0; j < RegionHandler[i].length; j++) {
                RegionHandler[i][j] = new BlockPiece(i,j);
            }
        }
        for (var i = 0; i < this.circles.length; i++) {
            let block = toBlock(this.circles[i].center[0], this.circles[i].center[1]);
            RegionHandler[block[0]][block[1]].circles.push(this.circles[i]);
        }
        for (var j = 0; j < this.lines.length; j++) {
            let block = toBlock(this.lines[j].p1[0], this.lines[j].p1[1]);
            RegionHandler[block[0]][block[1]].lines.push(this.lines[j]);
        }
    }
    simulate(delta) {
        let boundsW = [clamp(tB(Player.x-12)-1,0,RegionHandler.length-1), clamp(tB(Player.x+12)+1,0,RegionHandler.length-1)];
        let boundsH = [clamp(tB(Player.y-12)-1,0,RegionHandler[0].length-1), clamp(tB(Player.y+12)+1,0,RegionHandler[0].length-1)];
        for (var i = boundsW[0]; i <= boundsW[1]; i++) {
            for (var j = boundsH[0]; j <= boundsH[1]; j++) {
                RegionHandler[i][j].simulate(delta);
            }
        }
        for (var i = boundsW[0]; i <= boundsW[1]; i++) {
            for (var j = boundsH[0]; j <= boundsH[1]; j++) {
                RegionHandler[i][j].reassign();
            }
        }
    }
};
/*examples:
new Repeller(2, [3,20,0], 1.5, 3, 0, 90,[.5,0,.3,.2], 6, 20, 100, [0,0,0,0])
new Segment(1, [6.,3,0], [14,3,0], [.5,.5], 10, 30, 100, 0.04, 3)
new Text("WASD to move",1,0,"6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 7)
*/
let scale0 = 2;
let levels = [
    /*
    new Level([13*scale0,10*scale0], [0,0,0,0], [12,12], 
    [//circle
        
    ], [//line
        
    ], [//text
        
    ])*/
    new Level(/*start pt*/[13*scale0,10*scale0], /*faces */[0,0,0,0], /*dims*/ [12,12], [//circle
        new Repeller(1, [28*scale0,30*scale0,0], 1.5, 3, 267, 273,[1,0,0,0], 6, 20, 100, [0,0,0,0]),
        new Repeller(1, [53*scale0,8*scale0,0], 1.5, 3, 177, 183,[1,0,0,0], 6, 20, 100, [0,0,0,0]),
        new Repeller(3, [53*scale0,19*scale0,0], 1.5, 3, 177, 183,[1,0,0,0], 6, 20, 100, [0,0,0,0]),
    ], [//line
        ...splitLine(0, [10.*scale0,2*scale0,0], [16*scale0,2*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [10.*scale0,2*scale0,0], [6*scale0,6*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [20.*scale0,6*scale0,0], [16*scale0,2*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [6*scale0,6*scale0,0], [6*scale0,12*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [6.*scale0,12*scale0,0], [10*scale0,16*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [10.*scale0,16*scale0,0], [10*scale0,22*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [10.*scale0,22*scale0,0], [24*scale0,36*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [24*scale0,36*scale0,0], [30*scale0,36*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [30*scale0,36*scale0,0], [34*scale0,32*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [34*scale0,32*scale0,0], [34*scale0,26*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [34*scale0,26*scale0,0], [30*scale0,26*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [30*scale0,26*scale0,0], [30*scale0,16*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [30*scale0,16*scale0,0], [38*scale0,10*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [38*scale0,10*scale0,0], [50*scale0,10*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [50*scale0,10*scale0,0], [50*scale0,12*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [50*scale0,12*scale0,0], [46*scale0,16*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [46*scale0,16*scale0,0], [46*scale0,22*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [46*scale0,22*scale0,0], [50*scale0,26*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [50*scale0,26*scale0,0], [56*scale0,26*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [56*scale0,26*scale0,0], [60*scale0,22*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [60*scale0,22*scale0,0], [60*scale0,16*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [60*scale0,16*scale0,0], [56*scale0,12*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [56*scale0,12*scale0,0], [56*scale0,6*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [56*scale0,6*scale0,0], [34*scale0,6*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [34*scale0,6*scale0,0], [26*scale0,12*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [26*scale0,12*scale0,0], [26*scale0,26*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [26*scale0,26*scale0,0], [22*scale0,26*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [22*scale0,26*scale0,0], [22*scale0,28*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [22*scale0,28*scale0,0], [16*scale0,22*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [16*scale0,22*scale0,0], [16*scale0,16*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [16*scale0,16*scale0,0], [20*scale0,12*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [20*scale0,12*scale0,0], [20*scale0,6*scale0,0], [.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(0, [0,0,0], [0,0,0], [.5,.5], 10, 30, 100, 0.04, 3),
    ], [//text
        new Text("WASD to move",13*scale0,8*scale0,"6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 7),
        new Text("Block bullets with shield",28*scale0,32*scale0,"6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 15),
        new Text("Touch teleporter to proceed",53*scale0,16*scale0,"6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 10),
    ]),
    new Level(/*start pt*/[17.5,12.5]/*[100,70]*/, /*faces */[0,0,0,0], /*dims*/ [12,12], 
    [//circle
        new Repeller(2, [85,20,0], 1.5, 3, 0, 90,[.5,0,.3,.2], 6, 20, 100, [2,2,2,3]),
        new Repeller(3, [117.5,67.5,0], 1, 2, 177, 183,[1,0,0,0], 6, 20, 100, [0,0,0,0]),
    ], [//line
        ...makeMesh(0, [.5,.5], 10, 30, 100, 0.04, 3,
            [[10,5],[25,5],[25,10],[100,10],[100,45],[65,45],[65,40],[55,40],[55,55],
            [85,55],[85,60],[110,60],[110,65],[120,65],[120,70],[110,70],[110,75],
            [85,75],[85,80],[35,80],[35,55],[45,55],[45,30],[65,30],[65,20],[25,20],
            [25,25],[10,25]]),
        ...splitLine(0, [65,30],[90,30],[.5,.5], 10, 30, 100, 0.04, 3),
        ...splitLine(1, [80,75],[40,75],[.5,.5], 10, 30, 100, 0.04, 3),
    ], [//text
        new Text('Touch to change die configuration', 85, 25, "6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 17),
        new Text('Larger shield values (size) are weaker', 80, 40, "6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 10),
        new Text('Use timing to your advantage.',60,70,"6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 19),
    ]),
    new Level([110,80], [1,1,3,3], [12,12], 
    [//circle
        new Repeller(2, [30,45,0], 1.5, 3, 0, 90,[.5,0,.3,.2], 6, 20, 100, [0,1,2,2]),
        new Repeller(2, [45,10,0], 1.5, 3, 0, 90,[.5,0,.3,.2], 6, 20, 100, [0,3,3,3]),
        new Repeller(3, [125,10,0], 1.5, 3, 177, 183,[1,0,0,0], 6, 20, 100, [0,0,0,0]),
        new Repeller(1, [30,20,0], 1.5, 3, 0, 360,[0.5,0,.3,.2], 20, 20, 100, [0,0,0,0]),
    ], [//line
        ...makeMesh(0, [.5,.5], 10, 30, 100, 0.04, 3, 
            [[115,65],[115,85],[85,85],[85,80],[40,80],[40,85],[15,85],[15,55],[25,55],[25,35],[15,35],[15,5],
            [85,5],[85,25],[105,5],[130,5],[130,15],[115,15],[95,35],[35,35],[35,55],[40,55],[40,70],[85,70],[85,65]]),
        ...splitLine(1, [55,80],[55,75],[1], 10, 30, 100, 0.04, 3),
        ...splitLine(1, [70,70],[70,75],[0,0,1], 5, 30, 100, 0.04, 3),
        ...splitLine(1, [20,70],[20,60],[0,0,1], 5, 30, 100, 0.04, 3),
        ...splitLine(1, [45,35],[45,15],[0.9,0,0,.1], 10, 30, 100, 0.04, 3),
    ], [//text
        
    ]),
    new Level([20,80], [0,0,0,0],[12,12], 
    [//circle
        new Repeller(3, [110,40,0], 1.5, 3, 177, 183,[1,0,0,0], 6, 20, 100, [0,0,0,0]),
        new Repeller(2, [32.5,80,0], 1.5, 3, 0, 90,[.5,0,.3,.2], 6, 20, 100, [1,1,1,1]),
        new Repeller(2, [57.5,80,0], 1.5, 3, 0, 90,[.5,0,.3,.2], 6, 20, 100, [2,2,2,2]),
        new Repeller(2, [82.5,80,0], 1.5, 3, 0, 90,[.5,0,.3,.2], 6, 20, 100, [3,3,3,3]),
        new Repeller(1, [45,72.5,0], 1.5, 2, 80, 100,[.5,.3,.2,0], 6, 40, 50, [3,3,3,3]),
        new Repeller(1, [45,87.5,0], 1.5, 2, 260, 280,[.5,.3,.2,0], 6, 40, 50, [3,3,3,3]),
        //new Repeller(1, [45,72.5,0], 1.5, 2, 225, 315,[.5,.3,.2,0], 6, 20, 100, [3,3,3,3]),
    ], [//line
        ...makeMesh(0, [.5,.5], 10, 30, 100, 0.04, 3, [[10,70],[10,90],[30,90],[30,85],[35,85],[35,90],[55,90],[55,85],[60,85],[60,90],[80,90],[80,85],[95,85],
            [115,65],[115,35],[105,35],[105,55],[85,75],[80,75],[80,70],[60,70],[60,75],[55,75],[55,70],[35,70],
            [35,75],[30,75],[30,70],[10,70]]),
        ...splitLine(1, [60,72.5],[80,72.5],[0.5,0,0.2,.3], 19, 30, 100, 0.04, 3),
        ...splitLine(1, [110,65],[95,80],[0.8,0.2], 15, 30, 100, 0.04, 3),
    ], [//text
        
    ]),
    new Level(/*[25,60]*/[25,60], [0,1,2,3], [12,12], 
        [//circle
        new Repeller(3, [25,50,0], 1.5, 3, 0, 183,[1,0,0,0], 6, 20, 100, [0,0,0,0]),
        new Repeller(1, [60,70,0], 1.5, 3, 0, 360,[.5,.3,.2,0], 12, 40, 50, [3,3,3,3]),
        new Repeller(1, [75,55,0], 1.5, 3, 0, 360,[.5,.3,.2,0], 12, 40, 50, [3,3,3,3]),
        new Repeller(1, [60,40,0], 1.5, 3, 0, 360,[.5,.3,.2,0], 12, 40, 50, [3,3,3,3]),
        ], [//line
        ...makeMesh(0, [.5,.5], 10, 30, 100, 0.04, 3, [[20,45],[20,65],[40,65],[50,75],[50,85],[70,85],[70,75],[80,65],[90,65],[90,45],[80,45],[70,35],
            [70,25],[50,25],[50,35],[40,45]]),
            ...splitLine(0, [20,55],[50,55],[0.8,0.2], 15, 30, 100, 0.04, 3),
            ...makeMesh(0, [.5,.5], 10, 30, 100, 0.04, 3, [[60,45],[50,55],[60,65],[70,55]]),
        ], [//text
            
        ]),
    new Level([35,35], [3,3,3,3], [12,12], 
        [//circle
            
        ], [//line
        ...makeMesh(0, [.5,.5], 10, 30, 100, 0.04, 3, [[20,25],[20,40],[50,40],[50,25]]),
        ...splitLine(1, [22.5,27.5],[47.5,27.5],[1.,0,0,0], 15, 30, 100, 0.04, 2),
        ], [//text
            new Text('Thanks for playing!',35,30,"6px 'Roboto Mono', monospace", 'rgba(255,255,255,0.7)', 7),
        ])
];

let RegionHandler;
let shieldStates = [
    [
        [
            toRad(60), toRad(120)
        ],
        [
            toRad(270), toRad(270)
        ]
    ],
    [
        [
            toRad(60), toRad(120)
        ],
        [
            toRad(240), toRad(300)
        ]
    ],
    [
        [
            toRad(0), toRad(180)
        ],
        [
            toRad(270), toRad(270)
        ]
    ],
    [
        [
            toRad(0), toRad(180)
        ],
        [
            toRad(180), toRad(360)
        ]
    ],

];
let Player = {
    set() {
        this.x = 0;
        this.y = 0;
        this.vx = 0; this.friction = 5.;
        this.vy = 0; this.topSpeed = 20;
        this.ax = 0; this.accel = 200;
        this.ay = 0;

        this.dead = false;
        this.triAngle = 0;
        this.vTriAngle = 4;

        this.angle = 0;

        this.facetimer = 0; //timer tells which face is in use
        this.faces = [0,0,0,0];
        this.shieldType = 0; //kind of misleading name; it is the index pointing to faces
        //transformed 90 degrees to make it easy on the shader
        this.shieldState = [[toRad(90),toRad(90)],[toRad(270),toRad(270)]]; //first <= second for both arcs
        this.transitionSpeed = 10;
        this.shieldThickness = .2;

        this.playerFaceChange = false;
        this.faceChangeState = 0;
        this.volume = 0.2;
        
    },
    transitionShieldState(delta) {
        let face = this.faces[this.shieldType];
        let sum = 0;
        for (var i = 0; i < this.shieldState.length; i++) {
            for (var j = 0; j < this.shieldState[i].length; j++) {
                this.shieldState[i][j] = approach(this.shieldState[i][j],shieldStates[face][i][j], this.transitionSpeed * delta);
            }
            sum += this.shieldState[i][1]-this.shieldState[i][0];
        }
        this.shieldThickness = .2*(3*Math.PI-sum)/(3*Math.PI);
    },
    inShield(radial) { //checks if the angle to the radial is in shield 
        let angle = Math.atan2(radial[1], radial[0]);
        let arcs = [[Player.shieldState[0][0]+Player.angle-toRad(90),Player.shieldState[0][1]+Player.angle-toRad(90)],[Player.shieldState[1][0]+Player.angle-toRad(90),Player.shieldState[1][1]+Player.angle-toRad(90)]];
        return btwn(angle,arcs[0]) || btwn(angle,arcs[1]);
    },
    checkCollisions(delta) {
        let faceChange = false;
        this.faceChangeState = Math.max(this.faceChangeState-delta*3, 0);
        let currB = toBlock(this.x,this.y);
        let near = proximB(currB);
        let minDist = 1000;
        for (var i = 0; i < near.length; i++) {
            let block = RegionHandler[near[i][0]][near[i][1]];
            let radial = [0,0];
            for (var j = 0; j < block.lines.length; j++) {
                let line = block.lines[j];
                let dist = line.distTo([Player.x,Player.y], [0,0]);
                if (dist[0] < line.r+1.1) {
                    UI.nextDir = 1;
                    this.dead = true;
                } else if (dist[0] < line.r + 2.6) {
                    let dir = normalize(subtract([Player.x,Player.y],dist[2]));
                    radial = add(scale(dir,line.sforce*1/Math.pow(dist[0],2)),radial);
                }
                minDist = Math.min(dist[0], minDist);
            }
            for (var j = 0; j < block.circles.length; j++) {
                let circle = block.circles[j];
                let dist = distance([Player.x,Player.y], circle.center);
                if (circle.type == 2) {
                    if (dist < circle.R + 1.1) {
                        faceChange = true;
                        this.faceChangeState = 1;
                        circle.hit = true;
                        this.faces = circle.faces;
                    } else {
                        circle.hit = false;
                    }
                    continue;
                }
                if (dist < circle.R + 1.1) {
                    UI.nextDir = 1;
                    if (circle.type != 3) {
                        this.dead = true;
                    }
                } else if (dist < circle.R + 2.6 && circle.type != 3) {
                    let dir = normalize(subtract([Player.x,Player.y], circle.center));
                    radial = add(scale(dir,circle.sforce*10/Math.pow(dist,2)),radial);
                }
                minDist = Math.min(dist, minDist);
            }
            for (var j = 0; j < block.bullets.length; j++) {
                let bullet = block.bullets[j];
                let dist = distance([Player.x,Player.y], bullet.center);
                if (dist < bullet.r + 1.1 && bullet.del == bullet.delDur) {
                    bullet.vx = 0;
                    bullet.vy = 0;
                    UI.nextDir = 1;
                    this.dead = true;
                }
            }
            Player.vx += 17*radial[0]*delta;
            Player.vy += 17*radial[1]*delta;

            
            if (this.dead == true) {
                Player.vx /= 2;
                Player.vy /= 2;
                Audio.play('die');
                return;
            }
        }
        Audio['liquid'].volume = Math.min(1/Math.pow(minDist,1),0.2)+0.;
        this.playerFaceChange = faceChange;
    }
};
Player.set();
let Game = {
    set() {
        this.time = 0; //time since level start, ms
        this.timescale = 1;
        this.past = 0; //the value of the last performance.now() call
        this.cam = [0,0,0];
    }
}
Game.set();
let foldR = 1;
let split = 1.5;
let unfold = [
    [
        [0,-foldR, 0], [-Math.sqrt(3)/2*foldR, 1/2*foldR, 0], [Math.sqrt(3)/2*foldR, 1/2*foldR, 0]
    ],
    [
        [0, foldR, 0], [Math.sqrt(3)/2*foldR, -1/2*foldR, 0], [-Math.sqrt(3)/2*foldR, -1/2*foldR, 0]
    ],
    [
        [0, foldR, 0], [Math.sqrt(3)/2*foldR, -1/2*foldR, 0], [-Math.sqrt(3)/2*foldR, -1/2*foldR, 0]
    ],
    [
        [0, foldR, 0], [Math.sqrt(3)/2*foldR, -1/2*foldR, 0], [-Math.sqrt(3)/2*foldR, -1/2*foldR, 0]
    ]
];
for (var i = 1; i < unfold.length; i++) {
    let angle = (i-1)*Math.PI*2/3+Math.PI/2;
    let offset = [Math.cos(angle)*split,Math.sin(angle)*split];
    for (var j = 0; j < unfold[i].length; j++) {
        unfold[i][j][0] += offset[0];
        unfold[i][j][1] += offset[1];
    }
}
for (var i = 0; i < unfold.length; i++) {
    for (var j = 0; j < unfold[i].length; j++) {
        unfold[i][j][0] += 12 - 1.6;
        unfold[i][j][1] += 6.75 - 1.6;
    }
}
let vcv = 2*Math.atan(Math.sqrt(2));
let topV = [-Math.cos(vcv)*foldR,foldR,0];
let foldVs = [[-foldR,0,0],topV,rotate(topV,0,Math.PI*2/3),rotate(topV,0,Math.PI*4/3)];
let fold = [
    [
        foldVs[1], foldVs[2], foldVs[3]
    ],
    [
        foldVs[0], foldVs[1], foldVs[2]
    ],
    [
        foldVs[0], foldVs[2], foldVs[3]
    ],
    [
        foldVs[0], foldVs[3], foldVs[1]
    ]
]
let UI = {
    set() {
        this.mid = [12, 6.75];
        this.r0 = 2.4;
        this.r1 = 1.4;
        this.map = {
            '0' : 0,
            '3' : 1,
            '1' : 2,
            '2' : 3,
        }
        this.menuOpen = 0;
        this.menuDir = 1; //Decides which direction to go (open or close menu);
        this.next = 0;
        this.nextDir = 0;
        this.tetra = {
            config : [0, 0, 0],
            pts : [],
            displayPts : [],
            polarity : 0.,
            r : foldR,
            s : foldR*Math.sqrt(3),
            setPts : function() {
                this.pts = new Array(4);
                this.displayPts = new Array(4);
                for (var i = 0; i < this.pts.length; i++) {
                    this.pts[i] = new Array(3);
                    this.displayPts[i] = new Array(3);
                    for (var j = 0; j < this.pts[i].length; j++) {
                        for (var k = 0; k < this.config.length; k++) {
                            this.displayPts[i][j] = new Array(2);
                            this.pts[i][j] = rotate(fold[i][j], k, this.config[k]);
                        }
                    }
                }
            },
            movePts : function() {
                this.config[2] = Player.facetimer;
                this.config[1] = Player.facetimer;
                this.config[0] = Math.sin(Player.facetimer)/2 - 0.5;
                for (var i = 0; i < this.pts.length; i++) {
                    for (var j = 0; j < this.pts[i].length; j++) {
                        for (var k = 0; k < this.config.length; k++) {
                            if (k == 0) {
                                this.pts[i][j] = rotate(fold[i][j], k, this.config[k]);
                            } else {
                                this.pts[i][j] = rotate(this.pts[i][j], k, this.config[k]);
                            }
                        }
                    }
                }
            },
            interpolate : function() {
                for (var i = 0; i < this.pts.length; i++) {
                    for (var j = 0; j < this.pts[i].length; j++) {
                        for (var k = 0; k < this.pts[i][j].length; k++) {
                            this.displayPts[i][j][k] = lerp(this.pts[i][j][k], unfold[i][j][k], this.polarity);
                        }
                    }
                }
            },
            render : function() {
                this.movePts();
                this.interpolate();
                ctx.strokeStyle = 'rgb(0,255,255)';
                ctx.fillStyle = 'rgb(0,255,255)';
                ctx.font = "3px 'Roboto Mono', monospace";
                ctx.textAlign = 'center';
                ctx.textBaseLine = 'middle';
                ctx.lineWidth = 0.03;
                ctx.lineCap = 'round';
                let offset = [1.6,1.6];
                for (var i = 0; i < this.displayPts.length; i++) {
                    let ctr = centroid(this.displayPts[i]);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.scale(.1/Configs.scale, .1/Configs.scale);
                    if (this.polarity == 0) {
                        ctx.globalAlpha = 1/Math.pow(1-ctr[2],4);
                        if (UI.map[i] == Player.shieldType) {
                            ctx.fillText(Player.faces[UI.map[i]]+1,10*(ctr[0]+offset[0]),10*(13.5-ctr[1]-offset[1]));
                        }
                        ctx.globalAlpha = 1;
                    } else {
                        ctx.globalAlpha = 1/Math.pow(1-ctr[2],4);
                        ctx.fillText(Player.faces[UI.map[i]]+1,10*(ctr[0]+offset[0]),10*(13.5-ctr[1]-offset[1]));
                        ctx.globalAlpha = 1;
                    }
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.scale(1/Configs.scale, 1/Configs.scale);
                    for (var j = 0; j < this.displayPts[i].length; j++) {
                        let next = (j+1)%3;
                        let pt1 = add([this.displayPts[i][j][0], this.displayPts[i][j][1]], offset);
                        let pt2 = add([this.displayPts[i][next][0], this.displayPts[i][next][1]], offset);
                        ctx.beginPath();
                        ctx.moveTo(pt1[0],13.5-pt1[1]);
                        ctx.lineTo(pt2[0],13.5-pt2[1]);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.arc(pt1[0],13.5-pt1[1],0.15,0,2*Math.PI);
                        ctx.fill();
                    }
                }
            }
        }
        this.tetra.setPts();
    }
}
UI.set();
//Initialization
resize();
getInput();


//Render
let RenderFunctions = {
    start : function () {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(.1/Configs.scale, .1/Configs.scale);
        ctx.fillStyle = 'rgb(255,255,255)';
        ctx.font = "10px 'Roboto Mono', monospace";
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
        ctx.fillText("FACE SHIELD", 120, 9*6.75);
        ctx.font = "5px 'Roboto Mono', monospace";
        ctx.globalAlpha = Math.cos(performance.now()/300)/3 + 0.6;
        ctx.fillText("Press any key", 120, 11*6.75);
        if (Input.press) {
            ScreenManager.currentScreen = 'level';
            Audio.play('lc');
            Audio.play('liquid');
            levels[ScreenManager.currentLevel].start();
        }
    },
    level : function() {
        let pureDelta = Math.min(performance.now() - Game.past, 20) / 1000;
        let delta = Math.min(performance.now() - Game.past, 20) * Game.timescale / 1000;//min fps 50
        Game.past = performance.now();
        Game.time += delta;
        
        //adding stuff to draw queue
        let mousePos = Input.centeredMousePos;
        Player.angle = Math.atan2(mousePos[1],mousePos[0]);
        
        GlManager.resetCircle();
        GlManager.resetLine();
        GlManager.resetTri();
        
        levels[ScreenManager.currentLevel].simulate(delta);
        this.playerSim(delta);
        let r = 1.3;
        let scalar = 0;
        if (Player.dead) {
            let clamped = Math.min(UI.next,1);
            let cubic = Math.pow(1-clamped,3);
            Player.shieldThickness *= cubic;
            scalar = 1-cubic;
        }
        for (var i = 0; i < Player.shieldState.length; i++) {
            let arc = fixArc([Player.shieldState[i][0], Player.shieldState[i][1]]);
            GlManager.addCircle([0.5, 1, 1,1],[Player.x,Player.y,0],r-Player.shieldThickness,r,arc[0],arc[1], Player.angle-toRad(90), 0);
        }
        GlManager.addTri([1., 1, 1,1],[Player.x+mousePos[0]*2,Player.y+mousePos[1]*2,0],0.2,.4,-Player.angle);

        let wobble = Math.sin(Game.time*2.3) * 0.02 + 1;
        GlManager.addCircle([0.5,1,1,1-scalar],[Player.x,Player.y,0],.95*wobble+0.2*scalar,1.0*wobble+0.2*scalar,-1,7,0, 0);
        GlManager.addTri([0.5,1,1,1-scalar],[Player.x,Player.y,0],0.3+0.2*scalar,.85+0.2*scalar,Player.triAngle);
        
        Game.cam = [-Player.x+Player.vx/100, -Player.y+Player.vy/100,0];
        
        this.renderUI(delta, pureDelta);

        //Actually drawing the queue
        gl.useProgram(Programs.c.program);
        var uniforms = {
            u_matrix : twgl.m4.translate(GlManager.screenMat,Game.cam),
        };
        const bI1 = twgl.createBufferInfoFromArrays(gl, GlManager.circleQueue);
        twgl.setBuffersAndAttributes(gl,Programs.c,bI1);
        twgl.setUniforms(Programs.c, uniforms);
        gl.drawArrays(gl.TRIANGLES, 0, GlManager.numcirclev);

        gl.useProgram(Programs.l.program);
        const bI2 = twgl.createBufferInfoFromArrays(gl, GlManager.lineQueue);
        twgl.setBuffersAndAttributes(gl,Programs.l,bI2);
        twgl.setUniforms(Programs.l, uniforms);
        gl.drawArrays(gl.TRIANGLES, 0, GlManager.numlinev);

        gl.useProgram(Programs.t.program);
        const bI3 = twgl.createBufferInfoFromArrays(gl, GlManager.triQueue);
        twgl.setBuffersAndAttributes(gl,Programs.t,bI3);
        twgl.setUniforms(Programs.t, uniforms);
        gl.drawArrays(gl.TRIANGLES, 0, GlManager.numtriv);
    },
    playerSim(delta) {
        Player.triAngle = (Player.triAngle + Player.vTriAngle * delta * 1.6)%(2*Math.PI);
        Player.vx += Input.vector[0] * Player.accel * delta;
        Player.vy += Input.vector[1] * Player.accel * delta;

        Player.vx += Player.ax * delta;
        Player.vy += Player.ay * delta;
        //let dragx = -0.5 * Player.friction * Math.pow(Player.vx,2) * Math.sign(Player.vx);
        //let dragy = -0.5 * Player.friction * Math.pow(Player.vy,2) * Math.sign(Player.vy);
        let dragx = -0.5 * Player.friction *  Player.vx;
        let dragy = -0.5 * Player.friction * Player.vy;
        Player.vx += dragx * delta;
        Player.vy += dragy * delta;

        let absX = Math.abs(Player.vx);
        let absY = Math.abs(Player.vy);
        absX = Math.max(absX - 20. * delta, 0);
        absY = Math.max(absY - 20. * delta, 0);

        Player.vx = absX * Math.sign(Player.vx);
        Player.vy = absY * Math.sign(Player.vy);

        //Player.vTriAngle = clamp(Player.vTriAngle - Input.delta*0.5, 2, 5);
        Input.delta = 0;

        Player.facetimer += Player.vTriAngle * delta / 2;
        Player.shieldType = Math.floor(Player.facetimer/(2*Math.PI/4))%4;
        Player.transitionShieldState(delta);

        if (UI.menuOpen == 0 && !Player.dead) {//don't process death until menu closed
            Player.checkCollisions(delta);
        }

        let speed = Math.min(Player.topSpeed, Math.hypot(Player.vx, Player.vy));
        let n = normalize([Player.vx,Player.vy]);
        Player.vx = speed*n[0];
        Player.vy = speed*n[1];
        Player.x += Player.vx * delta;
        Player.y += Player.vy * delta;
    },
    renderUI(delta, pureDelta) {
        ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
        ctx.globalCompositeOperation = 'lighter';
        let currLevel = levels[ScreenManager.currentLevel];
        for (var i = 0; i < currLevel.text.length; i++) {
            currLevel.text[i].render(delta);
        }
        ctx.globalCompositeOperation = 'source-over';

        let mousePos = Input.bLMousePos;
        let dist = distance(mousePos, [1.6, 1.6]);
        if (dist < UI.r0) {
            UI.r0 = Math.min((UI.r0) + delta*2,2.6);
            if (Input.click && UI.menuOpen == 0 && UI.nextDir == 0) {
                UI.menuOpen = 0.0001;
                UI.menuDir = 1;
                Audio.play('mo');
            }
        } else {
            UI.r0 = Math.max((UI.r0)- delta*3, 2.5);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(1/Configs.scale, 1/Configs.scale);
        ctx.fillStyle = 'rgba(0,255,255,'+(0.2 + Player.faceChangeState/3)+')';
        ctx.strokeStyle = 'rgba(0,255,255,0.4)';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.arc(1.6,13.5-1.6,UI.r0, 0, 2*Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(1.6,13.5-1.6,0.95*UI.r0, 0, 2*Math.PI);
        ctx.stroke();

        /*ctx.fillStyle = 'rgba(0,255,255,0.2)';
        ctx.strokeStyle = 'rgba(0,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(6.2,13.5-1.6,UI.r1, 0, 2*Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(6.2,13.5-1.6,0.95*UI.r1, 0, 2*Math.PI);
        ctx.stroke();*/

        if (UI.menuOpen > 0) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(.1/Configs.scale, .1/Configs.scale);
            if (UI.menuDir == 1) {
                UI.menuOpen = Math.min(1, UI.menuOpen + pureDelta*2);
            } else if (UI.menuDir == -1) {
                UI.menuOpen = Math.max(0, UI.menuOpen - pureDelta*2);
            }
            ctx.fillStyle = 'rgba(0,0,0,' + UI.menuOpen + ')';
            ctx.fillRect(0,0,10*24,10*13.5);
            Game.timescale = 0;
            let ease = 3*Math.pow(UI.menuOpen,2) - 2*Math.pow(UI.menuOpen,3);
            UI.tetra.polarity = ease;
            ctx.globalAlpha = Math.pow(UI.menuOpen,2);
            ctx.fillStyle = 'rgb(255,255,255)';
            ctx.font = "4px 'Roboto Mono', monospace";
            ctx.fillText('Press escape to play.',10*12, 10*3);
            ctx.font = "10px 'Roboto Mono', monospace";
            ctx.fillText('PAUSED', 10*12, 10*2);
            if (Input.esc) {
                UI.menuDir = -1;
                Audio.play('mc');
            }
            UI.r0 = 2.5;
        } else {
            Game.timescale = 1;
            UI.tetra.polarity = 0;
        }
        UI.tetra.render();
        if (UI.nextDir != 0) {
            if (UI.nextDir == 1) {
                UI.next = Math.min(1.1, UI.next + pureDelta*2);
            } else if (UI.nextDir == -1) {
                UI.next = Math.max(0, UI.next - pureDelta*2);
            }
            if (UI.next == 1.1) {
                UI.nextDir = -1;
                if (Player.dead) {
                    Player.dead = false;
                } else {
                    ScreenManager.currentLevel++;
                    Audio.play('lc');
                }
                levels[ScreenManager.currentLevel].start();
            }
            if (UI.next == 0 && UI.nextDir == -1) {
                UI.nextDir = 0;
            }
            let clamped = Math.min(UI.next,1);
            let cubic = 1-Math.pow(1-clamped,3);
            Game.timescale = 1-cubic;
            ctx.fillStyle = 'rgb(0,0,0)';
            let y1 = 6.76*cubic;
            let y2 = 13.5-y1;
            ctx.fillRect(0,0,24,y1);
            ctx.fillRect(0,y2,24,13.5-y2);
        }
        ctx.globalAlpha = 1;
       
    }
}
function render() {
    window.requestAnimationFrame(render);
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE,gl.ONE);
    //gl.enable(gl.BLEND);
    //gl.disable(gl.DEPTH_TEST);
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0.0,0.1,0.1,1.);
    gl.clear(gl.COLOR_BUFFER_BIT);
    RenderFunctions[ScreenManager.currentScreen]();
    Input.click = false;
    Input.esc = false;
}
window.requestAnimationFrame(render);


//Event listeners
function getInput() {
    window.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', function(e) {
        switch (e.key) {
            case 'w':
                Input.wasd[0] = 1;
                break;
            case 'a':
                Input.wasd[1] = 1;
                break;
            case 's':
                Input.wasd[2] = 1;
                break;
            case 'd':
                Input.wasd[3] = 1;
                break;
            case 'Escape':
                Input.esc = true;
                break;
        }
        Input.press = true;
    });
    window.addEventListener('keyup', function(e) {
        switch (e.key) {
            case 'w':
                Input.wasd[0] = 0;
                break;
            case 'a':
                Input.wasd[1] = 0;
                break;
            case 's':
                Input.wasd[2] = 0;
                break;
            case 'd':
                Input.wasd[3] = 0;
                break;
        }
    });
    window.addEventListener('wheel', function(e) {
        Input.delta = Math.sign(e.deltaY);
    });
    txt.addEventListener('mousemove', function(e) {
        Input.mousepos = [e.offsetX, e.offsetY];
    });
    window.addEventListener('mousedown', function(e) {
        Input.click = true;
    });
}
function resize() {
    Configs.resolution = [window.innerWidth, window.innerHeight];
    let w = Math.round(window.innerHeight * 16/9);
    let h = Math.round(window.innerWidth * 9/16);
    let t = 0;
    let l = 0;
    if (w <= window.innerWidth) {
        l = (window.innerWidth-w)/2;
        Configs.resolution[0] = w;
    } else {
        t = (window.innerHeight-h)/2;
        Configs.resolution[1] = h;
    }
    canvas.width = Configs.resolution[0];
    canvas.height = Configs.resolution[1];
    canvas.style.width = Configs.resolution[0] + 'px';
    canvas.style.height = Configs.resolution[1] + 'px';
    canvas.style.top = t + 'px';
    canvas.style.left = l + 'px';
    txt.width = Configs.resolution[0];
    txt.height = Configs.resolution[1];
    txt.style.width = Configs.resolution[0] + 'px';
    txt.style.height = Configs.resolution[1] + 'px';
    txt.style.top = t + 'px';
    txt.style.left = l + 'px';
    Configs.scale = Configs.xdim/Configs.resolution[0];
}

//Utility
function dgei(id) {
    return document.getElementById(id);
}
//exclusive for b
function rand(a, b) {
    return Math.random() * (b-a) + a;
}
function toRad(x) {
    return x * Math.PI / 180;
}
function toDeg(x) {
    return x * 180 / Math.PI;
}
//moves a toward b by an amt, but not exceeding
function approach(a, b, amt) {
    if (a > b) {
        return Math.max(b,a-amt);
    } else if (a < b) {
        return Math.min(b, a+amt);
    }
    return a;
}
function lerp(a,b, amt) {
    return a + (b-a) * amt;
}
//returns centroid given a face
function centroid(face) {
    let accum = [0,0,0];
    for (var i = 0; i < face.length; i++) {
        for (var j = 0; j < face[i].length; j++) {
            accum[j] += face[i][j]/3;
        }
    }
    return accum;
}

//In-game utility
function toBlock(x, y) {
    return [Math.floor(x/blockSize), Math.floor(y/blockSize)];
}
function tB(x) {
    return Math.floor(x/blockSize);
}

function splitLine(type, p1, p2, probs, rate, sforce, oforce, r, R) {
    let res = [];
    let length = distance(p1,p2);
    let cos = (p2[0]-p1[0])/length;
    let sin = (p2[1]-p1[1])/length;
    let l1 = length/Math.ceil(length/mLineLength);
    for (var i = 0; i < length; i+=l1) {
        let l = Math.min(l1, length-i);
        let np1 = [p1[0] + cos*i, p1[1] + sin*i, 0];
        let np2 = [p1[0] + cos*(i+l), p1[1] + sin*(i+l), 0];
        res.push(new Segment(type,np1, np2, probs, rate, sforce, oforce, r, R));
    }
    return res;
}
function makeMesh(type, probs, rate, sforce, oforce, r, R, points) {
    let mesh = [];
    for (var i = 0; i < points.length; i++) {
        let next = (i+1)%points.length;
        let p1 = points[i];
        let p2 = points[next];
        mesh.push(...splitLine(type, p1, p2, probs, rate, sforce, oforce, r, R));
    }
    return mesh;
}
//returns proximal blocks to b
function proximB(b) {
    let near = [];
    for (var i = -1; i < 2; i++) {
        for (var j = -1; j < 2; j++) {
            if (isValid([b[0] + i, b[1] + j])) {
                near.push([b[0] + i, b[1] + j]);
            }
        }
    }
    return near;
}
function isValid(b) {
    return b[0] >= 0 && b[1] >= 0 && b[0] < RegionHandler.length && b[1] < RegionHandler[0].length;
}
function randBullet(probs) {
    let pick = Math.random();
    let cur = 0;
    for (var i = 0; i < probs.length; i++) {
        cur += probs[i];
        if (pick < cur) {
            return i;
        }
    }
}
//puts both values of the arc in the right range, but has some limitations (domain is from -2 pi to 2 pi)
function fixArc(arc) {
    if (arc[0] < 0) { arc[0] += 2*Math.PI; }
    if (arc[1] < 0) { arc[1] += 2*Math.PI; }
    return [Math.min(arc[0],arc[1]), Math.max(arc[0],arc[1])];
}
function btwn(angle, arc) {
    if (angle > arc[1]) {
        while (angle > arc[1]) {
            angle -= 2*Math.PI;
        }
    } else if (angle < arc[0]) {
        while (angle < arc[0]) {
            angle += 2*Math.PI;
        }
    }
    return angle > arc[0] && angle < arc[1];
}


//Vector utility
function normalize(vec) {
    let len = Math.hypot(vec[0],vec[1]);
    if (len != 0) {
        return [vec[0]/len,vec[1]/len];
    }
    return vec;
}
function clamp(x, a, b) {
    return Math.max(Math.min(x,b),a);
}
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
}
function distance(a, b) {
    return Math.hypot(a[0]-b[0], a[1]-b[1]);
}
//a - b
function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}
function add(a,b) {
    return [a[0] + b[0], a[1] + b[1]];
}
function scale(a, s) {
    return [a[0] * s, a[1] * s];
}
//axes: 0 is x, 1 is y, 2 is z

function rotate(pt, axis, angle) {
    let x = pt[rSelect[axis][0]];
    let y = pt[rSelect[axis][1]];
    let dist = Math.hypot(x,y);
    let theta = Math.atan2(y,x);
    theta += angle;
    let newPt = [pt[0], pt[1], pt[2]];
    newPt[rSelect[axis][0]] = dist*Math.cos(theta);
    newPt[rSelect[axis][1]] = dist*Math.sin(theta);
    return newPt;
}
//sets pt instead of creating a new point
function rotate2(pt, axis, angle) {
    let x = pt[rSelect[axis][0]];
    let y = pt[rSelect[axis][1]];
    let dist = Math.hypot(x,y);
    let theta = Math.atan2(y,x);
    theta += angle;
    pt[rSelect[axis][0]] = dist*Math.cos(theta);
    pt[rSelect[axis][1]] = dist*Math.sin(theta);
}