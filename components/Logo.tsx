import Image from "next/image";
import Link from "next/link";

// The StudAstra mark, always rendered as a glowing circle.
// Source image: public/logo.png (512px, transparent corners).
const css = `
.sa-logo{display:inline-flex;align-items:center;gap:10px;color:inherit;text-decoration:none;flex-shrink:0}
.sa-logo-img{display:block;border-radius:50%;object-fit:cover;background:#0b0f22;box-shadow:0 0 0 1px rgba(184,185,214,.22),0 0 14px rgba(101,70,215,.45),0 0 28px rgba(69,184,255,.18);transition:box-shadow .3s ease,transform .3s ease}
.sa-logo:hover .sa-logo-img{box-shadow:0 0 0 1px rgba(245,199,106,.45),0 0 18px rgba(101,70,215,.6),0 0 36px rgba(69,184,255,.28);transform:scale(1.03)}
.sa-logo-text{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;letter-spacing:-.3px;line-height:1.1}
.sa-logo-text small{display:block;font-size:.55em;font-weight:500;letter-spacing:1.6px;color:#B8B9D6;text-transform:uppercase}
@media (prefers-reduced-motion: reduce){.sa-logo-img{transition:none}.sa-logo:hover .sa-logo-img{transform:none}}
`;

type LogoProps = {
  /** Diameter in pixels. */
  size?: number;
  /** Text shown beside the mark ("StudAstra" by default). Pass null to show the mark alone. */
  label?: string | null;
  /** Small caption under the label, e.g. "Admin". */
  caption?: string;
  /** Wrap in a link. Pass null for no link. */
  href?: string | null;
  className?: string;
  priority?: boolean;
  textSize?: number;
};

export default function Logo({
  size = 40, label = "StudAstra", caption, href = "/", className = "", priority = false, textSize,
}: LogoProps) {
  const body = (
    <>
      <style>{css}</style>
      <Image
        src="/logo.png"
        alt="StudAstra logo"
        width={size}
        height={size}
        priority={priority}
        className="sa-logo-img"
        style={{ width: size, height: size }}
      />
      {label && (
        <span className="sa-logo-text" style={{ fontSize: textSize ?? Math.max(14, Math.round(size * 0.48)) }}>
          {label}
          {caption && <small>{caption}</small>}
        </span>
      )}
    </>
  );
  if (href === null) return <span className={`sa-logo ${className}`}>{body}</span>;
  return <Link href={href} className={`sa-logo ${className}`} aria-label="StudAstra home">{body}</Link>;
}
