import { Gamepad2 } from "lucide-react";
import styles from "./GameCoverPlaceholder.module.css";

type GameCoverPlaceholderProps = {
  title: string;
  compact?: boolean;
};

export function GameCoverPlaceholder({ title, compact = false }: GameCoverPlaceholderProps) {
  return (
    <div className={`${styles.placeholder} ${compact ? styles.compact : ""}`}>
      <div className={styles.mark}>
        <Gamepad2 size={compact ? 24 : 34} />
        <strong>{getInitials(title)}</strong>
      </div>
    </div>
  );
}

function getInitials(title: string) {
  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase("tr-TR"))
    .join("");

  return initials || "BG";
}
