"use client";

import type { ReactNode } from "react";

/** A submit button that asks first ("Delete passport.pdf?"); cancelling sends nothing. */
export function ConfirmSubmit({ message, className, label, children }: { message: string; className?: string; label?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      aria-label={label}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
