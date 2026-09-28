"use client";

// Before/after comparison: a lecture page as the student has it, and the
// same content after NiroLearn. Both layers sit in one grid cell; the
// "after" layer is clipped at the divider. A native range input drives it,
// so mouse, touch and keyboard all work and screen readers get a slider.
//
// The one orchestrated motion on these pages: when the figure first scrolls
// into view the divider sweeps toward the "after" side (revealing the
// messy page) and back to the middle, showing that there is something to drag. It starts and ends at
// the server-rendered position, so nothing jumps; skipped under reduced
// motion and as soon as the student touches the slider.
import { useEffect, useRef, useState } from "react";
import t from "./transform.module.css";

const REST = 50;
const SWING = 30;

export default function BeforeAfter({
  before,
  after,
  beforeLabel = "قبل",
  afterLabel = "بعد NiroLearn",
  caption,
}: {
  before: React.ReactNode;
  after: React.ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  caption: string;
}) {
  // Share of the width showing "after", measured from the right edge (the
  // inline start in RTL, which is also where a native RTL range starts).
  const [pos, setPos] = useState(REST);
  const figureRef = useRef<HTMLElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = figureRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        const begin = performance.now() + 250;
        const duration = 1500;
        const step = (now: number) => {
          if (touched.current) return;
          const k = Math.max(0, Math.min(1, (now - begin) / duration));
          setPos(REST - SWING * Math.sin(Math.PI * k));
          if (k < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.45 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <figure
      ref={figureRef}
      className={t.compare}
      style={{ "--pos": `${pos}%` } as React.CSSProperties}
    >
      <div className={t.stage}>
        <div className={t.layerBefore} aria-hidden="true">
          {before}
        </div>
        <div className={t.layerAfter} aria-hidden="true">
          {after}
        </div>
        <span className={`${t.tag} ${t.tagBefore}`} aria-hidden="true">
          {beforeLabel}
        </span>
        <span className={`${t.tag} ${t.tagAfter}`} aria-hidden="true">
          {afterLabel}
        </span>
        <span className={t.divider} aria-hidden="true">
          <span className={t.handle} />
        </span>
        <input
          type="range"
          className={t.range}
          min={0}
          max={100}
          step={1}
          value={Math.round(pos)}
          aria-label="اسحب للمقارنة بين الملف قبل NiroLearn وبعده"
          aria-valuetext={`${Math.round(pos)}% من النسخة بعد NiroLearn ظاهرة`}
          onPointerDown={() => (touched.current = true)}
          onKeyDown={() => (touched.current = true)}
          onChange={event => {
            touched.current = true;
            setPos(Number(event.target.value));
          }}
        />
      </div>
      <figcaption className={t.caption}>{caption}</figcaption>
    </figure>
  );
}
