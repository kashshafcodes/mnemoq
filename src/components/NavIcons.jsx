// Small line icons for the sidebar. They take their colour from the text
// (currentColor), so hover and active styles recolour them automatically.

function Icon({ children }) {
  return (
    <svg
      className="nav-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function DashboardIcon() {
  return (
    <Icon>
      <rect x="3.5" y="3.5" width="7" height="8.5" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.8" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.8" />
      <rect x="3.5" y="15" width="7" height="5.5" rx="1.8" />
    </Icon>
  );
}

export function LibraryIcon() {
  return (
    <Icon>
      <path d="M5 4.5h3.2a1.3 1.3 0 0 1 1.3 1.3v13.4a1.3 1.3 0 0 1-1.3 1.3H5a1.3 1.3 0 0 1-1.3-1.3V5.8A1.3 1.3 0 0 1 5 4.5Z" />
      <path d="M12.3 4.5h3.2a1.3 1.3 0 0 1 1.3 1.3v13.4a1.3 1.3 0 0 1-1.3 1.3h-3.2" />
      <path d="m18.4 6.2 2.4.9a1.2 1.2 0 0 1 .7 1.6l-4.3 11.2" />
    </Icon>
  );
}

export function ReviewIcon() {
  return (
    <Icon>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20.5 4v4.5H16" />
      <path d="m9.4 12.2 1.9 1.9 3.5-3.9" />
    </Icon>
  );
}

export function HelpIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.1-2.4 3.6" />
      <path d="M12 16.9h.01" />
    </Icon>
  );
}
