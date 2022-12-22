import { afterEach, describe, expect, it, vi } from "vitest";
import r, { Edges, GpioInput, IntR } from "../libSrc/array-gpio";
import { inputPin, outputPin, watchData } from "../libSrc/rpi";

describe("Input object suite", () => {
  afterEach(() => {
    outputPin.forEach((output) => output.close());
    inputPin.forEach((input) => input.close());
    inputPin.clear();
    outputPin.clear();
  });

  it("should create simple input object", () => {
    const i1 = r.setInput(7);
    expect((i1 as any) instanceof GpioInput).toBe(true);
    expect(i1.pin).toBe(7);
    expect(i1.read).toBeTypeOf("function");
    expect(i1.watch).toBeTypeOf("function");
    expect(i1.unwatch).toBeTypeOf("function");
    expect(i1.intR).toBeTypeOf("function");
  });

  it("should create simple input with config", () => {
    const i1 = r.setInput({ pin: 7, edge: Edges.FALLING_EDGE, intR: IntR.UP });
    expect((i1 as any) instanceof GpioInput).toBe(true);
    expect(i1.defaultIntR).toBe(IntR.UP);
    expect(i1.defaultEdge).toBe(Edges.FALLING_EDGE);
  });

  it("should create index-ordered array of inputs", () => {
    const inputs = r.setInput([7, 11, 13, 16]);
    expect(inputs).toHaveLength(4);
    expect(inputs[0].pin).toBe(7);
    expect(inputs[2].pin).toBe(13);
  });

  it("should create pin-ordered array of inputs", () => {
    const inputs = r.setInput([7, 11, 13, 16], { index: "pin", intR: IntR.UP });
    expect(inputs).toHaveLength(17);
    expect(inputs[7].pin).toBe(7);
    expect(inputs[7].defaultIntR).toBe(IntR.UP);
    expect(inputs[13].pin).toBe(13);
  });

  it("should create array from pinObject[] arg", () => {
    const inputs = r.setInput([
      { pin: 7, intR: IntR.DN },
      { pin: 11, intR: IntR.UP },
    ]);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].pin).toBe(7);
    expect(inputs[0].defaultIntR).toBe(IntR.DN);
    expect(inputs[1].pin).toBe(11);
    expect(inputs[1].defaultIntR).toBe(IntR.UP);
  });

  it("Should verify read / isOn coherence", () => {
    const i1 = r.in(7);
    const i1State = i1.read();

    expect(Boolean(i1State)).toEqual(i1.isOn);
  });

  it("should read input with a cb", () => {
    vi.useFakeTimers();

    const cb = vi.fn();
    const i1 = r.in(7);
    i1.read(cb);

    vi.advanceTimersToNextTimer();

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(0);
  });

  it("should throw an error if attempting to create an input with invalid pin", () => {
    try {
      r.in(1 as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
    try {
      r.in(0 as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
  });
  it("should throw an error if attempting to create input with invalid argument", () => {
    try {
      r.in("e" as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
  });

  it("should throw an error if attempting to create input with no argument", () => {
    try {
      r.in(undefined as any);
    } catch (e: any) {
      expect(e?.message).toContain("Gpio pin must be one of");
    }
  });

  describe("watch method", () => {
    it("should watch set a listener up", () => {
      const cb1 = () => 2 + 2;

      const i1 = r.in(7);
      const unwatchI1 = i1.watch(cb1);

      const watchers = watchData.get(7);
      if (!watchers) throw new Error("watcher is not set");

      expect(watchers.size).toBe(1);
      expect(Array.from(watchers)[0].unWatch).toEqual(unwatchI1);

      unwatchI1();
      expect(watchers.size).toBe(0);
    });

    it("should remove watch listeners if input closes", () => {
      const cb1 = () => 2 + 2;
      const i1 = r.in(7);
      i1.watch(cb1);
      i1.watch(() => 3 + 3);

      const watchers = watchData.get(7);
      if (!watchers) throw new Error("watcher is not set");
      expect(watchers.size).toBe(2);

      i1.close();
      expect(watchers.size).toBe(0);
    });

    it("should gpioGroup watch method act only on grouped pins", () => {
      const cb1 = () => 2 + 2;

      const i1 = r.in(3);
      const otherInputs = r.in([7, 11, 13]);
      otherInputs.watchInputs(cb1);

      expect(watchData.get(3)?.size).toBe(undefined);
      const unwatch = i1.watch(cb1);
      expect(watchData.get(3)?.size).toBe(1);

      otherInputs.unwatchInputs();
      expect(watchData.get(3)?.size).toBe(1);
      unwatch();
    });

    it("should gpioInput unwatch method remove all listeners", () => {
      const cb1 = () => 2 + 2;

      const i1 = r.in(3);
      i1.watch(cb1);
      i1.watch(cb1);
      expect(watchData.get(3)?.size).toBe(2);

      i1.unwatch();
      expect(watchData.get(3)?.size).toBe(undefined);
    });
  });
});
