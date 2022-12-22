/*!
 * array-gpio/gpio-input.js
 *
 * Copyright(c) 2017 Ed Alegrid
 * Copyright(c) 2022 Wilfried Sugniaux
 * MIT Licensed
 */
import rpi, { inputPin, pinStateMap } from "./rpi.js";
import {
  Edges,
  GpioMode,
  GpioPin,
  GpioState,
  IntR,
  StateCallback,
  WatchCallback,
} from "./types.js";

/*
 * Gpio input class module
 */
class GpioInput {
  pin: GpioPin;
  defaultIntR: IntR;
  defaultEdge: Edges;

  constructor(
    pin: GpioPin,
    options: { intR: IntR; edge: Edges } = { intR: IntR.OFF, edge: Edges.BOTH }
  ) {
    this.pin = pin;
    this.defaultIntR = options.intR;
    this.defaultEdge = options.edge;

    return inputPin.get(pin) ?? this;
  }

  isAvailable() {
    return pinStateMap.get(this.pin) === GpioMode.INPUT;
  }

  ensureAvailable() {
    if (!this.isAvailable())
      throw new Error("This pin is not configured as input");
  }

  open() {
    if (this.isAvailable()) throw new Error("This pin is already an input");
    rpi.gpio_mk_input(this.pin, {
      intR: this.defaultIntR,
      edge: this.defaultEdge,
    });
  }

  close() {
    this.ensureAvailable();
    this.unwatch();
    rpi.gpio_close(this.pin);
  }

  get state() {
    this.ensureAvailable();
    return Boolean(rpi.gpio_read(this.pin));
  }

  get isOn() {
    this.ensureAvailable();
    return this.state;
  }

  get isOff() {
    this.ensureAvailable();
    return !this.state;
  }

  intR(intRes: IntR) {
    this.ensureAvailable();
    rpi.gpio_enable_pud(this.pin, intRes);
  }

  read(): GpioState;
  read(cb: StateCallback): NodeJS.Immediate;
  read(cb?: StateCallback) {
    this.ensureAvailable();

    if (!["undefined", "function"].includes(typeof cb))
      throw new Error("invalid callback argument");

    const s = rpi.gpio_read(this.pin);
    return cb ? setImmediate(cb, s) : s;
  }

  watch(
    cb: WatchCallback,
    { edge, pollRate }: { edge?: Edges; pollRate?: number } = {
      edge: Edges.BOTH,
      pollRate: 100,
    }
  ) {
    this.ensureAvailable();
    return rpi.gpio_watchPin(this.pin, cb, edge, pollRate);
  }

  unwatch() {
    this.ensureAvailable();
    rpi.gpio_unwatchPin(this.pin);
  }
}

export default GpioInput;
