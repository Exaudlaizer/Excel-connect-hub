"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; hint?: string };

export function PasswordInput({ label, hint, id, className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id || props.name;
  return (
    <label className="auth-label" htmlFor={inputId}>
      <span>{label}</span>
      <span className="auth-password-wrap">
        <input id={inputId} type={visible ? "text" : "password"} className={`auth-input pr-12 ${className}`} {...props} />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          className="auth-icon-button focus-ring-dark"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {hint && <span className="auth-field-hint">{hint}</span>}
    </label>
  );
}
