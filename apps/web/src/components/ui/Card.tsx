import React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return <section className="card">{children}</section>;
}
export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>;
}
export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>;
}
export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="card-footer">{children}</div>;
}
