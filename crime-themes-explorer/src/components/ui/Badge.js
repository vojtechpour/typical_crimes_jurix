export default function Badge({ tone = "", children, className = "" }) {
  return (
    <span className={`badge ${tone} ${className}`.trim()}>{children}</span>
  );
}
