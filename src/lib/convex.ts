import { ConvexClient } from "convex/browser";

let client: ConvexClient | null = null;

export function getConvex(): ConvexClient {
  if (!client) {
    client = new ConvexClient(
      process.env.NEXT_PUBLIC_CONVEX_URL ??
        "https://warmhearted-bobcat-11.convex.cloud"
    );
  }
  return client;
}

export function closeConvex() {
  client?.close();
  client = null;
}
