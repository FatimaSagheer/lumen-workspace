export default function Logo({
  size = 40,
  showText = true,
}: {
  size?: number;
  showText?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label="Lumen logo">
        <rect width="72" height="72" rx="18" fill="#4F46E5" />
        <path d="M22 16h20l10 10v28a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z" fill="#FFFFFF" />
        <path d="M42 16v10h10z" fill="#C7D2FE" />
        <rect x="25" y="32" width="18" height="3" rx="1.5" fill="#C7D2FE" />
        <rect x="25" y="39" width="12" height="3" rx="1.5" fill="#C7D2FE" />
        <path d="M50 38l2.6 6.4L59 47l-6.4 2.6L50 56l-2.6-6.4L41 47l6.4-2.6z" fill="#FBBF24" />
      </svg>
      {showText && (
        <span className="text-xl font-bold tracking-tight text-[#14142B]">Lumen</span>
      )}
    </div>
  );
}