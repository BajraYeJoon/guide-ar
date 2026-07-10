import { NextResponse } from "next/server";
import { TARGETS } from "@/data/targets";

export async function GET() {
  const objects = TARGETS.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    history: t.history,
    specs: Object.fromEntries(t.specs.map((s) => [s.label, s.value])),
    imageUrl: t.referenceImage,
  }));
  return NextResponse.json(objects);
}
