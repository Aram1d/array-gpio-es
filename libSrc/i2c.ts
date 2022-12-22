/*!
 * array-gpio/i2c.js
 *
 * Copyright(c) 2017 Ed Alegrid
 * Copyright(c) 2022 Wilfried Sugniaux
 * MIT Licensed
 */

import rpi from "./rpi.js";
import { i2cPinSet } from "./types.js";

/*
 * i2c class
 * has to be instantiated with on of the pinSet:
 * value 1 (GPIO 02/pin 03 SDA1, GPIO 03/pin 05 SCL1)
 * value 0 (GPIO 00/pin 27 SDA0, GPIO 01/pin 28 SCL0)
 */
class I2C {
  constructor(pinSet?: i2cPinSet) {
    if (!pinSet) {
      this.startI2C(1);
    } else {
      this.startI2C(pinSet);
    }
  }

  begin() {
    return rpi.i2cBegin();
  }

  startI2C(pinSet: i2cPinSet) {
    return rpi.i2cInit(pinSet);
  }

  setBaudRate(baud: number) {
    rpi.i2cSetBaudRate(baud);
    console.log(`I2C data rate: ${baud / 1000} kHz`);
  }

  setTransferSpeed(baud: number) {
    rpi.i2cSetBaudRate(baud);
    console.log(`I2C data rate: ${baud / 1000} kHz`);
  }

  setClockFreq(div: number) {
    const freq = Math.round(250000000 / div);
    const Freq = Math.round(freq / 1000);

    console.log(`I2C data rate: ${Freq} kHz (div ${div})`);
    rpi.i2cSetClockDivider(div);
  }

  /* returns 1 if successful, otherwise returns 0*/
  selectSlave(value: number) {
    return rpi.i2cSetSlaveAddress(value);
  }

  /* read data bytes from periphetal registers using node buffer objects */
  read(buf: Buffer, len: number) {
    return rpi.i2cRead(buf, len) as number;
  }

  /* write data bytes to periphetal registers using node buffer objects */
  write(buf: Buffer, len: number) {
    rpi.i2cWrite(buf, len);
  }

  end() {
    rpi.i2cEnd();
  }
}

export default I2C;
