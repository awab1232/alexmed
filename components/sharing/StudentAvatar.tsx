// Initials avatar for a student in sharing lists — no remote image, so a
// search result never triggers requests to third-party avatar hosts.
const PALETTE = ["#e87b45", "#528c6d", "#5b7fb8", "#a0679f", "#c49a3a"];

export function StudentAvatar({
  name,
  username,
  size = 40,
}: {
  name: string | null;
  username: string;
  size?: number;
}) {
  const label = (name || username || "?").trim();
  const initial = Array.from(label)[0]?.toUpperCase() ?? "?";
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (
    <span
      className="sh-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: PALETTE[Math.abs(hash) % PALETTE.length],
      }}
    >
      {initial}
    </span>
  );
}
