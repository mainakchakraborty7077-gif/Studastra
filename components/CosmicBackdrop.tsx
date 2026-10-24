import type { ReactNode } from "react";

// All styling lives here as plain CSS, so it works without Tailwind.
const css = `
.sa-stage{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:48px 20px;color:#f4efe4;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:radial-gradient(ellipse at 50% 0%,#2a2170 0%,#0c1033 55%,#070920 100%)}
.sa-orbits{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none}
.sa-inner{position:relative;z-index:1;width:100%;display:flex;justify-content:center}
.sa-card{width:100%;max-width:440px;box-sizing:border-box;border-radius:24px;border:1px solid rgba(242,196,109,.2);background:rgba(20,24,69,.88);padding:32px;box-shadow:0 25px 60px rgba(0,0,0,.45)}
.sa-card.wide{max-width:600px}
.sa-back{font-size:14px;color:rgba(255,255,255,.6);text-decoration:none}
.sa-center{text-align:center}
.sa-brand{font-size:18px;color:#f2c46d;margin:24px 0 0}
.sa-title{font-family:Georgia,"Times New Roman",serif;font-size:30px;line-height:1.2;margin:12px 0 0;font-weight:600}
.sa-sub{font-size:14px;color:rgba(255,255,255,.65);margin:8px 0 0}
.sa-tabs{display:grid;grid-template-columns:1fr 1fr;margin-top:24px;padding:4px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(12,16,51,.6)}
.sa-tab{border:0;background:transparent;color:rgba(255,255,255,.7);padding:8px 12px;border-radius:8px;font-weight:500;font-size:14px;cursor:pointer}
.sa-tab.on{background:#f2c46d;color:#2a1d03}
.sa-form{margin-top:24px;display:flex;flex-direction:column;gap:16px}
.sa-label{display:block;font-size:14px;color:rgba(255,255,255,.75);margin-bottom:6px}
.sa-input{width:100%;box-sizing:border-box;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(12,16,51,.7);color:#f4efe4;font-size:16px;font-family:inherit}
.sa-input:focus{outline:2px solid rgba(242,196,109,.5);border-color:#f2c46d}
.sa-input option{background:#141845;color:#f4efe4}
.sa-input:read-only{opacity:.6}
.sa-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px}
.sa-link{background:none;border:0;padding:0;color:rgba(255,255,255,.65);text-decoration:underline;cursor:pointer;font-size:inherit;font-family:inherit}
.sa-gold{color:#f2c46d}
.sa-btn{display:inline-block;box-sizing:border-box;width:100%;padding:12px 16px;border:0;border-radius:12px;background:#f2c46d;color:#2a1d03;font-weight:600;font-size:16px;text-align:center;text-decoration:none;cursor:pointer}
.sa-btn:disabled{opacity:.5}
.sa-btn.ghost{background:transparent;color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.2);width:auto;padding:12px 20px}
.sa-msg{margin:0;padding:12px 16px;border-radius:12px;font-size:14px;line-height:1.45;border:1px solid rgba(242,196,109,.3);background:rgba(242,196,109,.1)}
.sa-avatar{width:80px;height:80px;border-radius:50%;border:2px solid #f2c46d;background:#0c1033;color:#f2c46d;font-family:Georgia,serif;font-size:32px;display:flex;align-items:center;justify-content:center;margin:24px auto 0}
.sa-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;max-width:280px;margin:16px auto 0}
.sa-bar>div{height:100%;background:#f2c46d;border-radius:99px}
.sa-small{font-size:12px;color:rgba(255,255,255,.6);margin:6px 0 0}
.sa-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:560px){.sa-grid{grid-template-columns:1fr}}
.sa-list{margin:32px 0 0;padding:0;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(12,16,51,.5)}
.sa-item{display:flex;justify-content:space-between;gap:16px;padding:14px 20px;font-size:14px;border-top:1px solid rgba(255,255,255,.1)}
.sa-item:first-child{border-top:0}
.sa-item dt{color:rgba(255,255,255,.6)}
.sa-item dd{margin:0;text-align:right}
.sa-dim{color:rgba(255,255,255,.4)}
.sa-actions{display:flex;gap:12px}
.sa-foot{margin-top:24px;text-align:center}
.sa-menu{position:relative;z-index:50}
.sa-fixed{position:fixed;top:16px;right:16px}
.sa-pill{display:flex;align-items:center;gap:8px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:#141845;padding:4px 12px 4px 4px;color:#fff;font-size:14px;cursor:pointer}
.sa-dot{width:32px;height:32px;border-radius:50%;background:#f2c46d;color:#2a1d03;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-pop{position:absolute;right:0;top:calc(100% + 8px);width:320px;max-width:calc(100vw - 32px);box-sizing:border-box;border-radius:16px;border:1px solid rgba(255,255,255,.2);background:#141845;padding:20px;color:#fff;box-shadow:0 20px 50px rgba(0,0,0,.5);text-align:left}
.sa-pop .sa-item{padding:8px 0;border-top:0}
`;

export function SaStyles() {
  return <style>{css}</style>;
}

export default function CosmicBackdrop({ children }: { children: ReactNode }) {
  return (
    <main className="sa-stage">
      <SaStyles />
      <svg className="sa-orbits" aria-hidden="true" width="900" height="900" viewBox="0 0 900 900" fill="none">
        <circle cx="450" cy="450" r="440" stroke="#f2c46d" strokeOpacity=".14" />
        <circle cx="450" cy="450" r="330" stroke="#8b7cf6" strokeOpacity=".2" />
        <circle cx="450" cy="450" r="220" stroke="#f2c46d" strokeOpacity=".1" />
        <circle cx="450" cy="10" r="4" fill="#f2c46d" />
        <circle cx="120" cy="450" r="3" fill="#c9c2ff" />
        <circle cx="683" cy="683" r="2.5" fill="#f2c46d" fillOpacity=".7" />
      </svg>
      <div className="sa-inner">{children}</div>
    </main>
  );
}

