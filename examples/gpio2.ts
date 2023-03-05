// Connect momentary switch buttons on input pin 11 and 13
// and a led for each output pin.
import r from "../lib/array-gpio";

let sw = r.in([11 as const, 13 as const], { index: "pin" });
let led = r.out([33, 35, 37, 36, 38, 40], { index: "pin" });

let LedOn = () => {
  let t = 0; // initial ON time delay in ms
  for (let x in led) {
    t += 50;
    led[x].on(t);
  }
};

let LedOff = () => {
  let t = 0; // initial OFF time delay in ms
  for (let x in led) {
    t += 50;
    led[x].off(t);
  }
};

sw.watchInputs(() => {
  if (sw[11].isOn) {
    LedOn(); // led's will turn ON sequentially with 50 ms delay
  } else if (sw[13].isOn) {
    LedOff(); // led's will turn OFF sequentially with 50 ms delay
  }
});
