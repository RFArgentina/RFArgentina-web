import React from "react";

export function Card({ children }) {
  return (
    <div className="border rounded-lg shadow p-4 bg-white">
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

export function CardDescription({ children }) {
  return <p className="text-gray-500">{children}</p>;
}

export function CardTitle({ children }) {
  return <h2 className="text-xl">{children}</h2>;
}