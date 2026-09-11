import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { RPC_URL } from "./config";

export const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL, { timeout: 60_000, retryCount: 0 }),
});
