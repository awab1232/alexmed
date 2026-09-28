import s from "./doctorSets.module.css";
import type { SetStatusLabel } from "./labels";

const TONE_CLASS: Record<SetStatusLabel["tone"], string> = {
  live: s.chipLive,
  warn: s.chipWarn,
  stop: s.chipStop,
  muted: "",
};

export default function StatusChip({ label, tone }: SetStatusLabel) {
  return <span className={`${s.chip} ${TONE_CLASS[tone]}`}>{label}</span>;
}
