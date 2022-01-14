"use strict";

// global variables ***************************************************
// canvas
let canvasWidth, canvasHeight;

// boid
let p;
let numBoid;
let wSeparation, wAlignment, wCohesion;
let radiusSeparation, radiusAlignment, radiusCohesion;
let maxVelocity;

// region
let region;
let cell;

// time
let time, timeDelta;

// control
let isRun;

// class *********************************************************
class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  magnitude() {
    return Math.sqrt(this.dot(this));
  }

  sub(v) {
    const x = this.x - v.x;
    const y = this.y - v.y;
    return new Vector(x, y);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  unit() {
    const mag = this.magnitude();
    if (mag > 0) {
      this.x /= mag;
      this.y /= mag;
    }
  }

  limitMax(value) {
    const mag = this.magnitude();
    if (mag > value) {
      this.x *= value / mag;
      this.y *= value / mag;
    }
  }
}

class Particle {
  constructor(x = 0, y = 0, vx = 0, vy = 0) {
    this.position = new Vector(x, y);
    this.velocity = new Vector(vx, vy);
    this.force = new Vector();
    this.active = true;
  }

  remove() {
    this.active = false;
  }

  indexX(cell) {
    return Math.floor((this.position.x - cell.region.left) / cell.h);
  }

  indexY(cell) {
    return Math.floor((this.position.y - cell.region.bottom) / cell.h);
  }

  indexCell(cell) {
    return this.indexX(cell) + this.indexY(cell) * cell.nx;
  }

  forNeighbor(cell, func) {
    const indexX = this.indexX(cell);
    const indexY = this.indexY(cell);

    for (let i = indexX-1; i <= indexX+1; i++) {
      if (i < 0 || i >= cell.nx) continue;

      for (let j = indexY-1; j <= indexY+1; j++) {
        if (j < 0 || j >= cell.ny) continue;
        const indexCell = i + j * cell.nx;

        for (let k = 0, n = cell.bucket[indexCell].length; k < n; k++) {
          const pNeighbor = cell.bucket[indexCell][k];
          const rv = this.position.sub(pNeighbor.position);
          if (rv.magnitude() >= cell.h) continue;

          func(pNeighbor, rv);
        }
      }
    }
  }
}

class Cell {
  constructor(region, h) {
    this.h = h;
    this.nx = Math.ceil(region.width / this.h);
    this.ny = Math.ceil(region.height / this.h);
    this.bucket = new Array(this.nx * this.ny);
    this.region = region;
  }

  clear() {
    for (let i = 0, n = this.bucket.length; i < n; i++) {
      this.bucket[i] = [];
    }
  }

  add(p) {
    for (let i = 0, n = p.length; i < n; i++) {
      if (!p[i].active) continue;
      this.bucket[p[i].indexCell(this)].push(p[i]);
    }
  }
}

class Rectangle {
  constructor(x, y, width, height) {
    this.width = width;
    this.height = height;
    this.left = x;
    this.right = x + width;
    this.bottom = y;
    this.top = y + height;
  }
}

// functions ************************************************************
function setup() {
  setParameter();
  createCanvas(canvasWidth, canvasHeight);
  resetBoid();

  const buttonRun = createButton("再生 / 停止");
  buttonRun.position(10, canvasHeight + 20);
  buttonRun.mousePressed(runBoid);

  const buttonReset = createButton("リセット");
  buttonReset.position(100, canvasHeight + 20);
  buttonReset.mousePressed(resetBoid);
}

function draw() {
  if (isRun) {
    time += timeDelta;
    motionUpdate();
    drawParticle()
  }
}

function runBoid() {
  isRun = !isRun;
}

function resetBoid() {
  isRun = false;
  time = 0;
  initialParticle();
  drawParticle();
}

function setParameter() {
  // number of boids
  numBoid = 100;

  // flock radius
  radiusSeparation = 0.2;
  radiusAlignment = 0.5;
  radiusCohesion = 0.5;

  // weight parameter
  wSeparation = 1.0;
  wAlignment = 1.0;
  wCohesion = 0.5;

  // velocity
  maxVelocity = 0.4;

  // region
  region = new Rectangle(0.0, 0.0, 10.0, 10.0);
  const h = Math.max(radiusSeparation, radiusAlignment, radiusCohesion);
  cell = new Cell(region, h);

  // time
  timeDelta = 0.1;

  // canvas
  canvasWidth = 600;
  canvasHeight = canvasWidth * region.height / region.width;
}

function initialParticle() {
  const create = function(p, region) {
    for (let i = 0; i < numBoid; i++) {
      const x = region.left + Math.random() * region.width;
      const y = region.bottom + Math.random() * region.height;
      const vx = maxVelocity * (2 * Math.random() - 1);
      const vy = maxVelocity * (2 * Math.random() - 1);
      p.push(new Particle(x, y, vx, vy));
    }
  };

  p = [];
  create(p, region);
}

function setParticleToCell() {
  cell.clear();
  cell.add(p);
}

function particleForce() {
  for (let i = 0, n = p.length; i < n; i++) {
    if (!p[i].active) continue;

    let forceSeparation = new Vector();
    let forceAlignment = new Vector();
    let forceCohesion = new Vector();
    let velAlignment = new Vector();
    let center = new Vector();
    let numAlignment = 0, numCohesion = 0;

    p[i].forNeighbor(cell, function(pNeighbor, rv) {
      if (p[i] !== pNeighbor) {
        const r = rv.magnitude();

        // separation force
        if (r > 0 && r <= radiusSeparation) {
          forceSeparation.x += rv.x / (r * r);
          forceSeparation.y += rv.y / (r * r);
        }

        // alignment force
        if (r <= radiusAlignment) {
          velAlignment.x += pNeighbor.velocity.x;
          velAlignment.y += pNeighbor.velocity.y;
          numAlignment++
        }

        // cohesion force
        if (r <= radiusCohesion) {
          center.x += pNeighbor.position.x;
          center.y += pNeighbor.position.y;
          numCohesion++;
        }
      }
    });

    if (numAlignment > 0) {
      velAlignment.x /= numAlignment;
      velAlignment.y /= numAlignment;
      forceAlignment = velAlignment.sub(p[i].velocity);
    }

    if (numCohesion > 0) {
      center.x /= numCohesion;
      center.y /= numCohesion;
      forceCohesion = center.sub(p[i].position);
    }

    // update
    forceSeparation.unit();
    forceAlignment.unit();
    forceCohesion.unit();
    p[i].force.x = wSeparation * forceSeparation.x + wAlignment * forceAlignment.x + wCohesion * forceCohesion.x;
    p[i].force.y = wSeparation * forceSeparation.y + wAlignment * forceAlignment.y + wCohesion * forceCohesion.y;
  }
}

function motionUpdate() {
  setParticleToCell();
  particleForce();

  for (let i = 0, n = p.length; i < n; i++) {
    if (!p[i].active) continue;
    p[i].velocity.x += p[i].force.x * timeDelta;
    p[i].velocity.y += p[i].force.y * timeDelta;
    p[i].velocity.limitMax(maxVelocity);

    p[i].position.x += p[i].velocity.x * timeDelta;
    p[i].position.y += p[i].velocity.y * timeDelta;

    if (p[i].position.x < region.left) {
      p[i].position.x = region.right - (region.left - p[i].position.x);
    } else if (p[i].position.x > region.right) {
      p[i].position.x = region.left + (p[i].position.x - region.right);
    }
    if (p[i].position.y < region.bottom) {
      p[i].position.y = region.top - (region.bottom - p[i].position.y);
    } else if (p[i].position.y > region.top) {
      p[i].position.y = region.bottom + (p[i].position.y - region.top);
    }
  }
}

function drawParticle() {
  background(220);

  // time 
  fill("black");
  textSize(32);
  text('time = ' + time.toFixed(2), 10, 50);

  // fluid particle
  const drawEllipse = function(p, scale, d) {
    for (let i = 0, n = p.length; i < n; i++) {
      if (!p[i].active) continue;
      const x = (p[i].position.x - region.left) * scale;
      const y = canvasHeight - (p[i].position.y - region.bottom) * scale;
      ellipse(x, y, d);
    }
  };

  const scale = canvasWidth / region.width;
  const d = 5;
  noStroke();
  fill("blue");
  drawEllipse(p, scale, d);
}
