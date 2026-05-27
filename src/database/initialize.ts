import { seedDevelopmentData } from "./seed";
import { ensureDatabaseReady } from "./ready";

export async function initializeDatabase() {
  await ensureDatabaseReady();
  await seedDevelopmentData();
}
