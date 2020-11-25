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

let x = 64;
setInterval(() => {
  x--;
  if (x<-17) {
    x = 64;
  }
}, 100);

matrix.afterSync((mat, dt, t) => {
  matrix
    .clear()
    .brightness(64)
    .fgColor(0x222277)
    .fill();

  for (let i = 0;i < 16; ++i) {
    const offset = Math.sin(((i/16.0)+((x+17)/81.0))*2.0 * (Math.PI* 2)) * 8;
    matrix
      .fgColor(i % 2 == 0 ? 0x006600 : 0x449944)
      .fill((i*4),2 + offset,(i*4),matrix.height() - 1);
  }

  matrix
    .fgColor(0xFFFF00)
    .drawLine(x,14,x,16)
    .drawLine(x,16,x+2,16)
    .drawLine(x+2,16,x+2,20)
    .drawLine(x+2,20,x+15,20)
    .drawLine(x+15,20,x+15,22)
    .drawLine(x+15,22,x+17,22)
    .drawLine(x+17,22,x+17,8)
    .drawLine(x+17,8,x+15,8)
    .drawLine(x+15,8,x+15,10)
    .drawLine(x+15,10,x+2,10)
    .drawLine(x+2,10,x+2,14)
    .drawLine(x+2,14,x,14)
    .fill(x+2,10,x+15,20)
    //fin 1
    .drawLine(x+10,20, x+10, 23)
    .drawLine(x+10,23, x+8, 23)
    .drawLine(x+8,23, x+8, 20)
    // fin 2
    .drawLine(x+10,10, x+10, 7)
    .drawLine(x+10,7, x+8, 7)
    .drawLine(x+8,7, x+8, 10)
    // eye
    .fgColor(0x0000FF)
    .setPixel(x + 4, 12)
    // fin 2 fill
    .fill(x+9,21,x+9,22)
    // fin 2 fill
    .fill(x+9,8,x+9,9)
    // tail fill
    .fill(x+16,9,x+16,21)
    //mouth
    .fgColor(0xFF0000)
    .setPixel(x+1,15)
  ;


  setTimeout(() => matrix.sync(), 0);
});

// Get it started
matrix.sync();
