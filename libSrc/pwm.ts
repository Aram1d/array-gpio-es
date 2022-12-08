/*!
 * array-gpio/pwm.js
 *
 * Copyright(c) 2017 Ed Alegrid
 * MIT Licensed
 */
import { rpi } from "./rpi";

let Freq = 1;
let pwmObject = 0;

class PWM {
  _T: any;
  _pw: any;
  _pin: number;
  _freq: number;
  _pwmStarted: boolean;
  _pinOnlySetup: boolean;
  constructor(pin: number, freq: number, T: number, pw: number) {
    /* track pwm object */
    pwmObject += 1;
    exports.pwmObject = pwmObject;

    this._T = T;
    this._pw = pw;
    this._pin = pin;
    this._freq = freq;
    this._pwmStarted = false;
    this._pinOnlySetup = freq === 1;

    /*
     * initilize PWM
     * servo control will use only mark/space (M/S) mode
     */
    rpi.pwmInit();
    this.enable(false);
    this._pwmStarted = false;

    if (freq !== 1 && T !== 0 && pw !== 0) {
      if (pwmObject === 1) {
        /* 10kHz -> 0.1 ms */
        if (freq === 10) {
          Freq = 10;
          this.setClockFreq(1920);
        } else if (freq === 100) {
          /* 100KHz -> 0.01 ms */
          Freq = 100;
          this.setClockFreq(192);
        } else if (freq === 1000) {
          /* 100KHz -> 0.001 ms */
          Freq = 1000;
          this.setClockFreq(19);
        }
      }
      this.setRange(this._T);
      this.setData(this._pw);
    }
  }

  /* initialize PWM object */
  enable(start: boolean) {
    rpi.pwmSetup(this._pin, start);
  }

  /* set oscillator clock frequency using a divider value */
  setClockFreq(div: number) {
    if (div > 0 && div < 4095) {
      rpi.pwmSetClockDivider(div);
      const freq = Math.round(19200000 / div);
      Freq = freq / 1000;

      if (pwmObject === 1) {
        setImmediate(function () {
          console.log(`Frequency calculation (div " + div + "): ${Freq} KHz`);
        });
      }
      exports.Freq = Freq;
    } else {
      throw new Error("setClock() error: invalid div value");
    }
  }

  /*
   *  set period T or space value from m/s mode
   */
  setRange(range: number) {
    this._T = range;
    rpi.pwmSetRange(this._pin, range);
  }

  /*
   * set pw(pulse width) over period T or mark value over space
   */
  setData(data: number) {
    this._pw = data;
    this.enable(true);

    /* validate pw vs range */
    if (Freq === 10 || Freq === 100 || Freq === 1000 || Freq === 1) {
      if (this._T === 0) {
        console.log(`Alert! pin ${this._pin} period T or range is zero.`);
      }

      if (data > 0 && data <= this._T) {
        rpi.pwmSetData(this._pin, data);
      }

      if (data > this._T) {
        console.log(
          "Alert! pin " +
            this._pin +
            ", pw " +
            data +
            " is higher than the period T " +
            this._T
        );
        rpi.pwmSetData(this._pin, data);
      }
    }
  }

  start() {
    if (this._pw === 1) {
      this._pw = this._T;
    }
    rpi.pwmSetData(this._pin, this._pw);
  }

  stop() {
    this.enable(false);
    this._pwmStarted = false;
  }

  pulse(pw: number) {
    if (!this._pwmStarted) {
      this.enable(true);
    }
    this._pwmStarted = true;
    if (pw === undefined) {
      this.setData(this._pw);
    } else {
      rpi.pwmSetData(this._pin, pw);
    }
  }

  stopPulse() {
    this.enable(false);
    this._pwmStarted = false;
  }

  close() {
    this._pwmStarted = false;
    /* reset to 19.2MHz */
    //rpi.pwmSetClockDivider(1);
    rpi.pwmSetup(this._pin, false);
    rpi.pwmSetRange(this._pin, 0);
    rpi.pwmSetData(this._pin, 0);
    rpi.pwmReset();
    //rpi.pwmResetPin(this._pin);
  }
} // end of PWM class

module.exports = PWM;
