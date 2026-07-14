// Shared bounded-retry backoff for the best-effort notification senders (Phase I:
// sendEmail, sendTelegram). These fire AFTER a transaction commits, fire-and-forget
// (`void notify...()`), so a retry here delays only the background send — never the
// HTTP response, and never a held-open DB transaction.
//
// Delays are applied BEFORE each retry, so this array's length is the number of
// RETRIES; total attempts = length + 1 (here: 3 attempts — ~300ms then ~800ms).
// Only TRANSIENT failures are retried (network/transport resets, 5xx); the callers
// classify their own provider errors and never retry 4xx / rate-limit.

export const RETRY_DELAYS_MS = [300, 800];

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
