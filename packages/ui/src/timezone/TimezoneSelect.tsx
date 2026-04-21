import { TIMEZONE_OPTIONS, formatTimezoneOptionLabel, getBrowserTimezoneOption } from "@wisdom/utils";
import { useEffect, useMemo, useRef } from "react";

interface TimezoneSelectProps {
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
}

export function TimezoneSelect({
  value,
  onChange,
  className,
  disabled = false,
  required = false,
  placeholder = "Select a timezone",
  name,
  id,
}: TimezoneSelectProps) {
  const autoSelectedRef = useRef(false);
  const detectedTimezone = useMemo(() => getBrowserTimezoneOption(), []);

  useEffect(() => {
    if (autoSelectedRef.current || value || disabled) {
      return;
    }
    if (detectedTimezone?.ianaName) {
      autoSelectedRef.current = true;
      onChange(detectedTimezone.ianaName);
    }
  }, [detectedTimezone?.ianaName, disabled, onChange, value]);

  return (
    <select
      id={id}
      name={name}
      value={value}
      required={required}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={[
        className,
        value ? "border-cyan-300/30 bg-cyan-400/[0.03]" : "",
      ].filter(Boolean).join(" ")}
    >
      <option value="">{placeholder}</option>
      {TIMEZONE_OPTIONS.map((option) => (
        <option key={option.ianaName} value={option.ianaName}>
          {option.ianaName === value ? "✓ " : ""}{formatTimezoneOptionLabel(option)}
        </option>
      ))}
    </select>
  );
}

export default TimezoneSelect;
