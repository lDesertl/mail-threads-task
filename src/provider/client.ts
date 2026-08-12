import {
  RETRY_AFTER_DEFAULT_SECONDS,
  REQUEST_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
  LIMIT_PER_PAGE,
  HTTP_STATUS,
} from "./client.constants.js";

import type { MessagesPage } from "../types.js";

let nextRequestAt = 0;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitForRateLimit = async () => {
  const now = Date.now();

  if (now < nextRequestAt) {
    await sleep(nextRequestAt - now);
  }

  nextRequestAt = Math.max(Date.now(), nextRequestAt) + REQUEST_INTERVAL_MS;
};

const fetchPage = async (
  cursor?: string | null,
): Promise<MessagesPage> => {
  const providerUrl = process.env.PROVIDER_URL;

  if (!providerUrl) {
    throw new Error("PROVIDER_URL is not set");
  }

  const url = new URL("/v1/messages", providerUrl);

  url.searchParams.set("limit", LIMIT_PER_PAGE);

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  while (true) {
    await waitForRateLimit();

    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      continue;
    }

    if (response.status === HTTP_STATUS.OK) {
      return await response.json() as MessagesPage;
    }

    if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      const value = response.headers.get("Retry-After");

      const retryAfter = Number(value ?? RETRY_AFTER_DEFAULT_SECONDS);

      if (!Number.isFinite(retryAfter) || retryAfter < 0) {
        throw new Error(
          `Provider returned invalid Retry-After: ${value ?? "<missing>"}`,
        );
      }

      await sleep(retryAfter * 1000);
      continue;
    }

    if (response.status === HTTP_STATUS.INTERNAL || response.status === HTTP_STATUS.UNAVAILABLE) {
      continue;
    }

    throw new Error(
      `Provider returned unexpected HTTP ${response.status}`,
    );
  }
};

export default fetchPage;
