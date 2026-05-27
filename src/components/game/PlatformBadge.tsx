import { Monitor } from "lucide-react";
import type { Platform } from "../../types/game";
import { getPlatformLogo } from "../../utils/platformLogo";
import styles from "./PlatformBadge.module.css";

type PlatformBadgeProps = {
  name: string;
  platform?: Platform;
};

export function PlatformBadge({ name, platform }: PlatformBadgeProps) {
  const logoSource = platform?.logoPath ?? getPlatformLogo(name);

  return (
    <span className={styles.badge}>
      {logoSource ? <img src={logoSource} alt="" className={styles.logo} /> : <Monitor size={17} />}
      <span>{name}</span>
    </span>
  );
}
