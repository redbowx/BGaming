import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CustomSelect.module.css";

export type CustomSelectOption<Value extends string = string> = {
  label: string;
  value: Value;
};

type CustomSelectProps<Value extends string = string> = {
  id?: string;
  label?: string;
  value: Value;
  options: Array<CustomSelectOption<Value>>;
  onChange: (value: Value) => void;
  className?: string;
  ariaLabel?: string;
};

export function CustomSelect<Value extends string = string>({
  id,
  label,
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: CustomSelectProps<Value>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={[styles.selectWrap, className].filter(Boolean).join(" ")}>
      {label ? (
        <span id={id ? `${id}-label` : undefined} className={styles.label}>
          {label}
        </span>
      ) : null}
      <button
        id={id}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={label && id ? `${id}-label ${id}` : undefined}
        aria-label={!label ? ariaLabel : undefined}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? "Seç"}</span>
        <ChevronDown size={18} />
      </button>

      {isOpen ? (
        <div className={styles.list} role="listbox" aria-labelledby={label && id ? `${id}-label` : undefined}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? `${styles.option} ${styles.activeOption}` : styles.option}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
