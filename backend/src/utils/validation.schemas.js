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
