import { z } from 'zod';
import { PAYMENT_TYPES } from './subscriptionPricing.js';

/* Un champ numérique laissé vide dans un formulaire arrive en « » : sans ce
   filtre, la coercition le transformerait en 0 au lieu de le laisser vide. */
const emptyToUndefined = (schema) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    schema.optional()
  );

export const PasswordSchema = z.string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
  .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
  .regex(/[\W_]/, 'Doit contenir au moins un caractère spécial');

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide').max(200, 'Email : 200 caractères maximum'),
  firstName: z.string().trim().min(1, 'Prénom requis').max(80, 'Prénom : 80 caractères maximum').regex(/^[\p{L}\p{M}\s'’-]+$/u, 'Prénom invalide'),
  lastName: z.string().trim().min(1, 'Nom requis').max(80, 'Nom : 80 caractères maximum').regex(/^[\p{L}\p{M}\s'’-]+$/u, 'Nom invalide'),
  phone: z.string().trim().regex(/^[0-9+\s.-]{6,20}$/, 'Téléphone invalide'),
  address: z.string().trim().min(1, 'Adresse requise').max(300, 'Adresse : 300 caractères maximum'),
});

export const ProducerSchema = z.object({
  name:        z.string().min(1, 'Nom requis').max(200, 'Nom : 200 caractères maximum'),
  description: z.string().min(1, 'Description requise').max(5000, 'Description : 5000 caractères maximum'),
  email:       z.string().email('Email invalide'),
  phone:       z.string().max(20).optional(),
  specialty:   z.string().max(200).optional(),
  image:       z.string().max(500).optional(),
  // Fiche de la ferme, affichée sur la page publique des producteurs.
  // Le formulaire admin envoie une chaîne vide pour un champ laissé de côté :
  // on la ramène à undefined avant de valider, sinon « » deviendrait 0.
  city:            z.string().max(120).optional().or(z.literal('')),
  postalCode:      z.string().regex(/^\d{5}$/, 'Code postal : 5 chiffres').optional().or(z.literal('')),
  distanceKm:      emptyToUndefined(z.coerce.number().int().min(0).max(300, 'Distance : 300 km maximum')),
  certification:   z.enum(['NONE', 'ORGANIC', 'CONVERSION']).optional(),
  farmDetailLabel: z.string().max(40, 'Libellé : 40 caractères maximum').optional().or(z.literal('')),
  farmDetail:      z.string().max(200, 'Détail : 200 caractères maximum').optional().or(z.literal('')),
  partnerSince:    emptyToUndefined(z.coerce.number().int().min(1900, 'Année invalide').max(2200, 'Année invalide')),
});

export const UpdateProducerSchema = ProducerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const ProductSchema = z.object({
  name:        z.string().min(1, 'Nom requis').max(200),
  producerId:  z.string().min(1, 'Producteur requis'),
  category:    z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  isExample:   z.boolean().optional(),
  isActive:    z.boolean().optional(),
  seasons:     z.array(z.enum(['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'])).min(1, 'Sélectionnez au moins une saison'),
  basketSizes: z.array(z.enum(['SMALL', 'LARGE'])).min(1, 'Sélectionnez au moins un format de panier'),
});

export const UpdateProductSchema = ProductSchema.partial();

export const SubscriptionRequestSchema = z.object({
  type:        z.enum(['ANNUAL', 'DISCOVERY'], { message: 'Type d\'abonnement invalide' }),
  basketSize:  z.enum(['SMALL', 'LARGE'], { message: 'Taille de panier invalide' }),
  pricingType: z.enum(['NORMAL', 'SOLIDARITY'], { message: 'Type de tarification invalide' }),
  paymentType: z.enum(PAYMENT_TYPES, { message: 'Modalité de paiement invalide' }),
  message:     z.string().max(1000, 'Message : 1000 caractères maximum').optional(),
});

export const BasketTypeSchema = z.object({
  name:        z.string().min(1, 'Nom requis').max(200),
  description: z.string().min(1, 'Description requise').max(2000),
  price:       z.coerce.number().positive('Le prix doit être supérieur à 0'),
  image:       z.string().max(500).optional(),
});

export const BlogPostSchema = z.object({
  title:       z.string().min(1, 'Titre requis').max(300),
  content:     z.string().min(1, 'Contenu requis'),
  slug:        z.string().max(300).optional(),
  excerpt:     z.string().max(500).optional(),
  image:       z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
});

export const ContactSchema = z.object({
  name:    z.string().min(1, 'Nom requis').max(100, 'Nom : 100 caractères maximum'),
  email:   z.string().email('Email invalide'),
  subject: z.string().min(1, 'Sujet requis').max(200, 'Sujet : 200 caractères maximum'),
  message: z.string().min(1, 'Message requis').max(5000, 'Message : 5000 caractères maximum'),
});

const texteRequis = (max, requis, libelle) =>
  z.string({ error: requis }).trim().min(1, requis).max(max, `${libelle} : ${max} caractères maximum`);

const texteFacultatif = (max, libelle) =>
  emptyToUndefined(z.string({ error: `${libelle} invalide` }).trim().max(max, `${libelle} : ${max} caractères maximum`));

export const ProducerInquirySchema = z.object({
  firstName:      texteRequis(100, 'Prénom requis', 'Prénom'),
  lastName:       texteRequis(100, 'Nom requis', 'Nom'),
  email:          z.string({ error: 'Email requis' }).trim().email('Email invalide').max(200, 'Email : 200 caractères maximum'),
  phone:          texteRequis(30, 'Téléphone requis', 'Téléphone').regex(/^[0-9\s.+()-]+$/, 'Téléphone invalide'),
  farmName:       texteRequis(200, 'Nom de l\'exploitation requis', 'Nom de l\'exploitation'),
  address:        texteRequis(255, 'Adresse requise', 'Adresse'),
  city:           texteRequis(100, 'Ville requise', 'Ville'),
  postalCode:     z.string({ error: 'Code postal requis' }).trim().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres requis).'),
  distance:       emptyToUndefined(z.coerce.number({ error: 'Distance invalide' }).int('Distance invalide').min(0, 'Distance invalide').max(300, 'Distance : 300 km maximum')),
  products:       texteRequis(2000, 'Types de produits requis', 'Produits'),
  isBio:          z.boolean({ error: 'Case « bio » invalide' }).default(false),
  certifications: texteFacultatif(500, 'Certifications'),
  message:        texteFacultatif(2000, 'Message'),
  availability:   texteFacultatif(500, 'Disponibilités'),
}, { error: 'Formulaire invalide' });

/* Un champ que l'admin vide doit pouvoir l'effacer : null passe jusqu'au
   contrôleur, au lieu d'être ramené à undefined comme dans texteFacultatif. */
const texteEffacable = (max, libelle) =>
  z.string({ error: `${libelle} invalide` }).trim().max(max, `${libelle} : ${max} caractères maximum`).nullable().optional();

const dateDuCalendrier = (requis) => z.union(
  [z.iso.date(), z.iso.datetime({ offset: true })],
  { error: (issue) => (issue.input === undefined || issue.input === '' ? requis : 'Date invalide') }
);

const heure = (libelle) =>
  z.string({ error: `${libelle} invalide` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${libelle} invalide (HH:MM)`);

const identifiant = (requis) =>
  z.string({ error: requis }).trim().min(1, requis).max(64, requis);

// L'équipe : les états qu'un admin pose à la main. Une proposition n'en fait pas partie.
export const VOLUNTEER_STATUSES = ['CONFIRMED', 'CANCELLED', 'ABSENT'];

const shiftFields = {
  startTime:        heure('Heure de début').optional(),
  endTime:          heure('Heure de fin').optional(),
  volunteersNeeded: z.number({ error: 'Nombre de bénévoles invalide' })
    .int('Nombre de bénévoles invalide').min(1, 'Entre 1 et 10 bénévoles').max(10, 'Entre 1 et 10 bénévoles').optional(),
  notes:            texteEffacable(2000, 'Notes'),
  volunteers:       z.array(z.object({
    userId: identifiant('Bénévole invalide'),
    role:   texteEffacable(100, 'Rôle'),
    status: z.enum(VOLUNTEER_STATUSES, { error: 'Statut de bénévole invalide' }).optional(),
  }), { error: 'Équipe invalide' }).max(50, 'Équipe : 50 bénévoles maximum').optional(),
};

export const ShiftSchema = z.object({
  distributionDate: dateDuCalendrier('Date de distribution requise'),
  ...shiftFields,
});

export const UpdateShiftSchema = z.object({
  distributionDate: dateDuCalendrier('Date de distribution requise').optional(),
  ...shiftFields,
});

export const WeeklyBasketSchema = z.object({
  distributionDate: dateDuCalendrier('Date de distribution requise'),
  notes:            texteEffacable(2000, 'Notes'),
});

export const UpdateWeeklyBasketSchema = WeeklyBasketSchema.partial();

export const NewsletterSchema = z.object({
  subject: texteRequis(200, 'Objet requis', 'Objet'),
  content: z.string({ error: 'Contenu requis' }).min(1, 'Contenu requis').max(100_000, 'Contenu : 100 000 caractères maximum'),
  type:    z.enum(['GENERAL', 'WEEKLY_BASKET', 'RECIPE', 'ALERT', 'PRODUCER_NEWS'], { error: 'Type de newsletter invalide' }).optional(),
  target:  z.enum(['ALL', 'ACTIVE_SUBSCRIBERS', 'SOLIDARITY', 'TEST'], { error: 'Destinataires invalides' }).optional(),
});

export const UpdateNewsletterSchema = NewsletterSchema.partial().extend({
  scheduledFor: z.string({ error: 'Date de programmation invalide' }).max(40, 'Date de programmation invalide').nullable().optional(),
});

export const ClosureSchema = z.object({
  startDate: dateDuCalendrier('Date de début requise'),
  endDate:   dateDuCalendrier('Date de fin requise'),
  reason:    texteEffacable(500, 'Motif'),
  notify:    z.boolean({ error: 'Choix d\'annonce invalide' }).optional(),
});

export const ProducerAbsenceSchema = z.object({
  producerId: identifiant('Ferme requise'),
  startDate:  dateDuCalendrier('Date de début requise'),
  endDate:    dateDuCalendrier('Date de fin requise'),
  reason:     texteEffacable(500, 'Motif'),
});

export const UpdateProducerAbsenceSchema = ProducerAbsenceSchema.omit({ producerId: true }).partial();

// ESPACE PRODUCTEUR — la clé hors de ces listes est refusée par le contrôleur.

const estUrlHttps = (valeur) => {
  try {
    return new URL(valeur).protocol === 'https:';
  } catch {
    return false;
  }
};

export const OwnFarmSchema = z.object({
  description:     texteRequis(5000, 'Description requise', 'Description').optional(),
  specialty:       texteEffacable(200, 'Spécialité'),
  farmDetailLabel: texteEffacable(40, 'Libellé'),
  farmDetail:      texteEffacable(200, 'Détail'),
  phone:           z.string({ error: 'Téléphone invalide' }).trim()
    .regex(/^([0-9+\s.-]{6,20})?$/, 'Téléphone invalide').nullable().optional(),
  image:           z.string({ error: 'Image invalide' }).trim()
    .max(500, 'Image : 500 caractères maximum')
    .refine((v) => v === '' || estUrlHttps(v), 'Image : adresse https:// requise')
    .nullable().optional(),
});

export const OwnProductSchema = z.object({
  name:        texteRequis(200, 'Nom requis', 'Nom'),
  category:    z.enum(['VEGETABLES', 'FRUITS', 'EGGS', 'GROCERY'], { error: 'Catégorie invalide' }).nullable().optional(),
  description: texteEffacable(1000, 'Description'),
  isActive:    z.boolean({ error: 'Case « actif » invalide' }).optional(),
  seasons:     ProductSchema.shape.seasons,
  basketSizes: ProductSchema.shape.basketSizes,
});

export const UpdateOwnProductSchema = OwnProductSchema.partial();

export const OwnAbsenceSchema = ProducerAbsenceSchema.omit({ producerId: true });

// Rien d'autre que la prétention : nom, prénom et email se lisent sur le compte.
export const ProducerAccessRequestSchema = z.object({
  farmClaim: texteRequis(500, 'Indiquez la ferme que vous représentez', 'Ferme'),
});

export const ApproveProducerAccessSchema = z.object({
  producerId: identifiant('Choisissez la fiche de la ferme'),
  adminNotes: texteFacultatif(2000, 'Notes'),
});

export const RejectProducerAccessSchema = z.object({
  adminNotes: texteFacultatif(2000, 'Notes'),
});
