import { gpio, GpioPin, GpioMode } from "./types.js";

export default class PinStateMap extends Map<GpioPin, GpioMode> {
  constructor() {
    const initStateMap = gpio.map((pin) => [pin, GpioMode.INPUT] as const);
    super(initStateMap);
  }
}
