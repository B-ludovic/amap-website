import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  httpStatusCodes
} from '../utils/httpErrors.js';
import { ProducerSchema, ProductSchema, BasketTypeSchema, BlogPostSchema } from '../utils/validation.schemas.js';
import { logAudit } from '../services/audit.service.js';
import { normalizeTitleCase } from '../utils/normalize.js';


// GESTION DES PRODUCTEURS //


// CRÉER UN PRODUCTEUR 
const createProducer = asyncHandler(async (req, res) => {
  const parsed = ProducerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpBadRequestError(parsed.error.errors[0].message);
  }
  const { name, description, email, phone, specialty, image } = parsed.data;

  // Vérifier que l'email n'existe pas déjà
  const existingProducer = await prisma.producer.findUnique({
    where: { email }
  });

  if (existingProducer) {
    throw new HttpConflictError('Cet email est déjà utilisé');
  }

  const producer = await prisma.producer.create({
    data: {
      name: normalizeTitleCase(name),
      description,
      email,
      phone,
      specialty,
      image
    }
  });

  await logAudit(req, 'CREATE_PRODUCER', 'IMPORTANT', { type: 'PRODUCER', id: producer.id, label: producer.name });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Producteur créé avec succès',
    data: { producer }
  });
});

// MODIFIER UN PRODUCTEUR 
const updateProducer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, email, phone, specialty, image, isActive } = req.body;

  const producer = await prisma.producer.findUnique({
    where: { id }
  });

  if (!producer) {
    throw new HttpNotFoundError('Producteur introuvable');
  }

  // Si l'email change, vérifier qu'il n'est pas déjà utilisé
  if (email && email !== producer.email) {
    const existingProducer = await prisma.producer.findUnique({
      where: { email }
    });

    if (existingProducer) {
      throw new HttpConflictError('Cet email est déjà utilisé');
    }
  }

  const updatedProducer = await prisma.producer.update({
    where: { id },
    data: {
      name: name ? normalizeTitleCase(name) : undefined,
      description,
      email,
      phone,
      specialty,
      image,
      isActive
    }
  });

  res.json({
    success: true,
    message: 'Producteur modifié avec succès',
    data: { producer: updatedProducer }
  });
});

// SUPPRIMER UN PRODUCTEUR 
const deleteProducer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const producer = await prisma.producer.findUnique({
    where: { id },
    include: {
      products: true
    }
  });

  if (!producer) {
    throw new HttpNotFoundError('Producteur introuvable');
  }

  // Vérifier si le producteur a des produits
  if (producer.products.length > 0) {
    throw new HttpConflictError(
      'Impossible de supprimer ce producteur car il a des produits associés. ' +
      'Veuillez d\'abord supprimer ou réassigner ses produits.'
    );
  }

  await prisma.producer.delete({
    where: { id }
  });

  await logAudit(req, 'DELETE_PRODUCER', 'IMPORTANT', { type: 'PRODUCER', id, label: producer.name });

  res.json({
    success: true,
    message: 'Producteur supprimé avec succès'
  });
});

// RÉCUPÉRER TOUS LES PRODUCTEURS
const getAllProducers = asyncHandler(async (req, res) => {
  const producers = await prisma.producer.findMany({
    orderBy: {
      name: 'asc'
    },
    include: {
      _count: {
        select: { products: true }
      }
    }
  });

  res.json({
    success: true,
    data: producers
  });
});

// GESTION DES PRODUITS //

// CRÉER UN PRODUIT
const createProduct = asyncHandler(async (req, res) => {
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpBadRequestError(parsed.error.errors[0].message);
  }
  const { name: rawName, producerId, category, description, isExample } = parsed.data;
  const name = rawName.trim().charAt(0).toUpperCase() + rawName.trim().slice(1);

  const producer = await prisma.producer.findUnique({
    where: { id: producerId }
  });

  if (!producer) {
    throw new HttpNotFoundError('Producteur introuvable');
  }

  const existing = await prisma.product.findFirst({
    where: { name, producerId }
  });
  if (existing) {
    throw new HttpBadRequestError(`"${name}" existe déjà pour ce producteur`);
  }

  const product = await prisma.product.create({
    data: {
      name,
      producerId,
      category,
      description,
      isExample: isExample || false
    },
    include: {
      producer: true
    }
  });

  await logAudit(req, 'CREATE_PRODUCT', 'IMPORTANT', { type: 'PRODUCT', id: product.id, label: product.name });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Produit créé avec succès',
    data: { product }
  });
});

// MODIFIER UN PRODUIT
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name: rawName, producerId, category, description, isExample } = req.body;
  const name = rawName ? rawName.trim().charAt(0).toUpperCase() + rawName.trim().slice(1) : undefined;

  const product = await prisma.product.findUnique({
    where: { id }
  });

  if (!product) {
    throw new HttpNotFoundError('Produit introuvable');
  }

  if (producerId) {
    const producer = await prisma.producer.findUnique({
      where: { id: producerId }
    });

    if (!producer) {
      throw new HttpNotFoundError('Producteur introuvable');
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      name,
      producerId,
      category,
      description,
      isExample
    },
    include: {
      producer: true
    }
  });

  res.json({
    success: true,
    message: 'Produit modifié avec succès',
    data: { product: updatedProduct }
  });
});

// SUPPRIMER UN PRODUIT
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      basketTypes: true
    }
  });

  if (!product) {
    throw new HttpNotFoundError('Produit introuvable');
  }

  if (product.basketTypes.length > 0) {
    throw new HttpConflictError(
      'Impossible de supprimer ce produit car il est utilisé dans des paniers. ' +
      'Veuillez d\'abord le retirer des paniers.'
    );
  }

  await prisma.product.delete({
    where: { id }
  });

  await logAudit(req, 'DELETE_PRODUCT', 'IMPORTANT', { type: 'PRODUCT', id, label: product.name });

  res.json({
    success: true,
    message: 'Produit supprimé avec succès'
  });
});

// RÉCUPÉRER TOUS LES PRODUITS
const getAllProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    orderBy: {
      name: 'asc'
    },
    include: {
      producer: true
    }
  });

  res.json({
    success: true,
    data: products
  });
});

// CRÉER UN TYPE DE PANIER 
const createBasketType = asyncHandler(async (req, res) => {
  const parsed = BasketTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpBadRequestError(parsed.error.errors[0].message);
  }
  const { name, description, price, image } = parsed.data;
  const { products } = req.body;

  // Créer le panier avec ses produits
  const basketType = await prisma.basketType.create({
    data: {
      name,
      description,
      price,
      image,
      products: {
        create: products?.map(p => ({
          productId: p.productId,
          quantity: p.quantity
        })) || []
      }
    },
    include: {
      products: {
        include: {
          product: {
            include: {
              producer: true
            }
          }
        }
      }
    }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Type de panier créé avec succès',
    data: { basketType }
  });
});

// MODIFIER UN TYPE DE PANIER 
const updateBasketType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, price, image, isActive, products } = req.body;

  const basketType = await prisma.basketType.findUnique({
    where: { id }
  });

  if (!basketType) {
    throw new HttpNotFoundError('Type de panier introuvable');
  }

  if (price && price <= 0) {
    throw new HttpBadRequestError('Le prix doit être supérieur à 0');
  }

  // Si on met à jour les produits, on supprime les anciens et on recrée
  if (products) {
    await prisma.basketTypeProduct.deleteMany({
      where: { basketTypeId: id }
    });
  }

  const updatedBasketType = await prisma.basketType.update({
    where: { id },
    data: {
      name,
      description,
      price,
      image,
      isActive,
      ...(products && {
        products: {
          create: products.map(p => ({
            productId: p.productId,
            quantity: p.quantity
          }))
        }
      })
    },
    include: {
      products: {
        include: {
          product: {
            include: {
              producer: true
            }
          }
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'Type de panier modifié avec succès',
    data: { basketType: updatedBasketType }
  });
});

// RÉCUPÉRER TOUS LES TYPES DE PANIERS
const getAllBasketTypes = asyncHandler(async (req, res) => {
  const basketTypes = await prisma.basketType.findMany({
    include: {
      availabilities: {
        include: {
          weeklyBasket: true
        }
      }
    },
    orderBy: {
      size: 'asc'
    }
  });

  res.json({
    success: true,
    basketTypes
  });
});

// SUPPRIMER UN TYPE DE PANIER 
const deleteBasketType = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const basketType = await prisma.basketType.findUnique({
    where: { id },
    include: {
      availabilities: true
    }
  });

  if (!basketType) {
    throw new HttpNotFoundError('Type de panier introuvable');
  }

  // Vérifier s'il y a des disponibilités associées
  if (basketType.availabilities.length > 0) {
    throw new HttpConflictError(
      'Impossible de supprimer ce type de panier car il a des disponibilités associées. ' +
      'Veuillez d\'abord les supprimer.'
    );
  }

  await prisma.basketType.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Type de panier supprimé avec succès'
  });
});





// RÉCUPÉRER TOUTES LES COMMANDES
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  const where = status ? { status } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: parsedLimit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        orderItems: {
          include: {
            basketAvailability: {
              include: {
                basketType: true
              }
            }
          }
        },
        pickupLocation: true,
        payments: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.order.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// CHANGER LE STATUT D'UNE COMMANDE 
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED'];

  if (!status || !validStatuses.includes(status)) {
    throw new HttpBadRequestError(`Statut invalide. Valeurs autorisées : ${validStatuses.join(', ')}`);
  }

  const order = await prisma.order.findUnique({
    where: { id }
  });

  if (!order) {
    throw new HttpNotFoundError('Commande introuvable');
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      user: {
        select: {
          email: true,
          firstName: true
        }
      },
      orderItems: {
        include: {
          basketAvailability: {
            include: {
              basketType: true
            }
          }
        }
      }
    }
  });

  // TODO: Envoyer un email selon le statut
  // Si READY -> email "votre commande est prête"
  // Si COMPLETED -> email "merci pour votre commande"

  res.json({
    success: true,
    message: 'Statut de la commande mis à jour',
    data: { order: updatedOrder }
  });
});

// GESTION DES UTILISATEURS //

// RÉCUPÉRER UN UTILISATEUR PAR EMAIL
const getUserByEmail = asyncHandler(async (req, res) => {
  const { email } = req.params;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      emailVerified: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur introuvable');
  }

  res.json({
    success: true,
    data: user
  });
});

// RÉCUPÉRER TOUS LES UTILISATEURS
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  const where = {
    deletedAt: null, // Exclure les soft deleted
    ...(role && { role })
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: parsedLimit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            subscriptions: true,
            shiftVolunteers: true
          }
        },
        subscriptions: {
          select: {
            _count: { select: { pickups: true } }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.user.count({ where })
  ]);

  const mappedUsers = users.map(({ subscriptions, ...rest }) => ({
    ...rest,
    _count: {
      ...rest._count,
      pickups: subscriptions.reduce((sum, s) => sum + s._count.pickups, 0)
    }
  }));

  res.json({
    success: true,
    data: {
      users: mappedUsers,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// CHANGER LE RÔLE D'UN UTILISATEUR 
const changeUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const validRoles = ['CUSTOMER', 'ADMIN', 'PRODUCER'];

  if (!role || !validRoles.includes(role)) {
    throw new HttpBadRequestError(`Rôle invalide. Valeurs autorisées : ${validRoles.join(', ')}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur introuvable');
  }

  if (user.deletedAt) {
    throw new HttpBadRequestError('Cet utilisateur est supprimé');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true
    }
  });

  await logAudit(req, 'CHANGE_USER_ROLE', 'CRITICAL', { type: 'USER', id: userId, label: user.email }, { oldRole: user.role, newRole: role });

  res.json({
    success: true,
    message: 'Rôle modifié avec succès',
    data: { user: updatedUser }
  });
});

// SUPPRIMER UN UTILISATEUR (SOFT DELETE) 
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur introuvable');
  }

  if (user.deletedAt) {
    throw new HttpBadRequestError('Cet utilisateur est déjà supprimé');
  }

  // Ne pas permettre de se supprimer soi-même
  if (userId === req.user.id) {
    throw new HttpBadRequestError('Vous ne pouvez pas supprimer votre propre compte');
  }

  // Soft delete
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date()
    }
  });

  await logAudit(req, 'DELETE_USER', 'CRITICAL', { type: 'USER', id: userId, label: user.email });

  res.json({
    success: true,
    message: 'Utilisateur supprimé avec succès'
  });
});

// GESTION DES THÈMES SAISONNIERS //

// METTRE À JOUR LE THÈME ACTIF 
const updateTheme = asyncHandler(async (req, res) => {
  const { season, primaryColor, secondaryColor, accentColor, backgroundColor, backgroundImage } = req.body;

  const validSeasons = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];

  if (!season || !validSeasons.includes(season)) {
    throw new HttpBadRequestError(`Saison invalide. Valeurs autorisées : ${validSeasons.join(', ')}`);
  }

  // Désactiver tous les thèmes
  await prisma.themeConfig.updateMany({
    data: { isActive: false }
  });

  // Créer ou mettre à jour le thème pour cette saison
  const theme = await prisma.themeConfig.upsert({
    where: { season },
    update: {
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      backgroundImage,
      isActive: true
    },
    create: {
      season,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      backgroundImage,
      isActive: true
    }
  });

  res.json({
    success: true,
    message: 'Thème activé avec succès',
    data: { theme }
  });
});

// RÉCUPÉRER LE THÈME ACTIF
const getActiveTheme = asyncHandler(async (req, res) => {
  const theme = await prisma.themeConfig.findFirst({
    where: { isActive: true }
  });

  if (!theme) {
    // Renvoyer un thème par défaut si aucun n'est actif
    return res.json({
      success: true,
      data: {
        theme: {
          season: 'SPRING',
          primaryColor: '#a7f3d0',     // Vert menthe pastel
          secondaryColor: '#fcd34d',   // Jaune doux
          accentColor: '#fb923c',      // Pêche
          backgroundColor: '#fef3f9',  // Rose très pâle
          backgroundImage: null
        }
      }
    });
  }

  res.json({
    success: true,
    data: { theme }
  });
});


// GESTION DU BLOG //

// CRÉER UN ARTICLE DE BLOG 
const createBlogPost = asyncHandler(async (req, res) => {
  const parsed = BlogPostSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpBadRequestError(parsed.error.errors[0].message);
  }
  const { title, slug, content, excerpt, image, isPublished } = parsed.data;
  const authorId = req.user.id;

  // Vérifier que le slug n'existe pas déjà
  if (slug) {
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug }
    });

    if (existingPost) {
      throw new HttpConflictError('Ce slug est déjà utilisé');
    }
  }

  const post = await prisma.blogPost.create({
    data: {
      title,
      slug: slug || title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
      content,
      excerpt,
      image,
      authorId,
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Article créé avec succès',
    data: { post }
  });
});

// MODIFIER UN ARTICLE DE BLOG 
const updateBlogPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, slug, content, excerpt, image, isPublished } = req.body;

  const post = await prisma.blogPost.findUnique({
    where: { id }
  });

  if (!post) {
    throw new HttpNotFoundError('Article introuvable');
  }

  // Si le slug change, vérifier qu'il n'est pas déjà utilisé
  if (slug && slug !== post.slug) {
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug }
    });

    if (existingPost) {
      throw new HttpConflictError('Ce slug est déjà utilisé');
    }
  }

  const updatedPost = await prisma.blogPost.update({
    where: { id },
    data: {
      title,
      slug,
      content,
      excerpt,
      image,
      isPublished,
      ...(isPublished && !post.publishedAt && { publishedAt: new Date() })
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'Article modifié avec succès',
    data: { post: updatedPost }
  });
});

// SUPPRIMER UN ARTICLE DE BLOG 
const deleteBlogPost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await prisma.blogPost.findUnique({
    where: { id }
  });

  if (!post) {
    throw new HttpNotFoundError('Article introuvable');
  }

  await prisma.blogPost.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Article supprimé avec succès'
  });
});

// STATISTIQUES //

const getStats = asyncHandler(async (req, res) => {
  try {
    // Récupérer différentes stats une par une pour identifier laquelle échoue
    const totalUsers = await prisma.user.count({
      where: { deletedAt: null }
    });

    const totalProducers = await prisma.producer.count({
      where: { isActive: true }
    });

    const totalProducts = await prisma.product.count({
      where: { isActive: true, deletedAt: null }
    });

    const totalSubscriptions = await prisma.subscription.count();

    const activeSubscriptions = await prisma.subscription.count({
      where: { status: 'ACTIVE' }
    });

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const expiringSoon = await prisma.subscription.count({
      where: { status: 'ACTIVE', endDate: { gte: new Date(), lte: in30Days } }
    });

    const pendingRequests = await prisma.subscriptionRequest.count({
      where: { status: 'PENDING' }
    });

    const producerInquiries = await prisma.producerInquiry.count({
      where: { status: 'PENDING' }
    });

    const recentActivities = await prisma.subscription.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        pickupLocation: {
          select: {
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        stats: {
          users: totalUsers,
          producers: totalProducers,
          products: totalProducts,
          subscriptions: totalSubscriptions,
          activeSubscriptions: activeSubscriptions,
          expiringSoon: expiringSoon,
          pendingRequests: pendingRequests,
          producerInquiries: producerInquiries
        },
        recentActivities: recentActivities
      }
    });
  } catch (error) {
    console.error('Erreur dans getStats:', error);
    throw error;
  }
});

// RECHERCHE GLOBALE //

const globalSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ success: true, data: { users: [], subscriptions: [], messages: [], newsletters: [] } });
  }

  const term = q.trim();
  const mode = 'insensitive';
  const LIMIT = 4;

  const [users, subscriptions, messages, newsletters] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: term, mode } },
          { lastName: { contains: term, mode } },
          { email: { contains: term, mode } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      take: LIMIT,
    }),
    prisma.subscription.findMany({
      where: {
        OR: [
          { subscriptionNumber: { contains: term, mode } },
          { user: { firstName: { contains: term, mode } } },
          { user: { lastName: { contains: term, mode } } },
        ],
      },
      select: { id: true, subscriptionNumber: true, status: true, user: { select: { firstName: true, lastName: true } } },
      take: LIMIT,
    }),
    prisma.contactMessage.findMany({
      where: {
        OR: [
          { name: { contains: term, mode } },
          { email: { contains: term, mode } },
          { subject: { contains: term, mode } },
        ],
      },
      select: { id: true, name: true, email: true, subject: true, status: true },
      take: LIMIT,
    }),
    prisma.newsletter.findMany({
      where: { subject: { contains: term, mode } },
      select: { id: true, subject: true, sentAt: true, sentCount: true },
      take: LIMIT,
    }),
  ]);

  res.json({ success: true, data: { users, subscriptions, messages, newsletters } });
});

// GESTION DES EXEMPLES //

// Récupérer les stats des exemples
const getExampleStats = asyncHandler(async (req, res) => {
  const [
    exampleProducers,
    exampleProducts,
    examplePickupLocations,
    totalProducers,
    totalProducts,
    totalPickupLocations
  ] = await Promise.all([
    prisma.producer.count({ where: { isExample: true } }),
    prisma.product.count({ where: { isExample: true } }),
    prisma.pickupLocation.count({ where: { isExample: true } }),
    prisma.producer.count(),
    prisma.product.count(),
    prisma.pickupLocation.count(),
  ]);

  res.json({
    success: true,
    data: {
      examples: {
        producers: exampleProducers,
        products: exampleProducts,
        pickupLocations: examplePickupLocations,
        total: exampleProducers + exampleProducts + examplePickupLocations
      },
      totals: {
        producers: totalProducers,
        products: totalProducts,
        pickupLocations: totalPickupLocations,
        total: totalProducers + totalProducts + totalPickupLocations
      }
    }
  });
});

// Supprimer tous les exemples
const deleteAllExamples = asyncHandler(async (req, res) => {
  await prisma.$transaction(async (tx) => {
    // 1. Supprimer les Products
    const deletedProducts = await tx.product.deleteMany({
      where: { isExample: true }
    });

    // 2. Supprimer les PickupLocations
    const deletedPickupLocations = await tx.pickupLocation.deleteMany({
      where: { isExample: true }
    });

    // 3. Supprimer les Producers (en dernier car Products dépend d'eux)
    const deletedProducers = await tx.producer.deleteMany({
      where: { isExample: true }
    });

    console.log('Exemples supprimés:', {
      products: deletedProducts.count,
      pickupLocations: deletedPickupLocations.count,
      producers: deletedProducers.count,
    });
  });

  await logAudit(req, 'DELETE_EXAMPLES', 'IMPORTANT');

  res.json({
    success: true,
    message: 'Tous les exemples ont été supprimés avec succès'
  });
});

// JOURNAL D'AUDIT //

const getAuditLogs = asyncHandler(async (req, res) => {
  const { severity, action, page = 1, limit = 50 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 50, 200);
  const skip = (parsedPage - 1) * parsedLimit;

  const where = {
    ...(severity && { severity }),
    ...(action  && { action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    },
  });
});

export {
  createProducer,
  updateProducer,
  deleteProducer,
  getAllProducers,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getAllOrders,
  updateOrderStatus,
  getAllUsers,
  getUserByEmail,
  changeUserRole,
  deleteUser,
  updateTheme,
  getActiveTheme,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getStats,
  globalSearch,
  getExampleStats,
  deleteAllExamples,
  getAuditLogs
};