export default function Button({
  variant = "subtle",
  className = "",
  ...props
}) {
  return <button className={`btn ${variant} ${className}`} {...props} />;
}
