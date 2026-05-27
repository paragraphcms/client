import Bottleneck from "bottleneck";
import { ParagraphClientError } from "./errors.js";

const DEFAULT_MAX_CONCURRENT_REQUESTS = 1;

export class RequestRateLimiter {
  private readonly limiter: Bottleneck;

  constructor(requestsPerSecond: number) {
    if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
      throw new ParagraphClientError(
        "`maxRequestsPerSecond` must be a positive number.",
      );
    }

    this.limiter = new Bottleneck({
      minTime: Math.ceil(1000 / requestsPerSecond),
      maxConcurrent: DEFAULT_MAX_CONCURRENT_REQUESTS,
    });
  }

  schedule<T>(task: () => Promise<T>) {
    return this.limiter.schedule(task);
  }
}
