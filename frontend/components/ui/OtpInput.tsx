"use client";

import { useEffect, useRef } from "react";

const LENGTH = 6;

/**
 * Six-box entry for a verification code.
 *
 * The behaviours people expect from one of these and notice when missing:
 * typing advances, backspace on an empty box steps back, arrow keys move,
 * and pasting the whole code from an email fills every box at once rather
 * than dropping five of the six digits into the first one.
 *
 * The value is a single string; the boxes are a presentation of it.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus = true,
  label = "Verification code"
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  function commit(next: string) {
    const cleaned = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange(cleaned);
    if (cleaned.length === LENGTH) onComplete?.(cleaned);
    return cleaned;
  }

  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;

    // Typing into a box replaces that position; a multi-character value means
    // the browser autofilled the whole code, so take all of it.
    const chars = value.split("");
    if (typed.length > 1) {
      commit(typed);
      inputs.current[Math.min(typed.length, LENGTH - 1)]?.focus();
      return;
    }

    chars[index] = typed;
    const next = commit(chars.join("").replace(/\s/g, ""));
    if (index < LENGTH - 1) inputs.current[index + 1]?.focus();
    else if (next.length === LENGTH) inputs.current[index]?.blur();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const chars = value.split("");

      if (chars[index]) {
        chars[index] = "";
        onChange(chars.join("").trimEnd());
      } else if (index > 0) {
        chars[index - 1] = "";
        onChange(chars.slice(0, index - 1).join(""));
        inputs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < LENGTH - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    const next = commit(pasted);
    inputs.current[Math.min(next.length, LENGTH - 1)]?.focus();
  }

  return (
    <div>
      <span className="field-label" id="otp-label">
        {label}
      </span>
      <div className="flex gap-2" role="group" aria-labelledby="otp-label">
        {Array.from({ length: LENGTH }).map((_, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            type="text"
            // "numeric" rather than type=number: it brings up the digit keypad
            // on a phone without the spinner and scroll-to-change of a number
            // field.
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={LENGTH}
            value={digits[index].trim()}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            aria-invalid={invalid || undefined}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            className={`field h-14 flex-1 px-0 text-center font-mono-ui text-xl font-bold tracking-normal ${
              invalid ? "border-danger" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}
