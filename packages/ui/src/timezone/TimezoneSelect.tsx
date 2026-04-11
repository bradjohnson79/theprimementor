import { TIMEZONE_OPTIONS } from "@wisdom/utils";

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
  return (
    <select
      id={id}
      name={name}
      value={value}
      required={required}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="">{placeholder}</option>
      {TIMEZONE_OPTIONS.map((option) => (
        <option key={option.ianaName} value={option.ianaName}>
          {option.ianaName} - {option.label}
        </option>
      ))}
    </select>
  );
}

export default TimezoneSelect;
