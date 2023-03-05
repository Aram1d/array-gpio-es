/*!
 * array-gpio
 *
 * Copyright(c) 2017 Ed Alegrid
 * Copyright(c) 2022 Wilfried Sugniaux
 * MIT Licensed
 */

import rpi, { inputPin, pinStateMap } from "./rpi.js";
import I2C from "./i2c.js";
import SPI from "./spi.js";
import PWM from "./pwm.js";
import pwm, { Freq, pwmObject as PwmObject } from "./pwm.js";
import GpioInput from "./gpio-input.js";
import GpioOutput from "./gpio-output.js";
import {
  Edges,
  gpio,
  GpioMode,
  GpioPin,
  GpioState,
  i2cPinSet,
  IntR,
  PwmPins,
  StateCallback,
  WatchCallback,
} from "./types.js";
import EventEmitter from "events";

export {
  Edges,
  gpio,
  GpioInput,
  GpioOutput,
  StateCallback,
  GpioMode,
  GpioPin,
  GpioState,
  IntR,
  PwmPins,
  I2C,
  SPI,
  PWM,
  WatchCallback,
};

class StateEmitter extends EventEmitter {}
export const emitter = new StateEmitter();
emitter.setMaxListeners(2);

const pwr3 = [1, 17] as const;
const pwr5 = [2, 4] as const;
const uart = { txd: 8, rxd: 10 } as const;
const i2c = { sda: 3, scl: 5 } as const;

const spi = { mosi: 19, miso: 21, sclk: 23, cs0: 24, cs1: 26 } as const;
const eprom = { sda: 27, scl: 28 } as const;
const ground = [6, 9, 14, 20, 25, 30, 34, 39] as const;

export type AllowedFreq = 1 | 10 | 100 | 1000;

type InputOptions = {
  index?: "pin" | "inc";
  edge?: Edges;
  intR?: IntR;
  event?: boolean;
};
type InputPinWithOption = {
  pin: GpioPin;
  edge?: Edges;
  intR?: IntR;
};

type OutputOptions = {
  index: "pin" | "inc";
  defaultInitState: GpioState;
};

type OutputPinWithOption = {
  pin: GpioPin;
  initState?: GpioState;
};

/* debug mode variables */
let debugState = false,
  debugStateAdvanced = false;

/* PWM variables */
let pwmObjectTotal = 0;

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

export class GpioGroup extends Array<GpioInput> {
  watchInputs(cb: WatchCallback, edge?: Edges, td?: number) {
    this.forEach(({ pin }) => rpi.gpio_watchPin(pin, cb, edge, td));
  }
  unwatchInputs() {
    this.forEach(({ pin }) => rpi.gpio_unwatchPin(pin));
  }
  closeAll() {
    this.forEach(({ pin }) => rpi.gpio_close(pin));
  }
}

/*
 *
 *	Array-gpio class
 *
 *
 */
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
  /*
   * GPIO setInput method
   * @param pin | pin[] | InputPinWithOption []
   * @return GpioInput | GpioGroup (extended GpioInput[] )
   */

  setInput(pins: GpioPin, inputOptions?: Partial<InputOptions>): GpioInput;
  setInput(
    pins: InputPinWithOption,
    argsInputOptions?: Partial<InputOptions>
  ): GpioInput;
  setInput(
    pins: (GpioPin | InputPinWithOption)[],
    argsInputOptions?: InputOptions
  ): GpioGroup;
  setInput(
    pins: GpioPin | InputPinWithOption | (GpioPin | InputPinWithOption)[],
    argsInputOptions: InputOptions
  ) {
    const inputOptions: Required<InputOptions> = {
      index: "inc",
      event: false,
      edge: Edges.BOTH,
      intR: IntR.OFF,
      ...argsInputOptions,
    };

    const begin = startTime();
    const pinsArray = Array.isArray(pins) ? pins : [pins];

    const pinMap = new Map<GpioPin, Omit<Required<InputPinWithOption>, "pin">>(
      pinsArray.map((pin) =>
        typeof pin === "number"
          ? [pin, { edge: inputOptions.edge, intR: inputOptions.intR }]
          : [
              pin?.pin,
              {
                edge: pin?.edge ?? inputOptions.edge,
                intR: pin?.intR ?? inputOptions.intR,
              },
            ]
      )
    );

    pinMap.forEach((pinOptions, pin) => {
      if (!gpio.includes(pin)) {
        throw new Error(`Gpio pin must be one of ${gpio.join(", ")}`);
      }
      if (pinStateMap.get(pin) === GpioMode.ALT)
        throw new Error(`Pin ${pin} is actually used in alt mode (I2C, SPI).`);
      try {
        rpi.gpio_mk_input(pin, pinOptions);
      } catch (e) {
        invalidPinError(pin);
      }
    });

    const inputPins = new GpioGroup();

    pinMap.forEach((pinOptions, pin) => {
      const index = inputOptions.index === "pin" ? pin : inputPins.length;
      inputPins[index] = new GpioInput(pin, pinOptions);
    });

    if (inputPins.length < 2)
      console.log(`GPIO input pin: ${inputPins[0].pin} ${endTime(begin, 1)}`);
    else if (inputOptions.index === "pin")
      console.log(
        `GPIO input pin: ${inputPins
          .map((p) => p.pin)
          .join(", ")} indexedBy: pin ${endTime(begin, 1)}`
      );
    else
      console.log(
        `GPIO output pin: ${inputPins
          .map((p) => p.pin)
          .join(", ")} indexedBy: 0~n ${endTime(begin, 1)}`
      );

    return inputPins.length > 1 ? inputPins : inputPins[0];
  }

  /*
   * GPIO setOutput: use a GPIO pin as output
   * @param take a pin, an array of pins or OutputObjectArg
   * @return GpioOutput | GpioOutput[]
   */
  setOutput(pins: GpioPin, outputOptions?: Partial<OutputOptions>): GpioOutput;
  setOutput(
    pins: OutputPinWithOption,
    argsOutputOptions?: Partial<OutputOptions>
  ): GpioOutput;
  setOutput(
    pins: (GpioPin | OutputPinWithOption)[],
    argsOutputOptions?: Partial<OutputOptions>
  ): GpioOutput[];
  setOutput(
    pins: GpioPin | OutputPinWithOption | (GpioPin | OutputPinWithOption)[],
    argsOutputOptions: Partial<OutputOptions> = {
      index: "inc",
      defaultInitState: GpioState.LOW,
    }
  ) {
    const outputOptions: OutputOptions = {
      index: "inc",
      defaultInitState: GpioState.LOW,
      ...argsOutputOptions,
    };
    const begin = startTime();

    const pinsArray = Array.isArray(pins) ? pins : [pins];
    const pinMap = new Map<GpioPin, Omit<Required<OutputPinWithOption>, "pin">>(
      pinsArray.map((pin) =>
        typeof pin === "number"
          ? [pin, { initState: outputOptions.defaultInitState }]
          : [
              pin?.pin,
              { initState: pin?.initState ?? outputOptions.defaultInitState },
            ]
      )
    );

    pinMap.forEach((pinOptions, pin) => {
      if (!gpio.includes(pin))
        throw new Error(`Gpio pin must be one of ${gpio.join(", ")}`);
      if (pinStateMap.get(pin) === GpioMode.ALT)
        throw new Error(`Pin ${pin} is actually used in alt mode (I2C, SPI).`);
      try {
        rpi.gpio_mk_output(pin, pinOptions.initState);
      } catch (e) {
        console.log(`output pins [ ${pinMap.entries()} ]`);
        invalidPinError(pin);
      }
    });

    const outputPins: GpioOutput[] = [];
    pinMap.forEach((pinOption, pin) => {
      const index = outputOptions.index === "pin" ? pin : outputPins.length;
      outputPins[index] = new GpioOutput(pin);
    });

    if (outputPins.length < 2)
      console.log(`GPIO output pin: ${outputPins[0]} ${endTime(begin, 1)}`);
    else if (outputOptions.index)
      console.log(
        `GPIO output pin: ${outputPins
          .map((p) => p.pin)
          .join(", ")} indexedBy: pin ${endTime(begin, 1)}`
      );
    else
      console.log(
        `GPIO output pin: ${outputPins
          .map((p) => p.pin)
          .join(", ")} indexedBy: 0~n ${endTime(begin, 1)}`
      );

    Object.preventExtensions(outputPins);
    return outputPins.length > 1 ? outputPins : outputPins[0];
  } // end of setOutput

  watchAll(
    cb: WatchCallback,
    { edge, pollRate }: { edge?: Edges; pollRate?: number } = {
      edge: Edges.BOTH,
      pollRate: 100,
    }
  ) {
    const cleanUpFns: (() => void)[] = [];
    for (const [, gpioInput] of inputPin) {
      if (gpioInput.isAvailable()) {
        cleanUpFns.push(gpioInput.watch(cb, { edge, pollRate }));
      }
    }
    return () => cleanUpFns.forEach((fn) => fn());
  }

  /* debug mode setup method for legacyTest */
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

    /* check for more than 1 peripheral and channel pairs */
    setImmediate(function () {
      pwmObjectTotal += 1;
      if (PwmObject === pwmObjectTotal && PwmObject > 1) {
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
          if (pins.length > 1 && PwmObject > 1 && pins[1] === pin) {
            console.log(`Paired PWM peripherals (pin ${pins}) detected.`);
            console.log("Range and data will be same for both peripherals.\n");
          }
        });
      });
    });

    return pwm;
  }

  setI2C(pin?: i2cPinSet) {
    return new I2C(pin);
  }

  setSPI() {
    return new SPI();
  }

  /* waiter with millisecond argument */
  mswait(ms: number) {
    rpi.mswait(ms);
  }

  /* waiter with microsecond argument */
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
