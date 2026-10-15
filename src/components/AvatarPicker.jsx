import React, { useState } from 'react';
import { AVATAR_CLUBS, avatarCategory, clubAvatar } from '../lib/avatarCatalog.js';

const categories = [['club', 'Personaje y camiseta'], ['ropa-variada', 'Ropa variada'], ['poses', 'Poses'], ['legacy', 'Anteriores']];
export default function AvatarPicker({ avatars, value, onChange }) {
  const selected = avatars.find(a => a.id === value);
  const [category, setCategory] = useState(() => avatarCategory(selected));
  const [limit, setLimit] = useState(20);
  const character = selected?.character || 1;
  const club = selected?.club || 'boca';
  const choices = category === 'club'
    ? avatars.filter(a => a.group === 'club' && a.club === club)
    : avatars.filter(a => avatarCategory(a) === category);
  function chooseCategory(next) { setCategory(next); setLimit(20); }
  function chooseClub(next) {
    const avatar = clubAvatar(avatars, character, next);
    if (avatar) onChange(avatar.id);
  }
  return <fieldset className="avatar-picker">
    <legend>Elegí tu avatar</legend>
    <div className="avatar-categories" aria-label="Categorías de avatares">
      {categories.map(([id, label]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => chooseCategory(id)}>{label}</button>)}
    </div>
    {category === 'club' && <p className="club-muted">1. Elegí tu personaje. 2. Elegí la camiseta.</p>}
    <div className="club-avatars" aria-label={category === 'club' ? 'Personajes' : 'Avatares'}>
      {choices.slice(0, limit).map(a => <button key={a.id} type="button"
        aria-label={category === 'club' ? `Personaje ${a.character}` : a.label || `Avatar ${a.id}`}
        aria-pressed={value === a.id} onClick={() => onChange(a.id)}>
        <img src={a.url} alt="" loading="lazy" decoding="async" width="96" height="96"/>
        {category === 'club' && <span>{a.character}</span>}
      </button>)}
    </div>
    {choices.length > limit && <button className="club-secondary avatar-more" type="button" onClick={() => setLimit(n => n + 20)}>Ver 20 más</button>}
    {category === 'club' && <div className="avatar-shirts" aria-label="Camisetas">
      {AVATAR_CLUBS.map(team => {
        const a = clubAvatar(avatars, character, team.id);
        return a && <button key={team.id} type="button" aria-label={`Camiseta ${team.label}`} aria-pressed={selected?.group === 'club' && club === team.id} onClick={() => chooseClub(team.id)}>
          <img src={a.url} alt="" loading="lazy" decoding="async" width="80" height="80"/><span>{team.label}</span>
        </button>;
      })}
    </div>}
    {['poses', 'ropa-variada'].includes(category) && <p className="club-muted">Estos avatares conservan el fondo negro de la plantilla.</p>}
    <p className="club-muted" aria-live="polite">{selected ? `Seleccionado: ${selected.label || selected.id}` : 'Elegí un avatar.'}</p>
  </fieldset>;
}
