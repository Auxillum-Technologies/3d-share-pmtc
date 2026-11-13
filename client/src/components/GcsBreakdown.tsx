import { parseGcsNote } from "@/lib/gcs-breakdown";

export default function GcsBreakdown({ note }: { note: string }) {
  const parsed = parseGcsNote(note);
  if (!parsed) {
    return <div className="text-[15.84px] text-[#7d7081]">{note}</div>;
  }

  const cells = [
    { label: "Eyes", value: String(parsed.eyes) },
    {
      label: "Verbal",
      value: `${parsed.verbal}${parsed.verbalIntubated ? "T" : ""}`,
    },
    { label: "Motor", value: String(parsed.motor) },
  ];

  return (
    <>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {cells.map(({ label, value }) => (
          <div key={label} className="clay-inset px-2 py-1.5 text-center">
            <div className="font-telemetry text-[14.4px] uppercase text-[#7d7081]">
              {label}
            </div>
            <div className="font-numeric text-[28.8px] font-bold text-[#3b3340]">
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[15.84px] text-[#7d7081]">
        {parsed.verbalIntubated && "T = intubated, verbal not testable. "}
        {parsed.remark}
      </div>
    </>
  );
}
