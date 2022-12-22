import { afterEach, describe, expect, it, vi } from "vitest";
import r, { GpioOutput, GpioState } from "../libSrc/array-gpio";
import { inputPin, outputPin } from "../libSrc/rpi";

describe("Output object test suite", () => {
  afterEach(() => {
    outputPin.forEach((output) => output.close());
    inputPin.forEach((input) => input.close());
    inputPin.clear();
    outputPin.clear();
  });

  it("should create a simple output object", () => {
    const o1 = r.out(36);
    expect((o1 as any) instanceof GpioOutput).toBe(true);
    expect(o1.pin).toBe(36);
    expect(o1.state).toBe(false);
    expect(o1.isOff).toBe(true);

    expect(o1.on).toBeTypeOf("function");
    expect(o1.off).toBeTypeOf("function");
    expect(o1.write).toBeTypeOf("function");
    expect(o1.pulse).toBeTypeOf("function");
  });

  it("should create a simple output with config", () => {
    const o1 = r.out({ pin: 36, initState: GpioState.HIGH });

    expect(o1.state).toBe(true);
    expect(o1.isOn).toBe(true);
    expect(o1.isOff).toBe(false);
  });

  it("should create an index-ordered array of outputs", () => {
    const outputs = r.out([36, 37]);
    expect(outputs).toHaveLength(2);
    expect(outputs[0].pin).toBe(36);
    expect(outputs[1].pin).toBe(37);
  });

  it("should create an pin-ordered array of outputs", () => {
    const outputs = r.out([36, 37], { index: "pin" });
    expect(outputs).toHaveLength(38);
    expect(outputs[36].pin).toBe(36);
    expect(outputs[37].pin).toBe(37);
  });

  it("should create an array from pinObject[]", () => {
    const outputs = r.out([
      { pin: 36, initState: GpioState.HIGH },
      { pin: 37, initState: GpioState.LOW },
    ]);

    expect(outputs[0].state).toBe(true);
    expect(outputs[1].state).toBe(false);
  });

  it("Should verify read / isOn coherence", () => {
    const o1 = r.out(36);
    expect(Boolean(o1.read())).toEqual(false);
    expect(o1.isOff).toBe(true);
    expect(o1.isOn).toBe(false);

    o1.on();

    expect(Boolean(o1.read())).toEqual(true);
    expect(o1.isOff).toBe(false);
    expect(o1.isOn).toBe(true);
  });

  it("should read output wih a cb", () => {
    vi.useFakeTimers();

    const cb = vi.fn();
    const o1 = r.out(36);
    o1.read(cb);

    vi.advanceTimersToNextTimer();

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(0);
  });

  it("should throw an error if attempting to create an output with invalid pin", () => {
    try {
      r.out(39 as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
    try {
      r.out(39 as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
  });
  it("should throw an error if attempting to create an output with invalid argument", () => {
    try {
      r.out("e" as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
  });

  it("should throw an error if attempting to create output with no argument", () => {
    try {
      r.out(undefined as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
  });
});
