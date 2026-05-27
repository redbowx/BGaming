type TurkishFlagIconProps = {
  className?: string;
};

export function TurkishFlagIcon({ className }: TurkishFlagIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Türk bayrağı"
      focusable="false"
    >
      <circle cx="16" cy="16" r="15" fill="#e30a17" />
      <circle cx="13.5" cy="16" r="7.2" fill="#ffffff" />
      <circle cx="16.2" cy="16" r="5.8" fill="#e30a17" />
      <path
        fill="#ffffff"
        d="m22.95 11.95 1.05 2.15 2.38.35-1.72 1.68.41 2.37-2.12-1.12-2.12 1.12.41-2.37-1.72-1.68 2.38-.35 1.05-2.15Z"
      />
    </svg>
  );
}
