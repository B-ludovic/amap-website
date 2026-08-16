const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* fetch ne rejette que sur échec réseau : serveur éteint, DNS, CORS bloqué.
   C'est alors le TypeError du navigateur qui remonte, dont le message varie
   selon le moteur (« Failed to fetch », « Load failed », « NetworkError… ») et
   s'affiche tel quel à l'utilisateur. On le remplace ici, une fois pour toutes,
   pour que le message porté par l'erreur soit toujours présentable.
   Statut 0 : convention pour « la réponse n'a jamais existé ». */
async function safeFetch(url, config) {
  try {
    return await fetch(url, config);
  } catch {
    throw new ApiError('Serveur injoignable. Vérifiez votre connexion et réessayez.', 0);
  }
}

function redirectToExpiredSessionLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('auth_known');
  window.location.href = '/auth/login?expired=1';
}

async function fetchAPI(endpoint, options = {}) {
  const { method = 'GET', body, requiresAuth = false } = options;

  const headers = {
    'Content-Type': 'application/json',
  };

  const config = {
    method,
    headers,
    credentials: 'include',
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await safeFetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new ApiError(
      payload.error?.message || payload.message || 'Une erreur est survenue',
      response.status
    );

    if (response.status === 401 && requiresAuth) {
      redirectToExpiredSessionLogin();
    }

    throw error;
  }

  return response.json();
}

/* Déclenche le téléchargement d'un fichier renvoyé par l'API. Le nom vient de
   l'en-tête Content-Disposition posé par le serveur et n'est reconstruit ici que
   s'il manque : c'est le serveur qui sait ce qu'il envoie, le navigateur ne fait
   que le ranger. Le lien est créé, cliqué, puis retiré du document — sans ce
   nettoyage, chaque export laisserait une ancre morte et une URL blob non
   révoquée, donc son contenu en mémoire jusqu'au rechargement de la page. */
async function downloadResponse(response, { mimeType, fallbackName }) {
  const raw = await response.blob();
  const blob = new Blob([raw], { type: mimeType });

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = fallbackName;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '');
    }
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
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

  // Utilisateurs
  users: {
    getAll: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.role) queryParams.append('role', params.role);
      if (params.search) queryParams.append('search', params.search);

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

  // Recherche globale
  search: async (q) => {
    return fetchAPI(`/admin/search?q=${encodeURIComponent(q)}`, {
      requiresAuth: true,
    });
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

  // Journal d'audit
  auditLogs: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams();
      if (params.severity) query.set('severity', params.severity);
      if (params.action)   query.set('action',   params.action);
      if (params.page)     query.set('page',     params.page);
      if (params.limit)    query.set('limit',    params.limit);
      return fetchAPI(`/admin/audit-logs?${query.toString()}`, {
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
    });
  },

  me: async () => {
    return fetchAPI('/auth/me');
  },

  // POST : une passerelle de messagerie qui inspecte le lien ne le consomme pas.
  confirmEmail: async (token) => {
    return fetchAPI(`/auth/confirm/${token}`, { method: 'POST' });
  },

  resendConfirmation: async (email) => {
    return fetchAPI('/auth/resend-confirmation', {
      method: 'POST',
      body: { email },
    });
  },

  forgotPassword: async (email) => {
    return fetchAPI('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },

  resetPassword: async (token, password) => {
    return fetchAPI('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    });
  },

  exportMe: async () => {
    return fetchAPI('/auth/me/export', {
      requiresAuth: true,
    });
  },

  deleteMe: async () => {
    return fetchAPI('/auth/me', {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};

/* Le désabonnement, vu des deux côtés de la porte.

   Les trois premières fonctions travaillent sans session : elles présentent le
   sceau reçu dans l'URL de l'email, seule pièce d'identité de quelqu'un qui a
   peut-être oublié son mot de passe. La quatrième est l'inverse — la personne
   est connectée, c'est sa session qui répond d'elle. */
export const newsletterPreferences = {
  status: async ({ u, t }) => {
    return fetchAPI(`/newsletters/unsubscribe?${new URLSearchParams({ u, t })}`);
  },

  unsubscribe: async ({ u, t }) => {
    return fetchAPI(`/newsletters/unsubscribe?${new URLSearchParams({ u, t })}`, {
      method: 'POST',
    });
  },

  resubscribe: async ({ u, t }) => {
    return fetchAPI(`/newsletters/resubscribe?${new URLSearchParams({ u, t })}`, {
      method: 'POST',
    });
  },

  setMine: async (optIn) => {
    return fetchAPI('/newsletters/preferences', {
      method: 'PUT',
      body: { optIn },
      requiresAuth: true,
    });
  },
};

const api = {
  admin,
  auth,
  newsletterPreferences,

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

    unschedule: async (id) => {
      return fetchAPI(`/newsletters/${id}/schedule`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Suivi des envois : la trace de chaque message et les adresses écartées.
  emails: {
    getLogs: async (params = {}) => {
      const query = new URLSearchParams();
      if (params.status)   query.set('status',   params.status);
      if (params.delivery) query.set('delivery', params.delivery);
      if (params.kind)     query.set('kind',     params.kind);
      if (params.email)    query.set('email',    params.email);
      if (params.probleme) query.set('probleme', 'true');
      if (params.page)     query.set('page',     params.page);
      if (params.limit)    query.set('limit',    params.limit);

      return fetchAPI(`/emails?${query.toString()}`, { requiresAuth: true });
    },

    getSummary: async () => {
      return fetchAPI('/emails/summary', { requiresAuth: true });
    },

    getSuppressions: async () => {
      return fetchAPI('/emails/suppressions', { requiresAuth: true });
    },

    liftSuppression: async (id) => {
      return fetchAPI(`/emails/suppressions/${id}`, {
        method: 'DELETE',
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

    setVolunteerStatus: async (shiftId, userId, data) => {
      return fetchAPI(`/shifts/${shiftId}/volunteers/${userId}`, {
        method: 'PUT',
        body: data,
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

    getCurrent: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return fetchAPI(`/weekly-baskets/current${queryString ? `?${queryString}` : ''}`, {
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
      return fetchAPI(`/distribution/list/${weeklyBasketId}${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    markAsPickedUp: async (pickupId, data) => {
      return fetchAPI(`/distribution/pickup/${pickupId}`, {
        method: 'PUT',
        body: data,
        requiresAuth: true,
      });
    },

    getStats: async (weeklyBasketId) => {
      return fetchAPI(`/distribution/stats/${weeklyBasketId}`, {
        requiresAuth: true,
      });
    },

    /* L'API renvoie un CSV, pas du JSON : fetchAPI ne convient pas puisqu'il
       termine par response.json(). On récupère donc la réponse brute et on la
       remet au navigateur. Passer par le serveur plutôt que fabriquer le CSV
       ici n'est pas un détail de forme : c'est là que l'export est journalisé
       et que la liste est complète, indépendamment du filtre de recherche
       affiché à l'écran. */
    export: async (weeklyBasketId) => {
      const response = await safeFetch(`${API_URL}/distribution/export/${weeklyBasketId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new ApiError(
          payload.error?.message || payload.message || 'Erreur lors de l\'export de la liste',
          response.status
        );
        if (response.status === 401) {
          redirectToExpiredSessionLogin();
        }
        throw error;
      }

      await downloadResponse(response, {
        mimeType: 'text/csv;charset=utf-8;',
        fallbackName: 'distribution.csv',
      });
    },
  },

  subscriptions: {
    // Public - grille tarifaire, calculée et servie par le serveur
    getPricing: async () => {
      return fetchAPI('/subscriptions/pricing');
    },

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

    /* Remise des chèques : c'est elle qui active l'abonnement. Elle remplace
       l'ancien « activate », qui basculait le statut sans qu'aucun règlement ne
       soit enregistré en face. Le nombre de chèques suffit — le serveur en
       déduit les montants et les échéances. */
    recordCheques: async (id, { paymentType, receivedAt, checkNumbers } = {}) => {
      return fetchAPI(`/subscriptions/${id}/cheques`, {
        method: 'POST',
        requiresAuth: true,
        body: { paymentType, receivedAt, checkNumbers },
      });
    },

    /* Tous les chèques de l'association, pour la page de trésorerie. La fiche
       d'abonnement répond « où en est ce contrat » ; celle-ci répond « qu'est-ce
       que je porte à la banque lundi ». */
    getTreasuryCheques: async () => {
      return fetchAPI('/subscriptions/cheques', {
        requiresAuth: true,
      });
    },

    /* Déplacer un chèque. Avancer — pochette vers banque, banque vers compte —
       ne demande rien. Revenir en arrière, constater un rejet ou rendre le
       chèque exige le mot de passe : ces mouvements retirent de l'argent au
       contrat ou effacent un fait déjà consigné. */
    updateCheque: async (subscriptionId, paymentId, changes) => {
      return fetchAPI(`/subscriptions/${subscriptionId}/cheques/${paymentId}`, {
        method: 'PATCH',
        requiresAuth: true,
        body: changes,
      });
    },

    cancel: async (id) => {
      return fetchAPI(`/subscriptions/${id}/cancel`, {
        method: 'PUT',
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

    getContractBlobUrl: async (id) => {
      const response = await safeFetch(`${API_URL}/subscriptions/${id}/contract`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new ApiError(
          payload.error?.message || payload.message || 'Erreur lors de la génération du contrat',
          response.status
        );
        if (response.status === 401) {
          redirectToExpiredSessionLogin();
        }
        throw error;
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
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
    // Protégé - Submit a subscription request (auth required)
    submitRequest: async (data) => {
      return fetchAPI('/subscription-requests', {
        method: 'POST',
        body: data,
        requiresAuth: true,
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

    approve: async (id, adminNotes = '') => {
      return fetchAPI(`/subscription-requests/${id}/approve`, {
        method: 'POST',
        body: { adminNotes },
        requiresAuth: true,
      });
    },

    downloadContract: async (id) => {
      const response = await safeFetch(`${API_URL}/subscription-requests/${id}/contract`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new ApiError(
          payload.error?.message || payload.message || 'Erreur lors de la génération du contrat',
          response.status
        );
        if (response.status === 401) {
          redirectToExpiredSessionLogin();
        }
        throw error;
      }

      await downloadResponse(response, {
        mimeType: 'application/pdf',
        fallbackName: 'contrat.pdf',
      });
    }
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

  // Messages de contact
  contactMessages: {
    getAll: async (filters = {}) => {
      const queryString = new URLSearchParams(filters).toString();
      return fetchAPI(`/admin/contact${queryString ? `?${queryString}` : ''}`, {
        requiresAuth: true,
      });
    },

    updateStatus: async (id, status) => {
      return fetchAPI(`/admin/contact/${id}/status`, {
        method: 'PUT',
        body: { status },
        requiresAuth: true,
      });
    },

    delete: async (id) => {
      return fetchAPI(`/admin/contact/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
    },
  },

  // Recettes
  recipes: {
    search: async (query, queryEn = null) => {
      const params = new URLSearchParams({ query });
      if (queryEn) params.set('queryEn', queryEn);
      return fetchAPI(`/recipes/search?${params}`, { requiresAuth: false });
    },

    findByIngredients: async (ingredients, queryEn = null) => {
      const params = new URLSearchParams({ ingredients });
      if (queryEn) params.set('queryEn', queryEn);
      return fetchAPI(`/recipes/ingredients?${params}`, { requiresAuth: false });
    },

    getById: async (id) => {
      return fetchAPI(`/recipes/${id}`, {
        requiresAuth: false,
      });
    },

    getSuggestions: async (weeklyBasketId) => {
      return fetchAPI(`/recipes/suggestions/weekly-basket/${weeklyBasketId}`, {
        requiresAuth: false,
      });
    },
  },
  // Chiffres publics de l'association (foyers adhérents, fermes partenaires)
  stats: {
    getPublic: async () => {
      return fetchAPI('/stats', {
        requiresAuth: false,
      });
    },
  },

  closures: {
    getAll: async () => fetchAPI('/closures', { requiresAuth: true }),

    create: async (data) => fetchAPI('/closures', {
      method: 'POST',
      body: data,
      requiresAuth: true,
    }),

    update: async (id, data) => fetchAPI(`/closures/${id}`, {
      method: 'PUT',
      body: data,
      requiresAuth: true,
    }),

    delete: async (id) => fetchAPI(`/closures/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    }),
  },
};

export default api;