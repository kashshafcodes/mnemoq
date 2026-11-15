// The original Mnemoq mark (public/mnemoq-mark.png, cut from mnemoq-logo.png)
// with the wordmark as text, so it reads on light and dark backgrounds.

export function MnemoqMark({ size = 32, title }) {
  return (
    <img
      className="mq-mark"
      src="/mnemoq-mark.png"
      width={Math.round(size * 1.5)}
      height={size}
      alt={title || ''}
      aria-hidden={title ? undefined : 'true'}
      draggable="false"
    />
  );
}

export default function MnemoqLogo({ size = 32, showWordmark = true, tagline = size >= 28, href }) {
  const body = (
    <>
      <MnemoqMark size={size} title={showWordmark ? undefined : 'Mnemoq'} />
      {showWordmark && (
        <span className="mq-wordmark">
          Mnemoq
          {tagline && <small>Remember better</small>}
        </span>
      )}
    </>
  );

  return href ? (
    <a className="mq-logo" href={href} style={{ '--logo-size': `${size}px` }} aria-label="Mnemoq home">
      {body}
    </a>
  ) : (
    <div className="mq-logo" style={{ '--logo-size': `${size}px` }}>
      {body}
    </div>
  );
}
