"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// The "study oath" intro shown once per login session, before the dashboard.
// It is cleared from sessionStorage on sign-in and sign-out.
export const OATH_KEY = "studastra-oath-done";

const PROMISES = [
  "Promise you will study for at least 2 hours today.",
  "Promise you will keep your phone away while studying.",
  "Promise you will solve problems yourself before seeing solutions.",
  "Promise you won't give up when it gets hard.",
];

type Stage = "ask" | "no" | "promise" | "lamp" | "boom" | "leaving";

export default function StudyOath() {
  // null = not decided yet (render a plain black cover so the dashboard never flashes first)
  const [visible, setVisible] = useState<boolean | null>(null);
  const [stage, setStage] = useState<Stage>("ask");
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const flameRef = useRef<SVGGElement>(null);
  const timers = useRef<number[]>([]);

  useLayoutEffect(() => {
    let done = false;
    try { done = sessionStorage.getItem(OATH_KEY) === "1"; } catch { done = false; }
    setVisible(!done);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const finish = useCallback(() => {
    try { sessionStorage.setItem(OATH_KEY, "1"); } catch { /* ignore */ }
    setStage("leaving");
    timers.current.push(window.setTimeout(() => setVisible(false), 750));
  }, []);

  function promise() {
    if (step < PROMISES.length - 1) setStep(step + 1);
    else setStage("lamp");
  }

  function hitLamp() {
    const r = flameRef.current?.getBoundingClientRect();
    if (r) setOrigin({ x: ((r.left + r.width / 2) / window.innerWidth) * 100, y: ((r.top + r.height / 2) / window.innerHeight) * 100 });
    setStage("boom");
    try { sessionStorage.setItem(OATH_KEY, "1"); } catch { /* ignore */ }
    timers.current.push(window.setTimeout(finish, 1100));
  }

  if (visible === false) return null;
  if (visible === null) return <div className="oa-root" aria-hidden="true"><style>{css}</style></div>;

  const boom = stage === "boom" || stage === "leaving";

  return (
    <div className={`oa-root ${stage === "leaving" ? "oa-leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Study oath">
      <style>{css}</style>
      {!boom && <button type="button" className="oa-skip" onClick={finish}>Skip</button>}

      <div className="oa-center" aria-live="polite">
        {stage === "ask" && (
          <div className="oa-scene" key="ask">
            <p className="oa-text">Do you want to study?</p>
            <div className="oa-btns">
              <button type="button" className="oa-btn" onClick={() => { setStep(0); setStage("promise"); }}>Yes</button>
              <button type="button" className="oa-btn" onClick={() => setStage("no")}>No</button>
            </div>
          </div>
        )}

        {stage === "no" && (
          <div className="oa-scene" key="no">
            <p className="oa-text">Come back when you&rsquo;re ready.<br />Your dreams are waiting.</p>
            <div className="oa-btns">
              <button type="button" className="oa-btn" onClick={() => setStage("ask")}>Okay, I want to study</button>
            </div>
          </div>
        )}

        {stage === "promise" && (
          <div className="oa-scene" key={`p${step}`}>
            <p className="oa-count">{step + 1} / {PROMISES.length}</p>
            <p className="oa-text">{PROMISES[step]}</p>
            <div className="oa-btns">
              <button type="button" className="oa-btn oa-warm" onClick={promise}>I promise</button>
            </div>
          </div>
        )}

        {(stage === "lamp" || boom) && (
          <div className="oa-scene" key="lamp">
            <p className="oa-text oa-small">OK, I understood.<br />You are very sincere about your career.</p>
            <p className="oa-hint">Hit the lamp</p>
            <button type="button" className="oa-lamp" onClick={hitLamp} disabled={boom} aria-label="Hit the lamp of Knowledge">
              <Diya flameRef={flameRef} />
            </button>
          </div>
        )}
      </div>

      {boom && (
        <>
          <div className="oa-boom" style={{ left: `${origin.x}%`, top: `${origin.y}%` }} />
          <div className="oa-flash" />
        </>
      )}
    </div>
  );
}

function Diya({ flameRef }: { flameRef: React.RefObject<SVGGElement | null> }) {
  return (
    <svg className="oa-diya" viewBox="0 0 260 180" width="260" height="180" aria-hidden="true">
      <defs>
        <linearGradient id="oaClay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9783a" />
          <stop offset=".55" stopColor="#a8481c" />
          <stop offset="1" stopColor="#6e2a0e" />
        </linearGradient>
        <radialGradient id="oaOil" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#7a3a12" />
          <stop offset="1" stopColor="#3a1606" />
        </radialGradient>
        <radialGradient id="oaHalo" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffd88a" stopOpacity=".55" />
          <stop offset=".45" stopColor="#ff9d3a" stopOpacity=".18" />
          <stop offset="1" stopColor="#ff9d3a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="oaFlame" cx=".5" cy=".75" r=".7">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset=".35" stopColor="#ffd65a" />
          <stop offset=".75" stopColor="#ff8a1e" />
          <stop offset="1" stopColor="#e2510c" />
        </radialGradient>
      </defs>

      {/* warm halo around the flame */}
      <circle className="oa-halo" cx="224" cy="58" r="58" fill="url(#oaHalo)" />

      {/* small stand */}
      <ellipse cx="116" cy="164" rx="40" ry="8" fill="#5a220b" />
      <path d="M86 150 Q116 170 146 150 L142 162 Q116 172 90 162 Z" fill="#7d3212" />

      {/* clay bowl with pinched spout on the right */}
      <path d="M14 92 C 18 136, 64 158, 116 158 C 166 158, 198 136, 208 108 L 240 84 C 224 82, 208 85, 196 92 Z" fill="url(#oaClay)" />
      {/* rim and oil */}
      <path d="M14 92 C 60 78, 160 78, 196 92 C 208 86, 224 82, 240 84 C 226 92, 214 98, 200 101 C 160 110, 60 110, 14 92 Z" fill="#c4622c" />
      <path d="M26 93 C 70 84, 152 84, 190 94 C 154 103, 70 103, 26 93 Z" fill="url(#oaOil)" />
      {/* decorative dots and band */}
      <path d="M30 112 C 70 128, 160 128, 200 112" stroke="#f0b06a" strokeOpacity=".55" strokeWidth="1.5" fill="none" strokeDasharray="1 7" strokeLinecap="round" />
      <text x="112" y="138" textAnchor="middle" className="oa-word">Knowledge</text>

      {/* wick */}
      <path d="M226 86 Q228 78 225 72" stroke="#2a1206" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* flame */}
      <g ref={flameRef} transform="translate(225 74)">
        <g className="oa-flame">
          <path d="M0 0 C -11 -8, -9 -26, 0 -44 C 9 -26, 11 -8, 0 0 Z" fill="url(#oaFlame)" />
          <path d="M0 -2 C -4 -7, -4 -15, 0 -24 C 4 -15, 4 -7, 0 -2 Z" fill="#fffdf2" opacity=".9" />
        </g>
      </g>
    </svg>
  );
}

const css = `
.oa-root{position:fixed;inset:0;z-index:9999;background:#000;color:rgba(255,236,210,.62);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Georgia,"Times New Roman",serif;overflow:hidden;opacity:1;transition:opacity .7s ease}
.oa-root.oa-leaving{opacity:0;pointer-events:none}
.oa-center{position:relative;z-index:1;width:100%;max-width:640px;text-align:center}
.oa-scene{display:flex;flex-direction:column;align-items:center;gap:28px;animation:oa-in 2.2s ease both}
.oa-text{margin:0;font-size:clamp(22px,5.2vw,36px);line-height:1.4;letter-spacing:.3px;color:rgba(255,236,210,.62);text-shadow:0 0 18px rgba(255,200,130,.35),0 0 42px rgba(255,170,90,.18)}
.oa-small{font-size:clamp(19px,4.4vw,28px)}
.oa-count{margin:0;font-family:system-ui,sans-serif;font-size:12px;letter-spacing:3px;color:rgba(255,236,210,.3)}
.oa-hint{margin:0;font-family:system-ui,sans-serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,214,150,.5);animation:oa-in 2s ease 1.2s both}
.oa-btns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;animation:oa-in 1.6s ease .9s both}
.oa-btn{min-width:120px;min-height:46px;padding:11px 26px;border-radius:999px;border:1px solid rgba(255,220,170,.22);background:rgba(255,220,170,.04);color:rgba(255,236,210,.78);font:500 16px system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.4px;cursor:pointer;transition:border-color .3s,box-shadow .3s,color .3s,background .3s}
.oa-btn:hover,.oa-btn:focus-visible{outline:none;color:#ffe9c8;border-color:rgba(255,200,130,.6);background:rgba(255,200,130,.08);box-shadow:0 0 24px rgba(255,180,90,.25)}
.oa-warm{border-color:rgba(255,200,130,.4)}
.oa-skip{position:absolute;top:16px;right:18px;z-index:2;background:none;border:0;padding:8px;color:rgba(255,236,210,.32);font:13px system-ui,sans-serif;letter-spacing:1px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.oa-skip:hover,.oa-skip:focus-visible{color:rgba(255,236,210,.75);outline:none}
.oa-lamp{background:none;border:0;padding:6px;cursor:pointer;border-radius:24px;animation:oa-in 2s ease 1.6s both;-webkit-tap-highlight-color:transparent}
.oa-lamp:focus-visible{outline:1px solid rgba(255,200,130,.4)}
.oa-lamp:hover .oa-diya{filter:drop-shadow(0 0 22px rgba(255,170,80,.45))}
.oa-diya{display:block;width:min(260px,70vw);height:auto;filter:drop-shadow(0 0 14px rgba(255,170,80,.25));transition:filter .4s}
.oa-word{font:italic 600 19px Georgia,"Times New Roman",serif;fill:#ffe1b0;letter-spacing:1px}
.oa-flame{transform-box:fill-box;transform-origin:50% 100%;animation:oa-flicker 1.6s ease-in-out infinite}
.oa-halo{transform-box:fill-box;transform-origin:center;animation:oa-glow 2.4s ease-in-out infinite}
.oa-boom{position:absolute;z-index:3;width:12vmax;height:12vmax;border-radius:50%;transform:translate(-50%,-50%) scale(0);background:radial-gradient(circle,#fffaf0 0%,#ffe6a8 28%,#ffb85c 52%,rgba(255,140,40,.55) 66%,rgba(255,120,30,0) 74%);animation:oa-boom 1s cubic-bezier(.2,.7,.2,1) forwards;pointer-events:none}
.oa-flash{position:absolute;inset:0;z-index:4;background:#fff4dc;opacity:0;animation:oa-flash 1.1s ease forwards;pointer-events:none}
@keyframes oa-in{from{opacity:0;filter:blur(6px);transform:translateY(8px)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes oa-flicker{0%,100%{transform:scale(1,1) skewX(0)}20%{transform:scale(.94,1.06) skewX(2deg)}40%{transform:scale(1.04,.95) skewX(-2deg)}60%{transform:scale(.97,1.08) skewX(1deg)}80%{transform:scale(1.02,.97) skewX(-1deg)}}
@keyframes oa-glow{0%,100%{opacity:.85;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
@keyframes oa-boom{0%{transform:translate(-50%,-50%) scale(0);opacity:1}70%{opacity:1}100%{transform:translate(-50%,-50%) scale(30);opacity:1}}
@keyframes oa-flash{0%{opacity:0}55%{opacity:0}80%{opacity:.95}100%{opacity:1}}
@media (prefers-reduced-motion: reduce){
.oa-scene,.oa-btns,.oa-hint,.oa-lamp{animation:oa-fade .8s ease both}
.oa-flame,.oa-halo{animation:none}
.oa-boom{display:none}
.oa-flash{animation:oa-fade .6s ease forwards}
}
@keyframes oa-fade{from{opacity:0}to{opacity:1}}
`;
