export interface TargetInfo {
  id: string;
  name: string;
  description: string;
  referenceImage: string; // path to the reference image in /public
  mindFile: string; // path to the compiled .mind file in /public
  specs: { label: string; value: string }[];
  history: string;
}

export const TARGETS: TargetInfo[] = [
  {
    id: "mouse",
    name: "Wireless Optical Mouse",
    description:
      "A modern wireless computer mouse with ergonomic design, high-precision optical tracking, and long battery life.",
    referenceImage: "/targets/mouse-reference.jpg",
    mindFile: "/targets/mouse.mind",
    specs: [
      { label: "Sensor", value: "16,000 DPI Optical" },
      { label: "Battery", value: "70 hrs (Li-ion)" },
      { label: "Latency", value: "1 ms (2.4GHz)" },
      { label: "Weight", value: "63 grams" },
      { label: "Buttons", value: "6 programmable" },
      { label: "Connection", value: "USB-C / BT 5.0" },
    ],
    history:
      "The computer mouse was invented by Douglas Engelbart in 1964 at the Stanford Research Institute. The original was carved from wood with a single button and two perpendicular wheels. Modern wireless mice use laser or optical sensors capable of tracking at 16,000+ DPI on virtually any surface.",
  },
];
