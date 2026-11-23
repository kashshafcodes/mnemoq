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

export function HomeIcon() {
  return (
    <Icon>
      <path d="M4 11.2 12 4l8 7.2" />
      <path d="M6 9.8V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.8" />
    </Icon>
  );
}

export function AddIcon() {
  return (
    <Icon>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Icon>
  );
}

export function PathIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" />
    </Icon>
  );
}

export function ProIcon() {
  return (
    <Icon>
      <path d="M12 3.5l2.4 5.2 5.6.7-4.1 3.9 1.1 5.6L12 16.1 7 18.9l1.1-5.6L4 9.4l5.6-.7z" />
    </Icon>
  );
}

export function ProfileIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </Icon>
  );
}

export function StatsIcon() {
  return (
    <Icon>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M21 20H3" />
    </Icon>
  );
}

export function PracticeIcon() {
  return (
    <Icon>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
      <path d="M7 8h1.5M7 11h1.5M16 8h1.5M16 11h1.5" />
    </Icon>
  );
}

// The Daily puzzle: a small spark (the mascot is a firefly).
export function DailyIcon() {
  return (
    <Icon>
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
      <circle cx="12" cy="12" r="2.6" />
    </Icon>
  );
}
