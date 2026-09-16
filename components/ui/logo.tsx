export function FplLabLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 110 32"
      fill="none"
      className={className}
      aria-label="FPL Lab"
    >
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#0B132B" />
      <path d="M9 9H23V12H13V15H21V18H13V23H9V9Z" fill="#38BDF8" />
      <circle cx="23" cy="21" r="2.5" fill="#10B981" />
      <text
        x="36"
        y="22"
        fontFamily="Inter, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="17"
        fill="#0F172A"
        letterSpacing="-0.02em"
      >
        FPL
        <tspan fill="#2563EB">LAB</tspan>
      </text>
    </svg>
  );
}
