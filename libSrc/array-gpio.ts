/*!
 * array-gpio
 *
 * Copyright(c) 2017 Ed Alegrid
 * MIT Licensed
 */
import { i2cPinSet, InputEdge, WatchCallback } from "./rpi";

import EventEmitter from "events";
class StateEmitter extends EventEmitter {}
const emitter = (exports.emitter = new StateEmitter());
emitter.setMaxListeners(2);

const rpi = require("./rpi.js");
const I2C = require("./i2c.js");
const SPI = require("./spi.js");
const PWM = require("./pwm.js");
import GpioInput, { InResState } from "./gpio-input.js";
import GpioOutput from "./gpio-output.js";

const pwr3 = [1, 17] as const;
const pwr5 = [2, 4];
const uart = { txd: 8, rxd: 10 };
const i2c = { sda: 3, scl: 5 };
const pwm = { pwm0: [12, 32] as const, pwm1: [33, 35] as const };
const spi = { mosi: 19, miso: 21, sclk: 23, cs0: 24, cs1: 26 };
const eprom = { sda: 27, scl: 28 };
const ground = [6, 9, 14, 20, 25, 30, 34, 39];
const gpio = [
  3, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29,
  31, 32, 33, 35, 36, 37, 38, 40,
] as const;

export type PwmPins = typeof pwm.pwm0[number] | typeof pwm.pwm1[number];
export type GpioPins = typeof gpio[number];
export type AllowedFreq = 1 | 10 | 100 | 1000;

type InputOptions = {
  index: "pin" | "inc";
  event: boolean;
};
type InputPinWithOption = {
  pin: GpioPins;
  edge: InputEdge;
  intR: InResState;
};

type OutputObjArg = { pins: GpioPins[]; index?: "pin" | "inc" };

/* debug mode variables */
let debugState = false,
  debugStateAdvanced = false;

/* PWM variables */
let pwmObjectTotal = 0,
  pwmObject = 0;

const pwmPin = { c1: new Set<number>(), c2: new Set<number>() };

/* invalid pin error handler */
function invalidPinError(pin?: number) {
  console.log("invalid pin", pin);
  throw new Error("invalid pin");
}

function startTime() {
  return new Date();
}

function endTime(start: Date, m: 0 | 1) {
  const d2 = new Date();
  const eT = Math.abs((d2 as any) - (start as any));
  if (m === undefined) {
    console.log(eT + " ms");
  } else if (m === 1) {
    return eT + " ms";
  }
}

class GpioGroup extends Array<GpioInput> {
  watchInputs(cb: WatchCallback, edge?: InputEdge, td?: number) {
    this.forEach(({ pin }) => rpi.gpio_watchPin(pin, cb, edge, td));
  }
  unwatchInputs() {
    this.forEach(({ pin }) => rpi.gpio_unwatchPin(pin));
  }
  closeAll() {
    this.forEach(({ pin }) => rpi.gpio_close(pin));
  }
}

/****************************************
 *					*										*
 *	array-gpio class module		*
 *					*										*
 ****************************************/
class ArrayGpio {
  in: typeof this.setInput;
  out: typeof this.setOutput;
  constructor() {
    this.in = this.setInput;
    this.out = this.setOutput;
  }

  close() {
    rpi.lib_close();
  }

  /********************************************

		GPIO Methods

 ********************************************/
  /*
   * GPIO setInput method
   */

  setInput(
    pins: GpioPins | (GpioPins | InputPinWithOption)[],
    inputOptions: InputOptions
  ) {
    const begin = startTime();
    const pinsArray = Array.isArray(pins) ? pins : [pins];

    const pinMap = new Map<GpioPins, Omit<InputPinWithOption, "pin">>(
      pinsArray.map((pin) =>
        typeof pin === "number"
          ? [pin, { edge: "both", intR: "none" }]
          : [pin.pin, { edge: pin.edge, intR: pin.intR }]
      )
    );

    pinMap.forEach((pinOptions, pin) => {
      if (!gpio.includes(pin)) {
        throw new Error(`Gpio pin must be one of ${gpio.join(", ")}`);
      }
      try {
        rpi.gpio_open(pin, 0);
      } catch (e) {
        invalidPinError(pin);
      }
    });

    const inputPins = new GpioGroup();

    pinMap.forEach((pinOptions, pin) => {
      const index = inputOptions.index === "pin" ? pin : inputPins.length;
      inputPins[index] = new GpioInput(index, pin, pinOptions);
    });

    if (inputPins.length < 2)
      console.log(`GPIO input pin: ${inputPins[0]} ${endTime(begin, 1)}`);
    else if (inputOptions.index === "pin")
      console.log(
        `GPIO input pin: ${inputPins} indexedBy: pin ${endTime(begin, 1)}`
      );
    else
      console.log(
        `GPIO output pin: ${inputPins} indexedBy: 0~n ${endTime(begin, 1)}`
      );

    return inputPins.length > 1 ? inputPins : inputPins[0];
  }

  /*
   * GPIO setOutput method property
   */
  setOutput(first: OutputObjArg): void;
  setOutput(first: GpioPins, ...rest: GpioPins[]): void;
  setOutput(first: GpioPins | OutputObjArg, ...rest: GpioPins[]) {
    const begin = startTime();

    const pinSet = new Set<number>();
    const options: { pinCheck: boolean; pinIndex: boolean } = {
      pinCheck: false,
      pinIndex: false,
    };

    if (!first) {
      console.log("\nsetOutput() - empty argument!");
      invalidPinError(first);
    }

    if (typeof first !== "number" && !Array.isArray(first?.pins)) {
      console.log("\nsetOutput() - invalid argument!");
      invalidPinError(first?.pins ?? first);
    }

    if (typeof first === "object") {
      options.pinIndex = first.index === "pin";
      if (typeof first.pins[0] !== "number") {
        console.log("\nsetOutput({pins:[]}) - pins array is empty!");
        invalidPinError();
      }
    }

    const argPinArray =
      typeof first === "number" ? [first, ...rest] : first.pins;
    argPinArray.forEach((pin) => {
      if (!Number.isInteger(pin))
        throw new Error("pin number must be an integer");
      if (!gpio.includes(pin))
        throw new Error(`Gpio pin must be one of ${gpio.join(", ")}`);
    });

    argPinArray.forEach((pin) => {
      try {
        rpi.gpio_open(pin, 1);
        pinSet.add(pin);
      } catch (e) {
        console.log(`output pins [ ${Array.from(pinSet).join(" ")} ]`);
        invalidPinError(pin);
      }
    });

    const outputPins: GpioOutput[] = [];
    Array.from(pinSet).forEach((pin, incIndex) => {
      const index = options.pinIndex ? pin : incIndex;
      outputPins[index] = new GpioOutput(index, pin);
    });

    if (outputPins.length < 2)
      console.log(`GPIO output pin: ${outputPins[0]} ${endTime(begin, 1)}`);
    else if (options.pinIndex)
      console.log(
        `GPIO output pin: ${outputPins} indexedBy: pin ${endTime(begin, 1)}`
      );
    else
      console.log(
        `GPIO output pin: ${outputPins} indexedBy: 0~n ${endTime(begin, 1)}`
      );

    Object.preventExtensions(outputPins);
    return outputPins.length > 1 ? outputPins : outputPins[0];
  } // end of setOutput

  /* validPin helper method */
  validPin() {
    const validPin = [],
      invalidPin = [];
    for (const x of gpio) {
      try {
        rpi.gpio_open(x, 0);
        validPin.push(x);
      } catch (e) {
        invalidPin.push(x);
      }
    }
    console.log("GPIO valid pins", validPin);
    console.log("GPIO invalid pins", invalidPin);
  }

  /* debug mode setup method for test */
  debug(x: 0 | 1 | 2) {
    if ([0, 1, 2].includes(x)) {
      debugState = x > 0;
      debugStateAdvanced = x > 1;
    }
  }

  /********************************************

		PWM Methods

 ********************************************/
  setPWM(pin: PwmPins, freq: AllowedFreq = 1, t: number = 0, pw: number) {
    /* arguments validation */
    if (arguments.length > 4 || arguments.length < 1) {
      throw new Error("invalid PWM(pin, freq, T, pw) arguments");
    }
    if ([12, 32, 33, 35].includes(pin)) {
      /* store validated pin in array */
      if ([12, 32].includes(pin)) {
        if (pwmPin.c1.has(pin))
          throw new Error(
            "\nsetPWM() error: pin " + pin + " is already in use.\n"
          );
        pwmPin.c1.add(pin);
      } else {
        if (pwmPin.c2.has(pin))
          throw new Error(
            "\nsetPWM() error: pin " + pin + " is already in use.\n"
          );
        pwmPin.c2.add(pin);
      }
    } else {
      throw new Error("invalid setPulse() pin argument");
    }

    if (![1, 10, 100, 1000].includes(freq))
      throw new Error("invalid setPulse() freq argument");

    /* T or range */
    if (!(t >= 0 || t < 1000000))
      throw new Error("invalid setPulse() period T argument");

    /* pw or data */
    if (!(pw >= 0 || pw < 1000000))
      throw new Error("invalid setPulse() pw argument");

    /* create pwm object using validated arguments */
    const pwm = new PWM(pin, freq, t, pw);

    /* track Freq from pwm.ts */
    const Freq = require("./pwm.js").Freq;

    let res: string = "";
    /* PWM setup reference console output */
    if (Freq === 10) {
      res = "0.1 ms";
    } else if (Freq === 100) {
      res = "0.01 ms";
    } else if (Freq === 1000) {
      res = "0.001 ms";
    }

    if (freq === 1) {
      console.log(`PWM setup: (pin ${pin})`);
    } else {
      /* Freq is global, not validFreq - one freq only for all */
      console.log(
        `PWM setup: pin ${pin}, Freq ${Freq}KHz (${res}), T ${t}, pw ${pw}`
      );
    }

    /* get the pwmObject from pwm.ts */
    pwmObject = require("./pwm.js").pwmObject;
    /* check for more than 1 peripheral and channel pairs */
    setImmediate(function () {
      pwmObjectTotal += 1;
      if (pwmObject === pwmObjectTotal && pwmObject > 1) {
        console.log(
          "\nArray-gpio has detected you are using more than 1 PWM peripheral." +
            "\nAll PWM peripherals are using 1 clock oscillator.\nClock frequency is set to " +
            Freq +
            " KHz for all.\n"
        );
      }
      /* pwm pin channel check */
      setImmediate(() => {
        [[...pwmPin.c1], [...pwmPin.c2]].forEach((pins) => {
          if (pins.length > 1 && pwmObject > 1 && pins[1] === pin) {
            console.log(`Paired PWM peripherals (pin ${pins}) detected.`);
            console.log("Range and data will be same for both peripherals.\n");
          }
        });
      });
    });

    return pwm;
  }

  /********************************************

		I2C Methods

 ********************************************/

  setI2C(pin: i2cPinSet) {
    return new I2C(pin);
  }

  /********************************************

		SPI Methods

 ********************************************/

  setSPI() {
    return new SPI();
  }

  /********************************************

		Other Helper Methods

 ********************************************/

  /* mswait (millisecond) method */
  mswait(ms: number) {
    rpi.mswait(ms);
  }

  /* uswait (microsecond) method */
  uswait(us: number) {
    rpi.uswait(us);
  }

  pinout() {
    console.log("** common pins for rpi zero, rpi3 and rpi4 **");
    console.log(
      "(based on the physical pinout numbering from the board header)\n"
    );
    console.log("5v", pwr5);
    console.log("3.3v", pwr3);
    console.log("ground", ground);
    console.log("eeprom id", eprom);
    console.log("uart", uart);
    console.log("i2c", i2c);
    console.log("spi", spi);
    console.log("pwm", pwm);
    console.log("gpio (ALT0)", gpio, "\n");
  }
}

export default new ArrayGpio();
