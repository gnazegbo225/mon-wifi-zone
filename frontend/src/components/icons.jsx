// Icônes en trait (24×24). Elles prennent la couleur du texte (currentColor).
function Icon({ className = 'size-6', children }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function MailIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

export function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2" />
    </Icon>
  );
}

export function EyeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.6 5.6A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.5 7.2C3.9 8.9 2.5 12 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </Icon>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

export function AlertIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  );
}

export function HomeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5h4v5" />
    </Icon>
  );
}

export function TagIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.2 7.2a1 1 0 0 1 0 1.4l-8.1 8.1a1 1 0 0 1-1.4 0l-7.2-7.2a1 1 0 0 1-.3-.7Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </Icon>
  );
}

export function TicketIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V10a2 2 0 0 0 0 4v2.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V14a2 2 0 0 0 0-4Z" />
      <path d="M14.5 5.5v13" strokeDasharray="2 2.5" />
    </Icon>
  );
}

export function LogoutIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h9.5" />
    </Icon>
  );
}

export function MapPinIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function CoinsIcon(props) {
  return (
    <Icon {...props}>
      <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
      <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
      <path d="M9.5 16.4c.9 1 3 1.6 5 1.6 3 0 5.5-1.1 5.5-2.5v-4c0-1.2-1.8-2.2-4.3-2.4" />
      <path d="M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5" />
    </Icon>
  );
}

export function ChartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <rect x="5.5" y="11" width="3" height="6" rx="1" />
      <rect x="10.5" y="6" width="3" height="11" rx="1" />
      <rect x="15.5" y="9" width="3" height="8" rx="1" />
    </Icon>
  );
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function PencilIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  );
}

export function PowerIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v8" />
      <path d="M6.6 6.6a8 8 0 1 0 10.8 0" />
    </Icon>
  );
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function CloseIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function ChevronRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}
