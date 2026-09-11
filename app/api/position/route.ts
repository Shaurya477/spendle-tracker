import { isAddress } from "viem";
import { getPosition } from "@/lib/pendle/position";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(address, { strict: false })) {
    return Response.json({ error: `Not an Ethereum address: ${address}` }, { status: 400 });
  }
  try {
    return Response.json(await getPosition(address));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
