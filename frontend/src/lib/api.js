// Configuration de base
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Classe pour gérer les erreurs API
class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Fonction helper pour faire les requêtes
async function fetchAPI(endpoint, options = {}) {
  const { method = 'GET', body, headers = {}, requiresAuth = false } = options;

  // Configuration des headers
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  // Ajouter le token si nécessaire
  if (requiresAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Ajouter le body si présent
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error?.message || 'Une erreur est survenue',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Erreur de connexion au serveur', 500, null);
  }
}

// AUTHENTIFICATION //

export const auth = {
  // Inscription
  register: async (userData) => {
    return fetchAPI('/auth/register', {
      method: 'POST',
      body: userData,
    });
  },

  // Connexion
  login: async (credentials) => {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  },

  // Récupérer l'utilisateur connecté
  getMe: async () => {
    return fetchAPI('/auth/me', {
      requiresAuth: true,
    });
  },

  // Confirmer l'email
  confirmEmail: async (token) => {
    return fetchAPI('/auth/confirm-email', {
      method: 'POST',
      body: { token },
    });
  },

  // Demander un reset de mot de passe
  forgotPassword: async (email) => {
    return fetchAPI('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },

  // Réinitialiser le mot de passe
  resetPassword: async (token, password) => {
    return fetchAPI('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    });
  },
};

// PANIERS //

export const baskets = {
  // Récupérer tous les paniers
  getAll: async () => {
    return fetchAPI('/baskets');
  },

  // Récupérer un panier par ID
  getById: async (id) => {
    return fetchAPI(`/baskets/${id}`);
  },

  // Récupérer les paniers disponibles (avec filtres)
  getAvailable: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.distributionDate) params.append('distributionDate', filters.distributionDate);
    if (filters.pickupLocationId) params.append('pickupLocationId', filters.pickupLocationId);

    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchAPI(`/baskets/available${query}`);
  },
};

// PRODUCERS //

export const producers = {
  // Récupérer tous les producteurs
  getAll: async () => {
    return fetchAPI('/producers');
  },

  // Récupérer un producteur par ID
  getById: async (id) => {
    return fetchAPI(`/producers/${id}`);
  },
};

// COMMANDES //

export const orders = {
  // Créer une commande
  create: async (orderData) => {
    return fetchAPI('/orders', {
      method: 'POST',
      body: orderData,
      requiresAuth: true,
    });
  },

  // Récupérer mes commandes
  getMy: async () => {
    return fetchAPI('/orders/my-orders', {
      requiresAuth: true,
    });
  },

  // Récupérer une commande par ID
  getById: async (id) => {
    return fetchAPI(`/orders/${id}`, {
      requiresAuth: true,
    });
  },

  // Annuler une commande
  cancel: async (id) => {
    return fetchAPI(`/orders/${id}/cancel`, {
      method: 'POST',
      requiresAuth: true,
    });
  },
};

// PAIEMENTS //

export const payments = {
  // Créer un Payment Intent
  createPaymentIntent: async (orderId) => {
    return fetchAPI('/payments/create-payment-intent', {
      method: 'POST',
      body: { orderId },
      requiresAuth: true,
    });
  },

  // Confirmer un paiement
  confirm: async (paymentIntentId) => {
    return fetchAPI('/payments/confirm', {
      method: 'POST',
      body: { paymentIntentId },
      requiresAuth: true,
    });
  },
};

// ADMIN //

export const admin = {
  // Producteurs
  producers: {
    getAll: async () => {
      return fetchAPI('/admin/producers', {
        requiresAuth: true,
      });
    },

    create: async (producerData) => {
      return fetchAPI('/admin/producers', {
        method: 'POST',
        body: producerData,
        requiresAuth: true,
      });
    },

    update: async (id, producerData) => {
      return fetchAPI(`/admin/producers/${id}`, {
        method: 'PUT',
        body: producerData,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/producers/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Paniers
  baskets: {
    getAll: async () => {
      return fetchAPI('/admin/baskets', {
        requiresAuth: true,
      });
    },

    create: async (basketData) => {
      return fetchAPI('/admin/baskets', {
        method: 'POST',
        body: basketData,
        requiresAuth: true,
      });
    },

    update: async (id, basketData) => {
      return fetchAPI(`/admin/baskets/${id}`, {
        method: 'PUT',
        body: basketData,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/baskets/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Disponibilités
  availabilities: {
    create: async (availabilityData) => {
      return fetchAPI('/admin/availabilities', {
        method: 'POST',
        body: availabilityData,
        requiresAuth: true,
      });
    },

    update: async (id, availabilityData) => {
      return fetchAPI(`/admin/availabilities/${id}`, {
        method: 'PUT',
        body: availabilityData,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/availabilities/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Commandes
  orders: {
    getAll: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.status) queryParams.append('status', params.status);

      const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
      return fetchAPI(`/admin/orders${query}`, {
        requiresAuth: true,
      });
    },

    updateStatus: async (id, status) => {
      return fetchAPI(`/admin/orders/${id}/status`, {
        method: 'PUT',
        body: { status },
        requiresAuth: true,
      });
    },
  },

  // Utilisateurs
  users: {
    getAll: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.role) queryParams.append('role', params.role);

      const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
      return fetchAPI(`/admin/users${query}`, {
        requiresAuth: true,
      });
    },

    changeRole: async (id, role) => {
      return fetchAPI(`/admin/users/${id}/role`, {
        method: 'PUT',
        body: { role },
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/users/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Thèmes
  theme: {
    get: async () => {
      return fetchAPI('/admin/theme', {
        requiresAuth: true,
      });
    },

    update: async (season, colors) => {
      return fetchAPI('/admin/theme', {
        method: 'PUT',
        body: { season, ...colors },
        requiresAuth: true,
      });
    },
  },

  // Blog
  blog: {
    getAll: async () => {
      return fetchAPI('/admin/blog', {
        requiresAuth: true,
      });
    },

    create: async (postData) => {
      return fetchAPI('/admin/blog', {
        method: 'POST',
        body: postData,
        requiresAuth: true,
      });
    },

    update: async (id, postData) => {
      return fetchAPI(`/admin/blog/${id}`, {
        method: 'PUT',
        body: postData,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/blog/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Statistiques
  stats: {
    get: async () => {
      return fetchAPI('/admin/stats', {
        requiresAuth: true,
      });
    },
  },
};

// Export de l'API complète
const api = {
  auth,
  baskets,
  producers,
  orders,
  payments,
  admin,
};

export default api;