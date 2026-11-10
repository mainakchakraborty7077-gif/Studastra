// Twinkling star dots for the dashboard background.
// Positions come from a fixed seed so server and browser render the same stars.
const css = `
.tw-sky{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.tw-star{position:absolute;border-radius:50%;background:#fff;opacity:.15;animation:tw-blink ease-in-out infinite}
.tw-star.gold{background:#f2c46d}
.tw-star.cyan{background:#9be7f5}
@keyframes tw-blink{0%,100%{opacity:.12;transform:scale(.7)}50%{opacity:.95;transform:scale(1.15)}}
@media (prefers-reduced-motion: reduce){.tw-star{animation:none;opacity:.5}}
`;

function seeded(n: number) {
  let s = n;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seeded(7077);
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = rand();
  return {
    left: (rand() * 100).toFixed(2),
    top: (rand() * 100).toFixed(2),
    size: r > 0.9 ? 3 : r > 0.6 ? 2 : 1.5,
    duration: (2 + rand() * 4).toFixed(2),
    delay: (rand() * 5).toFixed(2),
    tone: i % 9 === 0 ? "gold" : i % 7 === 0 ? "cyan" : "",
  };
});

export default function TwinkleStars() {
  return (
    <div className="tw-sky" aria-hidden="true">
      <style>{css}</style>
      {STARS.map((s, i) => (
        <span
          key={i}
          className={`tw-star ${s.tone}`}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
