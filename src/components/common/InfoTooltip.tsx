import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import styles from "./InfoTooltip.module.css";

type InfoTooltipProps = {
  text: string;
  label?: string;
};

type TooltipPosition = {
  top: number;
  left: number;
};

export function InfoTooltip({ text, label = "Bilgi" }: InfoTooltipProps) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const openTooltip = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 32);
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 16), window.innerWidth - width - 16);
    const preferredTop = rect.bottom + 10;
    const top = preferredTop + 120 > window.innerHeight ? Math.max(rect.top - 130, 16) : preferredTop;
    setPosition({ top, left });
  }, []);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        onMouseEnter={(event) => openTooltip(event.currentTarget)}
        onFocus={(event) => openTooltip(event.currentTarget)}
        onClick={(event) => {
          if (position) {
            setPosition(null);
          } else {
            openTooltip(event.currentTarget);
          }
        }}
        onMouseLeave={() => setPosition(null)}
        onBlur={() => setPosition(null)}
      >
        <Info size={16} />
      </button>
      {position
        ? createPortal(
            <div className={styles.tooltip} style={{ top: position.top, left: position.left }}>
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
