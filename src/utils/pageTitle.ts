import { appConfig } from "../app/config";

export function formatPageTitle(title: string) {
  return `${title} | ${appConfig.name}`;
}
