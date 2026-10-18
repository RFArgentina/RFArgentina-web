import React from "react";

export function Card({ children, className = "" }) {
  return (
    <div className={`border rounded-lg shadow p-4 bg-white ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }) {
  return <div className="font-bold mb-2">{children}</div>;
}

export function CardContent({ children }) {
  return <div>{children}</div>;
}

export function CardDescription({ children, className = "" }) {
  return <p className={`text-gray-500 ${className}`}>{children}</p>;
}

export function CardTitle({ children, className = "" }) {
  return <h2 className={`text-xl ${className}`}>{children}</h2>;
}
