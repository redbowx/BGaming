import type { ComponentType } from "react";

export type PageId =
  | "home"
  | "games"
  | "favorites"
  | "stats"
  | "health"
  | "settings";

export type PageDefinition = {
  id: PageId;
  label: string;
  component: ComponentType;
};
