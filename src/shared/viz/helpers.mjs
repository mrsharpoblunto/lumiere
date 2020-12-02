/**
 * @format
 */
export function lerp(v0, v1, t) {
  if (typeof v0 === 'number') {
    return v0 * (1 - t) + v1 * t;
  } else {
    const result = {};
    for (let key in v0) {
      result[key] = lerp(v0[key], v1[key], t);
    }
    return result;
  }
}

export function mul(v0, f, max) {
  if (typeof v0 === 'number') {
    return v0 * f;
  } else {
    const result = {};
    for (let key in v0) {
      result[key] = Math.min(v0[key] * f, max);
    }
    return result;
  }
}

export function lerpColor(c0, c1, t) {
  return v0 * (1 - t) + v1 * t;
}

export function vecNormalize(v) {
  const l = vecLength(v);
  v.x /= l;
  v.y /= l;
  return v;
}

export function vecLength(v) {
  return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
}
