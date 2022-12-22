//Pins related types
export const gpio = [
  3, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29,
  31, 32, 33, 35, 36, 37, 38, 40,
] as const;
export type GpioPin = typeof gpio[number];
export const pwm = { pwm0: [12, 32] as const, pwm1: [33, 35] as const };
export type PwmPins = typeof pwm.pwm0[number] | typeof pwm.pwm1[number];

//rpi low-level lib

export enum RpiInitAccess {
  GPIOMEM,
  MEM,
}

export type SpiDataMode = 0 | 1 | 2 | 3;
export type i2cPinSet = 0 | 1;
export type WatchCallback = (state: GpioBit, pin: number) => void;
export type Watcher = {
  on: boolean;
  logic: () => void;
  timeout: NodeJS.Timer;
  unWatch: () => void;
};

// Values

export enum GpioState {
  LOW,
  HIGH,
}

export enum GpioMode {
  INPUT,
  OUTPUT,
  ALT,
}

export enum IntR {
  OFF,
  DN,
  UP,
}

export enum Edges {
  FALLING_EDGE = 1,
  RISING_EDGE,
  BOTH,
}

export type GpioBit = 0 | 1 | boolean;
export type StateCallback = (state: GpioBit) => void;
