/*!
 * array-gpio/spi.js
 *
 * Copyright(c) 2017 Ed Alegrid
 * MIT Licensed
 */

"use strict";

import { SpiDataMode } from "./rpi";

const rpi = require("./rpi.ts");

/*
 * spi class
 */

let test = false;

class SPI {
  isTest: boolean;
  constructor() {
    this.begin();
    this.isTest = false;
  }

  /* returns 1 if successful, otherwise returns 0*/
  begin() {
    return rpi.spiBegin();
  }

  test() {
    this.isTest = true;
  }

  setDataMode(mode: SpiDataMode) {
    rpi.spiSetDataMode(mode);
  }

  /* 250MHz on RPi1 and RPi2, and 400MHz on RPi3 */
  setClockFreq(div: number) {
    const clock1 = 250000000;
    const clock3 = 400000000;

    const boardRev = rpi.spiGetBoardRev();
    const freq =
      boardRev === 8322 ? Math.round(clock3 / div) : Math.round(clock1 / div);
    const Freq = freq / 1000;

    console.log("SPI clock freq: " + Freq + " kHz (div " + div + ")");

    rpi.spiSetClockDivider(div);
  }

  /* 250MHz on RPi1 and RPi2, and 400MHz on RPi3 */
  setClock(div: number) {
    const clock1 = 250000000;
    const clock3 = 400000000;

    const boardRev = rpi.spiGetBoardRev();
    const freq =
      boardRev === 8322 ? Math.round(clock3 / div) : Math.round(clock1 / div);
    const Freq = freq / 1000;

    console.log("SPI clock freq: " + Freq + " kHz (div " + div + ")");
    rpi.spiSetClockDivider(div);
  }

  setCSPolarity(cs: 0 | 1 | 2, active: 0 | 1) {
    rpi.spiSetCSPolarity(cs, active);
  }

  chipSelect(cs: 0 | 1 | 2 | 3) {
    rpi.spiChipSelect(cs);
  }

  /* transfer data bytes to/from periphetal registers using node buffer objects */
  transfer(wbuf: Buffer, rbuf: Buffer, len: number) {
    if (test) {
      return;
    }
    rpi.spiTransfer(wbuf, rbuf, len);
  }

  /* transfer data bytes to periphetal registers using node buffer objects */
  write(wbuf: Buffer, len: number) {
    if (test) {
      return;
    }
    rpi.spiWrite(wbuf, len);
  }

  /* transfer data bytes from periphetal registers using node buffer objects */
  read(rbuf: Buffer, len: number) {
    if (test) {
      return;
    }
    rpi.spiRead(rbuf, len);
  }

  end() {
    rpi.spiEnd();
  }
} // end of SPI class

module.exports = SPI;
