// L'hébergeur tourne en UTC : l'année civile se lit à l'heure de Paris.
const anneeParis = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' });

export const parisYear = (date = new Date()) => Number(anneeParis.format(new Date(date)));
