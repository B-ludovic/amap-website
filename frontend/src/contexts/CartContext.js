'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger le panier depuis localStorage au montage
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error);
      }
    }
    setIsLoading(false);
  }, []);

  // Sauvegarder le panier dans localStorage à chaque modification
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('cart', JSON.stringify(cart));
    }
  }, [cart, isLoading]);

  // Ajouter un article au panier
  const addToCart = (item) => {
    // Validation des champs requis
    if (!item.basketId || !item.price || !item.quantity || !item.availabilityId) {
      console.error('Item invalide:', item);
      return;
    }

    setCart((prevCart) => {
      // Vérifier si l'article existe déjà (même panier, même date, même lieu)
      const existingItem = prevCart.find(
        (cartItem) =>
          cartItem.basketId === item.basketId &&
          cartItem.availabilityId === item.availabilityId
      );

      if (existingItem) {
        // Mettre à jour la quantité
        return prevCart.map((cartItem) =>
          cartItem.id === existingItem.id
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        );
      } else {
        // Ajouter le nouvel article avec un ID unique
        const newItem = {
          ...item,
          id: `${item.basketId}-${item.availabilityId}-${Date.now()}`
        };
        return [...prevCart, newItem];
      }
    });
  };

  // Retirer un article du panier
  const removeFromCart = (itemId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  // Mettre à jour la quantité d'un article
  const updateQuantity = (itemId, quantity) => {
    if (quantity < 1) {
      removeFromCart(itemId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  // Vider le panier
  const clearCart = () => {
    setCart([]);
  };

  // Calculer le total du panier
  const getTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  // Compter le nombre d'articles dans le panier
  const getItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotal,
    getItemCount,
    isLoading,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé dans un CartProvider');
  }
  return context;
}

export { useCart, CartProvider };