// Daily automatic SwanDesk backup (keeps the newest 60).
import { makeBackup, listBackups, backups } from "../lib/core.mjs";
export default async () => {
  const r = await makeBackup("daily");
  const all = await listBackups();
  for (const k of all.slice(60)) await backups().delete(k);
  console.log("SwanDesk backup", r.key, r.count, "records, verified:", r.verified);
};
export const config = { schedule: "@daily" };
