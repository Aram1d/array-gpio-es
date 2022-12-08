/*!
 * array-gpio/gpio-output.js
 *
 * Copyright(c) 2017 Ed Alegrid
 * MIT Licensed
 */
import { rpi } from "./rpi";

export type GpioBit = 0 | 1 | boolean;
export type StateCallback = (state: GpioBit) => void;

/* OnOff helper function */
function OnOff(pin: number, c: GpioBit, t: "w", cb?: StateCallback) {
  let state: GpioBit;
  if (c === 1 || c === true) {
    rpi.gpio_write(pin, 1); // returns 1
    state = true;
    if (t === "w") {
      state = 1;
    }
  } else {
    // c === 0 || c === false
    rpi.gpio_write(pin, 0); // returns 0
    state = false;
    if (t === "w") {
      state = 0;
    }
  }
  if (cb) {
    setImmediate(cb, state);
  }
  return state;
}

function OnOffDelayWrapper(
  pin: number,
  bit: GpioBit,
  delay?: number,
  cb?: StateCallback
) {
  if (!["number", undefined].includes(typeof delay))
    throw new Error("invalid delay argument");
  if (!["function", undefined].includes(typeof cb))
    throw new Error("invalid callback, is it a function?");

  if (delay) {
    setTimeout(() => OnOff(pin, 1, "w", cb), delay);
  } else OnOff(pin, 1, "w", cb);
}

/* pulse helper function */
function startPulse(pin: number, timeout: number, cb?: StateCallback) {
  rpi.gpio_write(pin, 1);
  setTimeout(function () {
    rpi.gpio_write(pin, 0);
    if (cb) {
      setImmediate(cb, false);
    }
  }, timeout);
}

/* internal gpio control function */
/*function OutputPinControl(
  pin: number,
  c: GpioBit | undefined,
  t: number | null = null,
  cb: () => void
) {
  // pulse
  if (c === null && t) {
    return startPulse(pin, c, t, cb);
  }
  // on/off control
  else if (t) {
    return setTimeout(function () {
      OnOff(pin, c, t, cb);
    }, t);
  } else {
    return OnOff(pin, c, t, cb);
  }
}*/

/*
 * Gpio output class module
 */
export default class GpioOutput {
  _index: number;
  pin: number;

  stop: number;
  start: number;

  pulseRef: null;
  pulseStarted: boolean;

  loopStop: number;
  loopStart: number;
  loopRef: null;
  loopStarted: boolean;

  delayOn: (delay?: number, cb?: StateCallback) => void;
  delayOff: (delay?: number, cb?: StateCallback) => void;

  constructor(i: number, pin: number) {
    this._index = i;
    this.pin = pin;

    this.stop = 0;
    this.start = 0;
    this.pulseRef = null;
    this.pulseStarted = false;

    this.loopStop = 0;
    this.loopStart = 0;
    this.loopRef = null;
    this.loopStarted = false;

    this.delayOn = this.on;
    this.delayOff = this.off;

    //this.pulse = this.startPulse;
    //this.loop = this.processLoop;
  }

  open() {
    rpi.gpio_open(this.pin, 1);
    return this.state;
  }

  close() {
    rpi.gpio_close(this.pin);
    return this.state;
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

  read(cb?: (state: 0 | 1) => void) {
    const s = rpi.gpio_read(this.pin);
    if (!cb) {
      return s;
    } else if (typeof cb === "function") {
      return setImmediate(cb, s);
    } else {
      throw new Error(
        "invalid arguments: provide no args or one function callback arg"
      );
    }
  }

  write(bit: GpioBit, cb?: () => void) {
    if (bit === undefined) throw new Error("missing control bit argument");
    if (![0, 1, true, false].includes(bit))
      throw new Error("invalid control bit argument");
    if (cb && typeof cb !== "function")
      throw new Error("a callback should be a function");

    return OnOff(this.pin, bit, "w", cb);
  }

  on(arg1?: number | StateCallback, arg2?: StateCallback) {
    const delay = typeof arg1 === "number" ? arg1 : undefined;
    const cb = typeof arg1 === "function" ? arg1 : arg2;
    OnOffDelayWrapper(this.pin, true, delay, cb);
  }

  off(arg1?: number | StateCallback, arg2?: StateCallback) {
    const delay = typeof arg1 === "number" ? arg1 : undefined;
    const cb = typeof arg1 === "function" ? arg1 : arg2;
    OnOffDelayWrapper(this.pin, false, delay, cb);
  }

  /* create a pulse with a duration of t, reverse of on() or delayOn() */
  pulse(duration: number, cb?: StateCallback) {
    this.on();

    if ((typeof duration as unknown) !== "number")
      throw new Error("invalid pulse width time duration");
    if (![undefined, "function"].includes(typeof cb))
      throw new Error("A callback must be a function");
    startPulse(this.pin, duration, cb);
  }
}
