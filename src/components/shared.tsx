import { Bus, Heartbeat, Leaf, ShieldCheck, Waves } from "@phosphor-icons/react";
import { DISTRICTS, type CategoryId, type DistrictId } from "@/lib/data";
const ICONS = {
  transport: Bus,
  ecology: Leaf,
  social: Heartbeat,
  safety: ShieldCheck,
  services: Waves,
};
export const districtName = (id?: DistrictId) =>
  DISTRICTS.find((d) => d.id === id)?.name ?? "Весь город";

export function CategoryIcon({ id, size = 20 }: { id: CategoryId; size?: number }) {
  const Icon = ICONS[id];
  return <Icon size={size} weight="regular" aria-hidden="true" />;
}
