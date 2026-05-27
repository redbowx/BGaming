import styles from "./PlaceholderPanel.module.css";

type PlaceholderPanelProps = {
  title: string;
  description: string;
};

export function PlaceholderPanel({ title, description }: PlaceholderPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.marker} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
