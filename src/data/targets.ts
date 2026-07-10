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
  {
    id: "bottle",
    name: "Water Bottle",
    description:
      "A standard plastic water bottle with a screw cap, commonly used for hydration.",
    referenceImage: "/targets/bottle.jpg",
    mindFile: "/targets/bottle.mind",
    specs: [
      { label: "Capacity", value: "500 ml" },
      { label: "Material", value: "PET Plastic" },
      { label: "Height", value: "20 cm" },
      { label: "Weight", value: "15 grams (empty)" },
      { label: "Cap", value: "Screw-on" },
      { label: "Recyclable", value: "Yes" },
    ],
    history:
      "Plastic bottles became popular in the 1970s as a lightweight alternative to glass. PET plastic is the most common material for water bottles due to its clarity, strength, and recyclability. Over 1 million plastic bottles are purchased every minute worldwide.",
  },
];
