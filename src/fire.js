/**
 * @format
 */
const M = require('rpi-led-matrix');

const matrix = new M.LedMatrix(
{
  ...M.LedMatrix.defaultMatrixOptions(),
  rows: 32,
  cols: 64,
  hardwareMapping: M.GpioMapping.AdafruitHatPwm
},
{
  ...M.LedMatrix.defaultRuntimeOptions(),
  gpioSlowdown: 3
}
);

const MAX_PARTICLES = 64;
const MAX_SIZE = 10;
const MIN_SIZE = 1;
const FLOW_GRID_RESOLUTION = 8;
const MAX_ATTRACTOR_DISTANCE = 2;

function genFlowGrid(matrix) {
  const grid = {
    lookups: [], 
    vectors: [], 
    matrix,
    gridX:  FLOW_GRID_RESOLUTION,
    gridY: FLOW_GRID_RESOLUTION
  };

  for (let y = 0; y < grid.gridY;++y) {
    for (let x = 0; x < grid.gridX;++x) {
      grid.vectors.push({x: 0.0, y: -1.0});
    }
  }
  for (let y = 0; y < matrix.height();++y) {
    const ry = Math.floor((y/matrix.height()) * FLOW_GRID_RESOLUTION);
    for (let x = 0; x < matrix.width();++x) {
      const rx = Math.floor((x/matrix.width()) * FLOW_GRID_RESOLUTION);
      grid.lookups.push(ry * grid.gridY + rx);
    }
  }
  return grid;
}

function adjustFlowGrid(attractors, grid) {
  for (let y = 0; y < grid.gridY;++y) {
    for (let x = 0; x < grid.gridX;++x) {
      const v = grid.vectors[y * grid.gridY + x];
      for (let a of attractors) {
        const attractorDirection = { x: a.x-x, y: a.y-y};
        const distance = vecLength(attractorDirection);
        attractorDirection.x /= distance;
        attractorDirection.y /= distance;
        const scaledDistance = 
          Math.max(distance, MAX_ATTRACTOR_DISTANCE) / MAX_ATTRACTOR_DISTANCE; 
        v.x += (attractorDirection.x * scaledDistance); 
        v.y += (attractorDirection.y * scaledDistance); 
      }
      vecNormalize(v);
    }
  }
}

function getFlowGridVector(x,y, grid) {
  const lookup = Math.floor(y) * grid.matrix.width() + Math.floor(x);
  return grid.vectors[grid.lookups[lookup]];
}


function initParticles() {
  const particles = [];
  while (particles.length < MAX_PARTICLES) {
    particles.push(genParticle({bright:{},dim:{}}));
  }
  return particles;
}

function genParticle(p) {
  p.x = Math.random() * 63;
  p.y = 31;
  p.ttl = (Math.random() * 24);
  p.bright.r = 0.75 + Math.random() * 0.25;
  p.bright.g = 0.25 + Math.random() * 0.25;
  p.bright.b = 0.125 + Math.random() * 0.125;
  p.dim.r = p.dim.g = p.dim.b = 0.0;
  p.size= MIN_SIZE + Math.random() * (MAX_SIZE-MIN_SIZE);
  p.age= 0;
  return p;
}

function rgb(r,g,b) {
    return ((255 * r) << 16) + ((255 * g) << 8) + (255 * b);
}

function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t;
}

function vecNormalize(v) {
  const l = vecLength(v);
  v.x /= l;
  v.y /= l;
  return v;
}

function vecLength(v) {
  return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
}

const particles = initParticles();
const grid = genFlowGrid(matrix);
const attractors = [
  {x: Math.random() * FLOW_GRID_RESOLUTION, y: -1, dx: Math.random()*0.02 -0.01 },
  {x: Math.random() * FLOW_GRID_RESOLUTION, y: -1, dx: Math.random()*0.02 - 0.01 },
]; 

matrix.afterSync((mat, dt, t) => {
  matrix
    .brightness(255)
    .clear();

  // cycle the attractor back and forth
  for (let a of attractors) {
    a.x += a.dx;
    if (Math.random() < 0.1) {
      //a.dx *= -1;
    }
    if (a.x > FLOW_GRID_RESOLUTION - 1) {
      a.dx = Math.abs(a.dx) * -1;
    }
    if (a.x < 0) {
      a.dx = Math.abs(a.dx);
    }
  }
  adjustFlowGrid(attractors, grid);

  // draw background gradient
  for (let i = matrix.height() - 1; i >=0; --i) {
    const c = rgb(
      Math.pow(i/(matrix.height()-1),4),
      Math.pow(i/(matrix.height()-1)*0.25,4),
      0
    );
    matrix
      .fgColor(c)
      .drawLine(0,i, matrix.width() - 1,i); 
  }

  // render particles
  for (let i = 0; i < particles.length;++i) {
    let p = particles[i];
    if (++p.age >= p.ttl) {
      genParticle(p);
    }
    const vec = getFlowGridVector(p.x, p.y, grid);
    p.y += vec.y;
    p.x += vec.x;

    const l = 1.0 - (p.age / p.ttl);
    const size = p.size * l * 0.5;
    const color = rgb(
      lerp(p.dim.r, p.bright.r, l),
      lerp(p.dim.g, p.bright.g, l),
      lerp(p.dim.b, p.bright.b, l)
    );

    matrix
      .fgColor(color)
      .fill(p.x-size,p.y-size, p.x+size, p.y+ size);

  }
  setTimeout(() => matrix.sync(), 4);
});

// Get it started
matrix.sync();
