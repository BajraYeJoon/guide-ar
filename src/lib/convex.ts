import { ConvexClient } from "convex/browser";

let client: ConvexClient | null = null;

export function getConvex(): ConvexClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error(
        "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to configure it in .env.local"
      );
    }
    client = new ConvexClient(url);
  }
  return client;
}

export function closeConvex() {
  client?.close();
  client = null;
}
