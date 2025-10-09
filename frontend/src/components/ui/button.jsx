import React from "react";

export function Button({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
    >
      {children}
    </button>
  );
}