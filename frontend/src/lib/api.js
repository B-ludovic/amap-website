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

  // Points de retrait
  pickupLocations: {
    getAll: async () => {
      return fetchAPI('/admin/pickup-locations', {
        requiresAuth: true,
      });
    },

    create: async (data) => {
      return fetchAPI('/admin/pickup-locations', {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    update: async (id, data) => {
      return fetchAPI(`/admin/pickup-locations/${id}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/pickup-locations/${id}`, {
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
  
  newsletters: {
    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/newsletters${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    getStats: async () => {
      return fetchAPI('/newsletters/stats', {
        requiresAuth: true,
      });
    },

    getById: async (id) => {
      return fetchAPI(`/newsletters/${id}`, {
        requiresAuth: true,
      });
    },

    create: async (data) => {
      return fetchAPI('/newsletters', {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    update: async (id, data) => {
      return fetchAPI(`/newsletters/${id}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/newsletters/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },

    send: async (id) => {
      return fetchAPI(`/newsletters/${id}/send`, {
        method: 'POST',
        requiresAuth: true,
      });
    },

    schedule: async (id, data) => {
      return fetchAPI(`/newsletters/${id}/schedule`, {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },
  },

  shifts: {
    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/shifts${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    getById: async (id) => {
      return fetchAPI(`/shifts/${id}`, {
        requiresAuth: true,
      });
    },

    getMyShifts: async () => {
      return fetchAPI('/shifts/my-shifts', {
        requiresAuth: true,
      });
    },

    create: async (data) => {
      return fetchAPI('/shifts', {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    update: async (id, data) => {
      return fetchAPI(`/shifts/${id}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/shifts/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },

    join: async (id, data) => {
      return fetchAPI(`/shifts/${id}/join`, {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    leave: async (id) => {
      return fetchAPI(`/shifts/${id}/leave`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },

    duplicate: async (id, data) => {
      return fetchAPI(`/shifts/${id}/duplicate`, {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },
  },

  weeklyBaskets: {
    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/weekly-baskets${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    getCurrent: async () => {
      return fetchAPI('/weekly-baskets/current', {
        requiresAuth: true,
      });
    },

    getById: async (id) => {
      return fetchAPI(`/weekly-baskets/${id}`, {
        requiresAuth: true,
      });
    },

    create: async (data) => {
      return fetchAPI('/weekly-baskets', {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    update: async (id, data) => {
      return fetchAPI(`/weekly-baskets/${id}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/weekly-baskets/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },

    publish: async (id) => {
      return fetchAPI(`/weekly-baskets/${id}/publish`, {
        method: 'POST',
        requiresAuth: true,
      });
    },

    duplicate: async (id, data) => {
      return fetchAPI(`/weekly-baskets/${id}/duplicate`, {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    addProduct: async (id, data) => {
      return fetchAPI(`/weekly-baskets/${id}/products`, {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    updateProduct: async (id, productId, data) => {
      return fetchAPI(`/weekly-baskets/${id}/products/${productId}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    removeProduct: async (id, productId) => {
      return fetchAPI(`/weekly-baskets/${id}/products/${productId}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  distribution: {
    getList: async (weeklyBasketId, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/distribution/${weeklyBasketId}${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    markAsPickedUp: async (pickupId, data) => {
      if (pickupId === 'new') {
        return fetchAPI('/distribution/pickup', {
          method: 'POST',
          body: data,
          requiresAuth: true,
        });
      }
      
      return fetchAPI(`/distribution/pickup/${pickupId}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },
  },

  subscriptions: {
    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/subscriptions${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    getById: async (id) => {
      return fetchAPI(`/subscriptions/${id}`, {
        requiresAuth: true,
      });
    },

    getStats: async () => {
      return fetchAPI('/subscriptions/stats', {
        requiresAuth: true,
      });
    },

    create: async (data) => {
      return fetchAPI('/subscriptions', {
        method: 'POST',
        body: data,
        requiresAuth: true,
      });
    },

    update: async (id, data) => {
      return fetchAPI(`/subscriptions/${id}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    cancel: async (id, data) => {
      return fetchAPI(`/subscriptions/${id}/cancel`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    pause: async (id, data) => {
      return fetchAPI(`/subscriptions/${id}/pause`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    resume: async (id) => {
      return fetchAPI(`/subscriptions/${id}/resume`, {
        method: 'PUT',
        requiresAuth: true,
      });
    },

    getMySubscription: async () => {
      return fetchAPI('/subscriptions/me', {
        requiresAuth: true,
      });
    },
  },

  producers: {
    getAll: async () => {
      return fetchAPI('/producers', {
        requiresAuth: false,
      });
    },

    getById: async (id) => {
      return fetchAPI(`/producers/${id}`, {
        requiresAuth: false,
      });
    },
  },

  subscriptionRequests: {
    // Public - Submit a subscription request (no auth required)
    submitRequest: async (data) => {
      return fetchAPI('/subscription-requests', {
        method: 'POST',
        body: data,
        requiresAuth: false,
      });
    },

    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/subscription-requests${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    getById: async (id) => {
      return fetchAPI(`/subscription-requests/${id}`, {
        requiresAuth: true,
      });
    },

    updateStatus: async (id, data) => {
      return fetchAPI(`/subscription-requests/${id}/status`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },
  },

  producerInquiries: {
    submit: async (data) => {
      return fetchAPI('/producer-inquiries', {
        method: 'POST',
        body: data,
        requiresAuth: false,
      });
    },

    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/producer-inquiries${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    getById: async (id) => {
      return fetchAPI(`/producer-inquiries/${id}`, {
        requiresAuth: true,
      });
    },

    updateStatus: async (id, data) => {
      return fetchAPI(`/producer-inquiries/${id}/status`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/producer-inquiries/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },
};

export default api;