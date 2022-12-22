import { afterEach, describe, expect, it } from "vitest";
import r, { GpioInput, I2C } from "../libSrc/array-gpio";
import { rpiSetup } from "../libSrc/rpi";

import { inputPin, outputPin } from "../libSrc/rpi";
describe("i2c test suite", () => {
  afterEach(() => {
    outputPin.forEach((output) => output.close());
    inputPin.forEach((input) => input.close());
    inputPin.clear();
    outputPin.clear();
    rpiSetup.initialized = false;
  });

  it("should fail to create i2c after standard gpio init", () => {
    r.in(7);
    expect(r.setI2C).toThrowError("i2c peripheral access conflict");
  });

  it("should create a i2c object before gpio creation", () => {
    const i2c = r.setI2C();
    const i1 = r.in(7);

    expect((i2c as any) instanceof I2C).toBe(true);
    expect((i1 as any) instanceof GpioInput).toBe(true);
  });
});
