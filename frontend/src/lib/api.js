const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchAPI(endpoint, options = {}) {
  const { method = 'GET', body, requiresAuth = false } = options;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Une erreur est survenue');
  }

  return response.json();
}

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

  // Produits
  products: {
    getAll: async () => {
      return fetchAPI('/admin/products', {
        requiresAuth: true,
      });
    },

    create: async (productData) => {
      return fetchAPI('/admin/products', {
        method: 'POST',
        body: productData,
        requiresAuth: true,
      });
    },

    update: async (id, productData) => {
      return fetchAPI(`/admin/products/${id}`, {
        method: 'PUT',
        body: productData,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/products/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Paniers (basket-types)
  baskets: {
    getAll: async () => {
      return fetchAPI('/admin/basket-types', {
        requiresAuth: true,
      });
    },

    create: async (basketData) => {
      return fetchAPI('/admin/basket-types', {
        method: 'POST',
        body: basketData,
        requiresAuth: true,
      });
    },

    update: async (id, basketData) => {
      return fetchAPI(`/admin/basket-types/${id}`, {
        method: 'PUT',
        body: basketData,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/basket-types/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Disponibilités (basket-availabilities)
  availabilities: {
    create: async (availabilityData) => {
      return fetchAPI('/admin/basket-availabilities', {
        method: 'POST',
        body: availabilityData,
        requiresAuth: true,
      });
    },

    update: async (id, availabilityData) => {
      return fetchAPI(`/admin/basket-availabilities/${id}`, {
        method: 'PUT',
        body: availabilityData,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/basket-availabilities/${id}`, {
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

    changeRole: async (userId, role) => {
      return fetchAPI(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: { role },
        requiresAuth: true,
      });
    },

    delete: async (userId) => {
      return fetchAPI(`/admin/users/${userId}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Thèmes
  theme: {
    getActive: async () => {
      return fetchAPI('/admin/theme/active', {
        requiresAuth: true,
      });
    },

    update: async (themeData) => {
      return fetchAPI('/admin/theme', {
        method: 'PUT',
        body: themeData,
        requiresAuth: true,
      });
    },
  },

  // Blog
  blog: {
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

  // Exemples
  examples: {
    getStats: async () => {
      return fetchAPI('/admin/examples/stats', {
        requiresAuth: true,
      });
    },

    deleteAll: async () => {
      return fetchAPI('/admin/examples', {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },
};

// Routes d'authentification (publiques)
export const auth = {
  register: async (userData) => {
    return fetchAPI('/auth/register', {
      method: 'POST',
      body: userData,
    });
  },

  login: async (credentials) => {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  },

  logout: async () => {
    return fetchAPI('/auth/logout', {
      method: 'POST',
      requiresAuth: true,
    });
  },

  me: async () => {
    return fetchAPI('/auth/me', {
      requiresAuth: true,
    });
  },
};

const api = {
  admin,
  auth,
};

export default api;