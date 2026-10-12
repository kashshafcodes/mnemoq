
export default function MnemoqLogo({
  size = 40,
  showWordmark = true,
  dark = false,
}) {
  return (
    <div
      className={`mnemoq-brand ${dark ? "mnemoq-brand-dark" : ""}`}
      style={{ "--logo-size": `${size}px` }}
    >
      <img
        className="mnemoq-mark"
        src="/mnemoq-logo.png"
        alt="Mnemoq"
        style={{
  width: `${size * 4}px`,
  height: `${size * 2.8}px`,
  objectFit: "contain",
  flexShrink: 0,
}}
      />

      
    </div>
  );
}
