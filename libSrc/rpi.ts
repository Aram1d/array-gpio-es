/*!
 * array-gpio/rpi.js
 *
 * Copyright(c) 2017 Ed Alegrid <ealegrid@gmail.com>
 * Copyright(c) 2022 Wilfried Sugniaux
 * MIT Licensed
 *
 */
import fs, { Stats } from "fs";
import os from "os";
import bindings from "bindings";
import GpioOutput from "./gpio-output.js";
import {
  Edges,
  GpioMode,
  GpioPin,
  GpioState,
  i2cPinSet,
  IntR,
  PwmPins,
  RpiInitAccess,
  SpiDataMode,
  WatchCallback,
  Watcher,
} from "./types.js";
import GpioInput from "./gpio-input.js";
import PinStateMap from "./pinStateMap.js";

const cc = bindings("node_rpi");

let BoardRev: number;
export const inputPin = new Map<number, GpioInput>();
export const outputPin = new Map<number, GpioOutput>();

export const pinStateMap = new PinStateMap();

export const watchData = new Map<number, Set<Watcher>>();
export const rpiSetup: {
  initialized: boolean;
  access: RpiInitAccess;
  initI2c: false | i2cPinSet;
  initSpi: boolean;
} = {
  initialized: false,
  access: RpiInitAccess.GPIOMEM,
  initI2c: false,
  initSpi: false,
};

/*
 * Verify if the board is a Raspberry Pi
 */
if (os.arch() === "arm" || os.arch() === "arm64") {
  //continue
} else {
  console.log(
    "Sorry, array-gpio has detected that your device is not a Raspberry Pi.\narray-gpio will only work in Raspberry Pi devices.\n"
  );
  throw new Error("device is not a raspberry pi");
}

/*
 * Check rpi board revision.
 */
/*fs.readFile('/proc/cpuinfo', function (err, info) {
    	if (err) throw err;

    	if (!info){
		return false;
    	}

    	info.toString().split(/\n/).forEach(function (line) {
		match = line.match(/^Revision.*(.{4})/);
		if (match) {
			return BoardRev = parseInt(match[1], 16);
		}
    	});

	//console.log('BoardRev', BoardRev.toString(16));
	switch (BoardRev) {
		case 0x10:
		case 0x12:
		case 0x13:
		case 0x14:
		case 0x15:
		case 0x32:
		case 0x92:
		case 0x93:
		case 0xc1:
		case 0x1041:
		case 0x2042:
		case 0x2082:
		case 0x20d3:
		case 0x20a0:
		case 0x20e0:
		break;
		default:
		console.log('\nSorry, your raspberry pi model is not currently supported at this time.\n');
		throw new Error('unsupported rpi board');
		return false;
	}
	return true;
});*/

/*
 * This module only supports 40-pin Raspberry Pi Models.
 * 40-pin Physical Board Pinout Mapping with BCM GPIOxx Pin Numbering.
 *
 * -1 indicates a power supply or a ground pin.
 */

const pinMap = new Map([
  [0, -1],
  [1, -1],
  [2, -1],
  [3, 2],
  [4, -1],
  [5, 3],
  [6, -1],
  [7, 4],
  [8, 14],
  [9, -1],
  [10, 15],
  [11, 17],
  [12, 18],
  [13, 27],
  [14, -1],
  [15, 22],
  [16, 23],
  [17, -1],
  [18, 24],
  [19, 10],
  [20, -1],
  [21, 9],
  [22, 25],
  [23, 11],
  [24, 8],
  [25, -1],
  [26, 7],
  [27, 0],
  [28, 1],
  [29, 5],
  [30, -1],
  [31, 6],
  [32, 12],
  [33, 13],
  [34, -1],
  [35, 19],
  [36, 16],
  [37, 26],
  [38, 20],
  [39, -1],
  [40, 21],
]);

/* Convert physical board pinout number to BCM pin numbering */
function convertPin(pin: GpioPin) {
  const gpioNumber = pinMap.get(pin);
  if (gpioNumber === -1) throw new Error(`Pin ${pin} is not GPIO`);
  if (gpioNumber === undefined) throw new Error(`Pin ${pin} is invalid`);
  return gpioNumber;
}

/* Check if the pin is being used by another application using '/sys/class/gpio/gpio' */
function check_sys_gpio(gpioPin: number, pin: number) {
  fs.stat(
    "/sys/class/gpio/gpio" + gpioPin,
    (err: NodeJS.ErrnoException | null, stats: Stats) => {
      if (err) {
        if (err.code === "ENOENT") {
          // '/sys/class/gpio/gpio' + gpioPin file does not exist
          return;
        }
        throw err;
      }
      if (stats) {
        // fs.writeFileSync('/sys/class/gpio/' + 'unexport', pin);
        console.log(`\n*** pin ${pin} is being used in /sys/class/gpio file"`);
        console.log(
          "*** Please check if another application is using this pin"
        );
        throw pin;
      }
    }
  );
}

/* error message for rpi mode conflict */
function rpiModeConflict() {
  console.log("\n** Peripheral access conflict.");
  console.log(
    "** I2C, SPI and PWM object creation takes precedence over GPIO object creation.\n"
  );
  console.log(
    "** Try creating I2C/SPI/PWM objects before creating GPIO input/output objects.\n"
  );
}

let rpi: Rpi | undefined;
/***
 *  Rpi class
 *
 *  Internal low-level direct register access library
 *  Incorrect use of this functions may cause hang-up/file corruptions
 */
class Rpi {
  constructor() {
    if (!rpi) rpi = this;
    return rpi;
  }

  /*
   * rpi lib access methods
   */
  lib_init(access: RpiInitAccess) {
    if (rpiSetup.initialized) cc.rpi_close();
    cc.rpi_init(access);
    rpiSetup.access = access; // true: rpi in dev/gpiomem for GPIO, false : rpi in dev/mem for i2c, spi, pwm
    rpiSetup.initialized = true; // rpi must be initialized only once
  }

  lib_switch_access(access: RpiInitAccess) {
    if (!rpiSetup.initialized)
      throw new Error("Initialize with lib_init instead");
    if (rpiSetup.access !== access) {
      cc.rpi_init(access);
      rpiSetup.access = access;
    }
  }

  lib_close() {
    outputPin.forEach((output) => output.close());
    inputPin.forEach((input) => input.close());
    return cc.rpi_close();
  }

  /*
   * GPIO
   */

  gpio_mk_input(
    pin: GpioPin,
    { intR, edge }: { intR: IntR; edge: Edges } = {
      intR: IntR.OFF,
      edge: Edges.BOTH,
    }
  ) {
    if (!rpiSetup.initialized) {
      this.lib_init(0);
    }
    const gpioPin = convertPin(pin);
    check_sys_gpio(gpioPin, pin);

    //reset pin in all cases
    this.gpio_close(pin);

    cc.gpio_config(gpioPin, GpioMode.INPUT);
    cc.gpio_enable_pud(gpioPin, intR);

    const instance = new GpioInput(pin, { intR, edge });
    inputPin.set(pin, instance);
    pinStateMap.set(pin, GpioMode.INPUT);
    return instance;
  }

  gpio_mk_output(pin: GpioPin, initState: GpioState = GpioState.LOW) {
    if (!rpiSetup.initialized) {
      this.lib_init(0);
    }
    const gpioPin = convertPin(pin);
    check_sys_gpio(gpioPin, pin);

    //reset pin in all cases
    this.gpio_close(pin);

    cc.gpio_config(gpioPin, GpioMode.OUTPUT);
    cc.gpio_write(gpioPin, initState);

    const instance = new GpioOutput(pin);
    outputPin.set(pin, instance);
    pinStateMap.set(pin, GpioMode.OUTPUT);
    return instance;
  }

  gpio_close(pin: GpioPin) {
    const gpioPin = convertPin(pin);

    if (rpiSetup.access !== RpiInitAccess.GPIOMEM) {
      cc.gpio_enable_pud(gpioPin, IntR.OFF);
    }

    /* reset pin to input */
    cc.gpio_config(gpioPin, GpioMode.INPUT);
    cc.gpio_enable_pud(gpioPin, IntR.OFF);

    pinStateMap.set(pin, GpioMode.INPUT);
  }

  gpio_enable_async_rising_pin_event(pin: GpioPin) {
    cc.gpio_enable_async_rising_event(convertPin(pin), 1);
  }

  gpio_detect_input_pin_event(pin: GpioPin) {
    return cc.gpio_detect_input_event(convertPin(pin)) as number;
  }

  gpio_reset_all_pin_events(pin: GpioPin) {
    cc.gpio_reset_all_events(convertPin(pin));
  }

  gpio_reset_pin_event(pin: GpioPin) {
    cc.gpio_reset_event(convertPin(pin));
  }

  gpio_write(pin: GpioPin, value: GpioState) {
    return cc.gpio_write(convertPin(pin), value) as GpioState;
  }

  gpio_read(pin: GpioPin) {
    return cc.gpio_read(convertPin(pin)) as GpioState;
  }

  gpio_enable_pud(pin: GpioPin, value: IntR) {
    cc.gpio_enable_pud(convertPin(pin), value);
  }

  gpio_watchPin(
    pin: GpioPin,
    cb: WatchCallback,
    edge: Edges = Edges.BOTH,
    td: number = 100
  ) {
    /* check pin if valid */
    try {
      this.gpio_read(pin);
    } catch (e) {
      throw new Error("invalid pin");
    }

    const logic = () => {
      if (cc.gpio_read(convertPin(pin)) && !watcherObj.on) {
        watcherObj.on = true;
        if (edge === Edges.RISING_EDGE || edge === Edges.BOTH) {
          setImmediate(cb, true, pin);
        }
      } else if (!cc.gpio_read(convertPin(pin)) && watcherObj.on) {
        watcherObj.on = false;
        if (edge === Edges.FALLING_EDGE || edge === Edges.BOTH) {
          setImmediate(cb, false, pin);
        }
      }
    };

    const watcherObj: Watcher = {
      on: false,
      logic,
      timeout: setInterval(logic, td),
      unWatch: () => {
        clearInterval(watcherObj.timeout);
        watchData.get(pin)?.delete(watcherObj);
      },
    };

    const maybeWatcherSet = watchData.get(pin);
    if (maybeWatcherSet) maybeWatcherSet.add(watcherObj);
    else watchData.set(pin, new Set([watcherObj]));
    return watcherObj.unWatch;
  }

  gpio_unwatchPin(pin: number) {
    watchData.get(pin)?.forEach((watcher) => watcher.unWatch());
    watchData.delete(pin);
  }

  flushPins(pins: GpioPin[]) {
    pins.forEach((pin) => outputPin.get(pin)?.close());
    pins.forEach((pin) => inputPin.get(pin)?.close());
  }

  /*
   * PWM
   */
  pwmInit(forceInit: boolean = false) {
    /* PWM peripheral requires /dev/mem */
    if (rpiSetup.initialized && rpiSetup.access === RpiInitAccess.GPIOMEM) {
      rpiModeConflict();
      if (!forceInit) throw new Error("pwm peripheral access conflict");
      this.lib_switch_access(RpiInitAccess.MEM);
    }
    /* PWM peripheral requires /dev/mem */
    if (!rpiSetup.initialized) {
      this.lib_init(1);
    }
  }

  pwmResetPin(pin: GpioPin) {
    const gpioPin = convertPin(pin);
    const v = outputPin.has(gpioPin);
    if (!v) {
      cc.pwm_reset_pin(gpioPin);
      this.gpio_close(pin);
    }
  }

  pwmReset() {
    cc.pwm_reset_all_pins();
  }

  /*
   * available pins for PWM - RPi 3 / RPi 4
   * PHY pin  BCM GPIO pin
   *    12         18
   *    32         12
   *    33         13
   *    35         19
   */
  pwmSetup(pin: PwmPins, start: boolean = false, mode: boolean = true) {
    const gpioPin = convertPin(pin);

    check_sys_gpio(gpioPin, pin);

    this.flushPins([pin]);

    cc.pwm_set_pin(gpioPin);
    cc.pwm_set_mode(gpioPin, Number(mode));
    cc.pwm_enable(gpioPin, Number(start));
  }

  pwmSetClockDivider(divider: number) {
    return cc.pwm_set_clock_freq(divider);
  }

  pwmSetRange(pin: GpioPin, range: number) {
    return cc.pwm_set_range(convertPin(pin), range);
  }

  pwmSetData(pin: GpioPin, data: number) {
    return cc.pwm_set_data(convertPin(pin), data);
  }

  /*
   * I2C
   */
  i2cBegin(forceInit: boolean = false) {
    /* I2C requires /dev/mem */
    if (rpiSetup.initialized && rpiSetup.access === RpiInitAccess.GPIOMEM) {
      rpiModeConflict();
      if (!forceInit) throw new Error("i2c peripheral access conflict");
      this.lib_switch_access(RpiInitAccess.MEM);
    }
    if (!rpiSetup.initialized) {
      this.lib_init(1);
    }

    //flush required pins
    this.flushPins([3, 5]);

    const i2cStatus = cc.i2c_start();
    if (i2cStatus) {
      rpiSetup.initialized = true;
      rpiSetup.initI2c = 1;
    }
    return i2cStatus;
  }

  /*
   * PinSets:
   *  - 0 for pin27/Gpio00 SDA0 & pin28/gpio01 SCL0
   *  - 1 for pin03/Gpio02 SDA1 & pin05/gpio03 SCL1
   * */
  i2cInit(pinSet: i2cPinSet, forceInit: boolean = false) {
    /* I2C requires /dev/mem */
    if (rpiSetup.initialized && rpiSetup.access === RpiInitAccess.GPIOMEM) {
      rpiModeConflict();
      if (!forceInit) throw new Error("i2c peripheral access conflict");
      this.lib_switch_access(RpiInitAccess.MEM);
    }

    const requiredPins: GpioPin[] = pinSet === 0 ? [27, 28] : [3, 5];
    this.flushPins(requiredPins);
    requiredPins.forEach((p) => pinStateMap.set(p, GpioMode.ALT));

    if (!rpiSetup.initialized) {
      this.lib_init(1);
      rpiSetup.initI2c = pinSet;
      if (pinSet === 0) {
        return cc.i2c_init(0) as number; // use SDA0 and SCL0 pins
      } else if (pinSet === 1) {
        return cc.i2c_init(1) as number; // use SDA1 and SCL1 pins
      }
    }
  }

  i2cSetSlaveAddress(addr: number) {
    cc.i2c_select_slave(addr);
  }

  i2cSetClockDivider(divider: number) {
    cc.i2c_set_clock_freq(divider);
  }

  i2cSetBaudRate(baud: number) {
    return cc.i2c_data_transfer_speed(baud);
  }

  i2cRead(buf: Buffer, len?: number) {
    if (len && len > buf.length) throw new Error("Insufficient buffer size");
    return cc.i2c_read(buf, len ?? buf.length);
  }

  i2cByteRead() {
    return cc.i2c_byte_read();
  }

  i2cWrite(buf: Buffer, len: number) {
    if (len && len > buf.length) throw new Error("Insufficient buffer size");
    return cc.i2c_write(buf, len ?? buf.length);
  }

  i2cEnd() {
    cc.i2c_stop();
    rpiSetup.initI2c = false;
  }

  /*
   * SPI
   */
  spiGetBoardRev() {
    return BoardRev;
  }

  spiBegin(forceInit: boolean = false) {
    /* SPI requires /dev/mem */
    if (rpiSetup.initialized && rpiSetup.access === RpiInitAccess.GPIOMEM) {
      rpiModeConflict();
      if (!forceInit) throw new Error("spi peripheral access conflict");
      this.lib_switch_access(RpiInitAccess.MEM);
    }

    if (!rpiSetup.initialized) {
      this.lib_init(1);
    }

    const requiredPins: GpioPin[] = [19, 21, 24, 26];
    this.flushPins(requiredPins);
    requiredPins.forEach((p) => pinStateMap.set(p, GpioMode.ALT));
    rpiSetup.initSpi = true;
    return cc.spi_start();
  }

  /*
   * SPI Chip select
   * 0  (00) = Chip select 0
   * 1  (01) = Chip select 1
   * 2  (10) = Chip select 2
   * 3  (11) = Reserved
   * */
  spiChipSelect(cs: number) {
    cc.spi_chip_select(cs);
  }

  spiSetCSPolarity(cs: 0 | 1 | 2, active: 0 | 1) {
    cc.spi_set_chip_select_polarity(cs, active);
  }

  spiSetClockDivider(divider: number) {
    if (divider % 2 !== 0 || divider < 0 || divider > 65536)
      throw new Error(
        "Clock divider must be an even number between 0 and 65536"
      );

    cc.spi_set_clock_freq(divider);
  }

  /*
   *  * SPI Mode0 = 0,  CPOL = 0, CPHA = 0
   * SPI Mode1 = 1,  CPOL = 0, CPHA = 1
   * SPI Mode2 = 2,  CPOL = 1, CPHA = 0
   * SPI Mode3 = 3,  CPOL = 1, CPHA = 1
   */
  spiSetDataMode(mode: SpiDataMode) {
    cc.spi_set_data_mode(mode);
  }

  spiTransfer(wbuf: Buffer, rbuf: Buffer, len: number) {
    cc.spi_data_transfer(wbuf, rbuf, len);
  }

  spiWrite(wbuf: Buffer, len: number) {
    cc.spi_write(wbuf, len);
  }

  spiRead(rbuf: Buffer, len: number) {
    cc.spi_read(rbuf, len);
  }

  spiEnd() {
    cc.spi_stop();
    const requiredPins: GpioPin[] = [19, 21, 24, 26];
    requiredPins.forEach((p) => pinStateMap.set(p, GpioMode.INPUT));
    rpiSetup.initSpi = false;
  }

  /*
   * time delay methods
   */
  // delay in milliseconds
  mswait(ms: number) {
    cc.mswait(ms);
  }
  // delay in microseconds
  uswait(us: number) {
    cc.uswait(us);
  }
} // end of Rpi class

export default new Rpi();

process.on("exit", () => {
  cc.rpi_close();
});
