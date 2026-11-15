// The Mnemoq mark (the twisted ribbon) and wordmark, drawn in SVG so it stays
// sharp and readable on light and dark backgrounds.

export function MnemoqMark({ size = 32, title }) {
  return (
    <svg
      className="mq-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <linearGradient id="mq-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c4ff" />
          <stop offset=".45" stopColor="#3b5bff" />
          <stop offset="1" stopColor="#b03cff" />
        </linearGradient>
      </defs>
      <path
        d="M10.5 13.2c0-2.3 2.5-3.7 4.5-2.5L24 16.5l9-5.8c2-1.2 4.5.2 4.5 2.5v21.6c0 2.3-2.5 3.7-4.5 2.5L24 31.5l-9 5.8c-2 1.2-4.5-.2-4.5-2.5z"
        fill="url(#mq-mark-g)"
      />
      <path
        d="M24 16.5 33 10.7c2-1.2 4.5.2 4.5 2.5v4.6c-6 2.8-9.6 6.4-13.5 13.7L15 37.3c-2 1.2-4.5-.2-4.5-2.5v-2.2c6.6-4 9.6-9.4 13.5-16.1z"
        fill="#fff"
        fillOpacity=".16"
      />
    </svg>
  );
}

export default function MnemoqLogo({ size = 32, showWordmark = true, href }) {
  const body = (
    <>
      <MnemoqMark size={size} title={showWordmark ? undefined : 'Mnemoq'} />
      {showWordmark && <span className="mq-wordmark">mnemoq</span>}
    </>
  );

  return href ? (
    <a className="mq-logo" href={href} style={{ '--logo-size': `${size}px` }}>
      {body}
    </a>
  ) : (
    <div className="mq-logo" style={{ '--logo-size': `${size}px` }}>
      {body}
    </div>
  );
}
