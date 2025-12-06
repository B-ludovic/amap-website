import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  httpStatusCodes
} from '../utils/httpErrors.js';


// GESTION DES PRODUCTEURS //


// CRÉER UN PRODUCTEUR 
const createProducer = asyncHandler(async (req, res) => {
  const { name, description, email, phone, specialty, image } = req.body;

  // Vérifier les champs requis
  if (!name || !description || !email) {
    throw new HttpBadRequestError('Nom, description et email requis');
  }

  // Vérifier que l'email n'existe pas déjà
  const existingProducer = await prisma.producer.findUnique({
    where: { email }
  });

  if (existingProducer) {
    throw new HttpConflictError('Cet email est déjà utilisé');
  }

  const producer = await prisma.producer.create({
    data: {
      name,
      description,
      email,
      phone,
      specialty,
      image
    }
  });

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
      name,
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

  res.json({
    success: true,
    message: 'Producteur supprimé avec succès'
  });
});

// GESTION DES TYPES DE PANIERS //

// CRÉER UN TYPE DE PANIER 
const createBasketType = asyncHandler(async (req, res) => {
  const { name, description, price, image, products } = req.body;

  if (!name || !description || !price) {
    throw new HttpBadRequestError('Nom, description et prix requis');
  }

  if (price <= 0) {
    throw new HttpBadRequestError('Le prix doit être supérieur à 0');
  }

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

// GESTION DES DISPONIBILITÉS DE PANIERS 

// CRÉER UNE DISPONIBILITÉ 
const createBasketAvailability = asyncHandler(async (req, res) => {
  const { basketTypeId, availableQuantity, distributionDate, pickupLocationId } = req.body;

  if (!basketTypeId || !availableQuantity || !distributionDate || !pickupLocationId) {
    throw new HttpBadRequestError('Tous les champs sont requis');
  }

  if (availableQuantity < 0) {
    throw new HttpBadRequestError('La quantité doit être positive');
  }

  // Vérifier que le type de panier existe
  const basketType = await prisma.basketType.findUnique({
    where: { id: basketTypeId }
  });

  if (!basketType) {
    throw new HttpNotFoundError('Type de panier introuvable');
  }

  // Vérifier que le point de retrait existe
  const pickupLocation = await prisma.pickupLocation.findUnique({
    where: { id: pickupLocationId }
  });

  if (!pickupLocation) {
    throw new HttpNotFoundError('Point de retrait introuvable');
  }

  const availability = await prisma.basketAvailability.create({
    data: {
      basketTypeId,
      availableQuantity,
      distributionDate: new Date(distributionDate),
      pickupLocationId
    },
    include: {
      basketType: true,
      pickupLocation: true
    }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Disponibilité créée avec succès',
    data: { availability }
  });
});

// MODIFIER UNE DISPONIBILITÉ 
const updateBasketAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { availableQuantity, distributionDate, pickupLocationId } = req.body;

  const availability = await prisma.basketAvailability.findUnique({
    where: { id }
  });

  if (!availability) {
    throw new HttpNotFoundError('Disponibilité introuvable');
  }

  if (availableQuantity !== undefined && availableQuantity < 0) {
    throw new HttpBadRequestError('La quantité doit être positive');
  }

  const updatedAvailability = await prisma.basketAvailability.update({
    where: { id },
    data: {
      ...(availableQuantity !== undefined && { availableQuantity }),
      ...(distributionDate && { distributionDate: new Date(distributionDate) }),
      ...(pickupLocationId && { pickupLocationId })
    },
    include: {
      basketType: true,
      pickupLocation: true
    }
  });

  res.json({
    success: true,
    message: 'Disponibilité modifiée avec succès',
    data: { availability: updatedAvailability }
  });
});

// SUPPRIMER UNE DISPONIBILITÉ 
const deleteBasketAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const availability = await prisma.basketAvailability.findUnique({
    where: { id },
    include: {
      orderItems: true
    }
  });

  if (!availability) {
    throw new HttpNotFoundError('Disponibilité introuvable');
  }

  // Vérifier s'il y a des commandes associées
  if (availability.orderItems.length > 0) {
    throw new HttpConflictError(
      'Impossible de supprimer cette disponibilité car elle a des commandes associées.'
    );
  }

  await prisma.basketAvailability.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Disponibilité supprimée avec succès'
  });
});

// GESTION DES COMMANDES //

// RÉCUPÉRER TOUTES LES COMMANDES 
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = status ? { status } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: parseInt(limit),
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
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
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

// RÉCUPÉRER TOUS LES UTILISATEURS 
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    deletedAt: null, // Exclure les soft deleted
    ...(role && { role })
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
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
            orders: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.user.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
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
  const { title, slug, content, excerpt, image, isPublished } = req.body;
  const authorId = req.user.id;

  if (!title || !content) {
    throw new HttpBadRequestError('Titre et contenu requis');
  }

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
  // Récupérer différentes stats en parallèle
  const [
    totalUsers,
    totalOrders,
    totalRevenue,
    pendingOrders,
    completedOrders,
    totalProducers,
    totalBasketTypes,
    recentOrders
  ] = await Promise.all([
    // Nombre total d'utilisateurs (non supprimés)
    prisma.user.count({
      where: { deletedAt: null }
    }),
    // Nombre total de commandes
    prisma.order.count(),
    // Revenu total (commandes payées)
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] } },
      _sum: { totalAmount: true }
    }),
    // Commandes en attente
    prisma.order.count({
      where: { status: 'PENDING' }
    }),
    // Commandes terminées
    prisma.order.count({
      where: { status: 'COMPLETED' }
    }),
    // Nombre de producteurs
    prisma.producer.count({
      where: { isActive: true }
    }),
    // Nombre de types de paniers
    prisma.basketType.count({
      where: { isActive: true }
    }),
    // 10 dernières commandes
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        users: totalUsers,
        orders: totalOrders,
        revenue: totalRevenue._sum.totalAmount || 0,
        pendingOrders,
        completedOrders,
        producers: totalProducers,
        basketTypes: totalBasketTypes
      },
      recentOrders
    }
  });
});

// GESTION DES EXEMPLES //

// Récupérer les stats des exemples
const getExampleStats = asyncHandler(async (req, res) => {
  const [producers, products, baskets, pickupLocations] = await Promise.all([
    prisma.producer.count({ where: { isExample: true } }),
    prisma.product.count({ where: { isExample: true } }),
    prisma.basketType.count({ where: { isExample: true } }),
    prisma.pickupLocation.count({ where: { isExample: true } }),
  ]);

  res.json({
    success: true,
    data: {
      producers,
      products,
      baskets,
      pickupLocations,
      total: producers + products + baskets + pickupLocations
    }
  });
});

// Supprimer tous les exemples
const deleteAllExamples = asyncHandler(async (req, res) => {
  await prisma.$transaction(async (tx) => {
    // 1. Supprimer les OrderItems liés aux paniers exemples
    const deletedOrderItems = await tx.orderItem.deleteMany({
      where: {
        basketAvailability: {
          basketType: { isExample: true }
        }
      }
    });

    // 2. Supprimer les Orders liés aux paniers exemples OU aux lieux exemples
    const deletedOrders = await tx.order.deleteMany({
      where: {
        OR: [
          {
            basketAvailability: {
              basketType: { isExample: true }
            }
          },
          {
            pickupLocation: { isExample: true }
          }
        ]
      }
    });

    // 3. Supprimer les BasketAvailability (disponibilités)
    const deletedAvailabilities = await tx.basketAvailability.deleteMany({
      where: {
        OR: [
          { basketType: { isExample: true } },
          { pickupLocation: { isExample: true } }
        ]
      }
    });

    // 4. Supprimer les BasketTypeProduct (composition des paniers)
    const deletedBasketProducts = await tx.basketTypeProduct.deleteMany({
      where: {
        OR: [
          { basketType: { isExample: true } },
          { product: { isExample: true } }
        ]
      }
    });

    // 5. Supprimer les BasketTypes (types de paniers)
    const deletedBaskets = await tx.basketType.deleteMany({
      where: { isExample: true }
    });

    // 6. Supprimer les Products
    const deletedProducts = await tx.product.deleteMany({
      where: { isExample: true }
    });

    // 7. Supprimer les PickupLocations
    const deletedPickupLocations = await tx.pickupLocation.deleteMany({
      where: { isExample: true }
    });

    // 8. Supprimer les Producers (en dernier car Products dépend d'eux)
    const deletedProducers = await tx.producer.deleteMany({
      where: { isExample: true }
    });

    console.log('Exemples supprimés:', {
      orderItems: deletedOrderItems.count,
      orders: deletedOrders.count,
      availabilities: deletedAvailabilities.count,
      basketProducts: deletedBasketProducts.count,
      baskets: deletedBaskets.count,
      products: deletedProducts.count,
      pickupLocations: deletedPickupLocations.count,
      producers: deletedProducers.count,
    });
  });

  res.json({
    success: true,
    message: 'Tous les exemples ont été supprimés avec succès'
  });
});

export {
  createProducer,
  updateProducer,
  deleteProducer,
  createBasketType,
  updateBasketType,
  deleteBasketType,
  createBasketAvailability,
  updateBasketAvailability,
  deleteBasketAvailability,
  getAllOrders,
  updateOrderStatus,
  getAllUsers,
  changeUserRole,
  deleteUser,
  updateTheme,
  getActiveTheme,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getStats,
  getExampleStats,
  deleteAllExamples
};