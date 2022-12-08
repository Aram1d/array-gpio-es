/*!
 * array-gpio/gpio-input.js
 *
 * Copyright(c) 2017 Ed Alegrid
 * MIT Licensed
 */
import rpi, { InputEdge, WatchCallback } from "./rpi.js";
import { StateCallback } from "./gpio-output.js";

export type InResState = "pu" | "pd" | "none";

/*
 * Gpio input class module
 */
class GpioInput {
  _index: number;
  pin: number;
  setR: (x: InResState) => void;
  defaultEdge: InputEdge;

  constructor(
    i: number,
    pin: number,
    options: { intR: InResState; edge: InputEdge }
  ) {
    this._index = i;
    this.pin = pin;
    this.defaultEdge = options.edge;

    const { intR } = options;
    this.intR(intR);

    this.setR = this.intR;
  }

  open() {
    rpi.gpio_open(this.pin, 0);
  }

  close() {
    rpi.gpio_close(this.pin);
  }

  get state() {
    return Boolean(rpi.gpio_read(this.pin));
  }

  get isOn() {
    return this.state;
  }

  get isOff() {
    return !this.state;
  }

  intR(x: InResState) {
    if (x === "none") {
      return rpi.gpio_enable_pud(this.pin, 0);
    } else if (x === "pu") {
      return rpi.gpio_enable_pud(this.pin, 2);
    } else if (x === "pd") {
      return rpi.gpio_enable_pud(this.pin, 1);
    }
  }

  read(): 0 | 1;
  read(cb: StateCallback): NodeJS.Immediate;
  read(cb?: StateCallback) {
    if (![undefined, "function"].includes(typeof cb))
      throw new Error("invalid callback argument");

    const s = rpi.gpio_read(this.pin);
    return cb ? setImmediate(cb, s) : s;
  }

  watch(
    cb: WatchCallback,
    { edge, pollRate }: { edge?: InputEdge; pollRate?: number }
  ) {
    rpi.gpio_watchPin(this.pin, cb, edge, pollRate);
  }

  unwatch() {
    rpi.gpio_unwatchPin(this.pin);
  }
}

export default GpioInput;
