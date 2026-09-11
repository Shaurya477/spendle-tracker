import { createPublicClient, http, type Transport } from "viem";
import { mainnet } from "viem/chains";
import { RPC_URL } from "./config";

/**
 * Tenderly's public gateway meters each client IP in weighted units against a 20-unit window of
 * one second, counted on arrival (response headers `x-tdly-limit` / `x-tdly-remaining` /
 * `x-tdly-reset-timestamp`, measured 11 Sep 2026): `eth_call` and `eth_getLogs` cost 4 units,
 * `eth_getBlockByNumber` and the rest cost 1. Anything over the window is answered 429
 * `rate limit exceeded`. Payload size, multicall size and `eth_getLogs` range are not limited in
 * any way this app reaches (a 25 KB multicall and a 1.6M-block `eth_getLogs` both pass), so the
 * only thing to control is the rate.
 *
 * Two rules keep a load under the window. Every request is reserved against a sliding one-second
 * budget of 14 units before it is sent, so no trailing second carries more than 14 units by send
 * time. And at most two requests are in flight, so requests reuse two warm connections and arrive
 * within tens of milliseconds of send order; the gateway then sees at worst 14 units plus one
 * 4-unit call straddling a window edge. The previous pacer spaced sends at 16 units/s but reserved
 * each cost after the send (19 units could land in one second) and let every read fly at once, so
 * fresh TLS handshakes on a cold load reordered arrivals and bunched a second past 20 units.
 * A request the gateway still rejects fails immediately; nothing is retried.
 *
 * Next bundles each route separately, so a module-level variable would give the page and
 * /api/position a pacer each; the state lives on globalThis to keep one budget per process.
 */
const WINDOW_MS = 1000;
const UNITS_PER_WINDOW = 14;
const MAX_IN_FLIGHT = 2;
const unitCost = (method: string) => (method === "eth_call" || method === "eth_getLogs" ? 4 : 1);

type Pacer = { sent: { at: number; cost: number }[]; inFlight: number; waiters: (() => void)[] };
const pacer: Pacer = ((globalThis as typeof globalThis & { __spendleRpcPacer?: Pacer }).__spendleRpcPacer ??= {
  sent: [],
  inFlight: 0,
  waiters: [],
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reserve(cost: number) {
  for (;;) {
    const now = Date.now();
    pacer.sent = pacer.sent.filter((s) => now - s.at < WINDOW_MS);
    const used = pacer.sent.reduce((n, s) => n + s.cost, 0);
    if (used + cost <= UNITS_PER_WINDOW) {
      pacer.sent.push({ at: now, cost });
      return;
    }
    await sleep(pacer.sent[0].at + WINDOW_MS - now);
  }
}

async function acquire() {
  if (pacer.inFlight < MAX_IN_FLIGHT) {
    pacer.inFlight++;
    return;
  }
  await new Promise<void>((r) => pacer.waiters.push(r));
}

/** Hand the slot to the next waiter in FIFO order, or free it. */
function release() {
  const next = pacer.waiters.shift();
  if (next) next();
  else pacer.inFlight--;
}

async function paced<T>(method: string, send: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    await reserve(unitCost(method));
    return await send();
  } finally {
    release();
  }
}

function serialised(inner: Transport): Transport {
  return (params) => {
    const transport = inner(params);
    const request: typeof transport.request = (args, options) =>
      paced(args.method, () => transport.request(args, options));
    return { ...transport, request };
  };
}

export const client = createPublicClient({
  chain: mainnet,
  transport: serialised(http(RPC_URL, { timeout: 60_000, retryCount: 0 })),
});
