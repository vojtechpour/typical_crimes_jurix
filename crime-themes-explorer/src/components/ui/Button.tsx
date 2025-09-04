import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  className?: string;
};

export default function Button({
  variant = "subtle",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={`btn ${variant} ${className}`.trim()} {...props} />;
}
