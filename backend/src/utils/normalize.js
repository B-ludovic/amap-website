// Normalise un prénom : première lettre en majuscule, reste en minuscule.

const normalizeFirstName = (str) => {
  if (!str) return str;
  const s = str.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Normalise un nom de famille : tout en majuscules.

const normalizeLastName = (str) => {
  if (!str) return str;
  return str.trim().toUpperCase();
};

// Normalise un texte en title case : première lettre de chaque mot en majuscule.
// Ex: "la ferme des petits pois" → "La Ferme Des Petits Pois"
// Ex: "11 rue de la paix" → "11 Rue De La Paix"

const normalizeTitleCase = (str) => {
  if (!str) return str;
  return str
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export { normalizeFirstName, normalizeLastName, normalizeTitleCase };
