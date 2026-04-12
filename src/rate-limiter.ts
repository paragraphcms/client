import { ParagraphClientError } from "./errors.js";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class RequestRateLimiter {
  private readonly minIntervalMs: number;
  private nextAvailableAt = 0;
  private scheduling: Promise<void> = Promise.resolve();

  constructor(requestsPerSecond: number) {
    if (
      !Number.isFinite(requestsPerSecond) ||
      requestsPerSecond <= 0
    ) {
      throw new ParagraphClientError(
        "`maxRequestsPerSecond` must be a positive number.",
      );
    }

    this.minIntervalMs = Math.ceil(1000 / requestsPerSecond);
  }

  schedule<T>(task: () => Promise<T>) {
    const slot = this.reserveSlot();
    return slot.then(task);
  }

  private reserveSlot() {
    const slot = this.scheduling.then(async () => {
      const now = Date.now();
      const scheduledAt = Math.max(now, this.nextAvailableAt);
      const delayMs = scheduledAt - now;

      this.nextAvailableAt = scheduledAt + this.minIntervalMs;

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    });

    this.scheduling = slot.catch(() => {});

    return slot;
  }
}
