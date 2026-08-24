/**
 * Excel Connect Hub mark.
 */
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/excel-smARTIC-logo.jpeg"
      alt="Excel Connect Hub"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-xl object-cover ${className}`}
    />
  );
}
