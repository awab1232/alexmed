import NiroAvatar from "@/components/niro/NiroAvatar";
import NiroCharacter from "@/components/niro/NiroCharacter";
import NiroSpark from "@/components/niro/NiroSpark";
import {
  NIRO_EXPRESSION_USAGE,
  NIRO_EXPRESSIONS,
  NIRO_UNIVERSE,
} from "@/lib/niro";

// 🎨 Niro style guide (admin only, via app/admin/layout.tsx): every
// expression and size side by side, to review consistency — and to check
// commissioned art once it's registered in lib/niro-assets.ts.
export default function NiroStyleGuidePage() {
  return (
    <div className="niro-guide">
      <h1>Niro — character system</h1>
      <p>
        Same character in every state. Vector v1; final art plugs in via
        lib/niro-assets.ts (see public/niro/README.md).
      </p>

      <section className="niro-guide-grid">
        {NIRO_EXPRESSIONS.map(expression => (
          <figure key={expression}>
            <NiroCharacter expression={expression} size={170} />
            <figcaption>
              <strong>{expression}</strong>
              <span>{NIRO_EXPRESSION_USAGE[expression]}</span>
            </figcaption>
          </figure>
        ))}
      </section>

      <h2>Avatar sizes & Spark</h2>
      <div className="niro-guide-row">
        {[20, 26, 32, 44, 64].map(size => (
          <NiroAvatar key={size} size={size} />
        ))}
        <NiroAvatar size={44} spark="glow" />
        <NiroSpark size={18} />
        <NiroSpark size={28} motion="glow" />
        <NiroSpark size={28} motion="think" />
      </div>

      <h2>Niro universe</h2>
      <ul>
        {Object.values(NIRO_UNIVERSE).map(name => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
