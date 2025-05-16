/**
 * @format
 */
export function patchMatrix(matrix) {
  matrix.fillSafe = function (x0, y0, x1, y1) {
    if (y1 >= 0) {
      this.fill(x0, Math.max(0, y0), x1, y1);
    }
    return this;
  };
  return matrix;
}

export function lerp(v0, v1, t) {
  if (typeof v0 === "number") {
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
  if (typeof v0 === "number") {
    return v0 * f;
  } else {
    const result = {};
    for (let key in v0) {
      result[key] = Math.min(v0[key] * f, max);
    }
    return result;
  }
}

export function colorEquals(c0, c1) {
  return c0.r === c1.r && c0.g === c1.g && c0.b === c1.b;
}

export function lerpColor(c0, c1, t) {
  return {
    r: c0.r * (1 - t) + c1.r * t,
    g: c0.g * (1 - t) + c1.g * t,
    b: c0.b * (1 - t) + c1.b * t,
  };
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

export function drawAsset(matrix, x, y, asset) {
  const { width, height, data } = asset;

  const FUCHSIA = [255, 0, 255];

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Calculate index in the data array (3 values per pixel - r,g,b)
      const idx = (py * width + px) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skip fuchsia (transparent) pixels
      if (r === FUCHSIA[0] && g === FUCHSIA[1] && b === FUCHSIA[2]) {
        continue;
      }

      const targetX = x + px;
      const targetY = y + py;
      if (targetX >= 0 && targetY >= 0) {
        matrix.fgColor({ r, g, b }).setPixel(targetX, targetY);
      }
    }
  }

  return matrix;
}

export function drawAssetsLerp(matrix, x, y, asset1, asset2, lerp) {
  const { width, height, data } = asset1;

  const FUCHSIA = [255, 0, 255];

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Calculate index in the data array (3 values per pixel - r,g,b)
      const idx = (py * width + px) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skip fuchsia (transparent) pixels
      if (r === FUCHSIA[0] && g === FUCHSIA[1] && b === FUCHSIA[2]) {
        continue;
      }

      const targetX = x + px;
      const targetY = y + py;
      if (targetX >= 0 && targetY >= 0) {
        const c = {
          r: asset2.data[idx],
          g: asset2.data[idx + 1],
          b: asset2.data[idx + 2],
        };
        matrix
          .fgColor(lerpColor({ r, g, b }, c, lerp))
          .setPixel(targetX, targetY);
      }
    }
  }

  return matrix;
}
