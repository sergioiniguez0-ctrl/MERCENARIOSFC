export const AVATAR_CLUBS = [
  { id: 'boca', label: 'Boca' },
  { id: 'river', label: 'River' },
  { id: 'racing', label: 'Racing' },
  { id: 'san-lorenzo', label: 'San Lorenzo' },
  { id: 'independiente', label: 'Independiente' },
];
const number = n => String(n).padStart(2, '0');
export const CUSTOM_AVATARS = [
  ...AVATAR_CLUBS.flatMap(club => Array.from({ length: 20 }, (_, i) => ({
    id: `${club.id}-${number(i + 1)}`, group: 'club', club: club.id,
    character: i + 1, label: `Personaje ${i + 1} · ${club.label}`,
    path: `${club.id}/${club.id}-${number(i + 1)}.webp`,
  }))),
  ...[{ id: 'poses', count: 17, label: 'Pose' }, { id: 'ropa-variada', count: 18, label: 'Ropa variada' }].flatMap(group =>
    Array.from({ length: group.count }, (_, i) => ({
      id: `${group.id}-${number(i + 1)}`, group: group.id,
      label: `${group.label} ${i + 1}`, path: `${group.id}/${group.id}-${number(i + 1)}.webp`,
    }))),
];
export const LEGACY_AVATAR_IDS = [
  ...Array.from({ length: 15 }, (_, i) => `avatar_${number(i + 1)}`),
  ...Array.from({ length: 48 }, (_, i) => `potrero_${number(i + 1)}`),
];
export const AVATAR_IDS = [...LEGACY_AVATAR_IDS, ...CUSTOM_AVATARS.map(a => a.id)];
export function avatarCategory(avatar) { return avatar?.group || 'legacy'; }
export function clubAvatar(avatars, character, club) {
  return avatars.find(a => a.group === 'club' && a.character === character && a.club === club);
}
