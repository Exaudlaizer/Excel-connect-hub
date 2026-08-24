export function MetricCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string | number;
  detail: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="card card-interactive p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {Icon && <Icon size={17} className="text-brand" aria-hidden />}
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm leading-5 text-muted">{detail}</p>
    </div>
  );
}
