import { z } from 'zod';

export const ProducerSchema = z.object({
  name:        z.string().min(1, 'Nom requis').max(200, 'Nom : 200 caractères maximum'),
  description: z.string().min(1, 'Description requise').max(5000, 'Description : 5000 caractères maximum'),
  email:       z.string().email('Email invalide'),
  phone:       z.string().max(20).optional(),
  specialty:   z.string().max(200).optional(),
  image:       z.string().max(500).optional(),
});

export const ProductSchema = z.object({
  name:        z.string().min(1, 'Nom requis').max(200),
  producerId:  z.string().min(1, 'Producteur requis'),
  category:    z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  isExample:   z.boolean().optional(),
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
