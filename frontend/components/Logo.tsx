/**
 * Excel Connect Hub mark.
 *
 * A compact, code-native connection motif keeps the brand reliable even before
 * a future uploaded logo asset is available.
 */
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/excel-smARTIC-logo.jpeg"
      alt="Excel Smartic"
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-xl object-cover shadow-[0_8px_22px_rgba(0,0,0,.28)] ${className}`}
    />
  );
}
