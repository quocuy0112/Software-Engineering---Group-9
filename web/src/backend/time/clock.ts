import "server-only";

export interface Clock {
  now(): Date;
}

export class UtcSystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class ControlledClock implements Clock {
  #instant: Date;

  constructor(initial: Date | string) {
    this.#instant = new Date(initial);
    if (Number.isNaN(this.#instant.getTime())) {
      throw new Error("CONTROLLED_CLOCK_INVALID_INSTANT");
    }
  }

  now(): Date {
    return new Date(this.#instant);
  }

  set(instant: Date | string): Date {
    const next = new Date(instant);
    if (Number.isNaN(next.getTime())) {
      throw new Error("CONTROLLED_CLOCK_INVALID_INSTANT");
    }
    this.#instant = next;
    return this.now();
  }

  advanceBy(milliseconds: number): Date {
    if (!Number.isSafeInteger(milliseconds)) {
      throw new Error("CONTROLLED_CLOCK_INVALID_DURATION");
    }
    this.#instant = new Date(this.#instant.getTime() + milliseconds);
    return this.now();
  }
}

export const systemClock: Clock = new UtcSystemClock();
