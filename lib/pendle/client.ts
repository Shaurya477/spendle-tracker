import { createPublicClient, http, type Transport } from "viem";
import { mainnet } from "viem/chains";
import { RPC_URL } from "./config";

/**
 * Tenderly's public gateway meters each client IP in weighted units against a 20-unit window of
 * about one second (response headers `x-tdly-limit` / `x-tdly-remaining`, measured 11 Sep 2026):
 * `eth_call` and `eth_getLogs` cost 4 units, `eth_getBlockByNumber` and the rest cost 1. Anything
 * over the window is answered 429 `rate limit exceeded`. Payload size, multicall size and
 * `eth_getLogs` range are not limited in any way this app reaches, so the only thing to control
 * is the rate: every request goes through one process-wide pacer that spends at most 16 units per
 * second, and nothing is fired in parallel bursts. A rejected request still fails immediately.
 *
 * Next bundles each route separately, so a module-level variable would give the page and
 * /api/position a pacer each; the state lives on globalThis to keep one budget per process.
 */
const UNITS_PER_SECOND = 16;
const unitCost = (method: string) => (method === "eth_call" || method === "eth_getLogs" ? 4 : 1);

type Pacer = { nextFreeAt: number };
const pacer: Pacer = ((globalThis as typeof globalThis & { __spendleRpcPacer?: Pacer }).__spendleRpcPacer ??= {
  nextFreeAt: 0,
});

async function pace(method: string) {
  const now = Date.now();
  const start = Math.max(now, pacer.nextFreeAt);
  pacer.nextFreeAt = start + (unitCost(method) * 1000) / UNITS_PER_SECOND;
  if (start > now) await new Promise((r) => setTimeout(r, start - now));
}

function paced(inner: Transport): Transport {
  return (params) => {
    const transport = inner(params);
    const request: typeof transport.request = async (args, options) => {
      await pace(args.method);
      return transport.request(args, options);
    };
    return { ...transport, request };
  };
}

export const client = createPublicClient({
  chain: mainnet,
  transport: paced(http(RPC_URL, { timeout: 60_000, retryCount: 0 })),
});
