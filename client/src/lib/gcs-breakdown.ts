export interface GcsBreakdown {
  eyes: number;
  verbal: number;
  verbalIntubated: boolean;
  motor: number;
  remark: string;
}

// Matches notes like "E1 V1t M4 — documented 2 hours ago"; "t" marks intubated verbal.
const GCS_NOTE = /^E(\d)\s+V(\d)(t?)\s+M(\d)(?:\s+[—-]\s+(.*))?$/;

export function parseGcsNote(note: string): GcsBreakdown | null {
  const match = GCS_NOTE.exec(note);
  if (!match) return null;
  return {
    eyes: Number(match[1]),
    verbal: Number(match[2]),
    verbalIntubated: match[3] === "t",
    motor: Number(match[4]),
    remark: match[5] ?? "",
  };
}
