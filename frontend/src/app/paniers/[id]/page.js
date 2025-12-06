'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Tractor, MapPin, ShoppingCart, CreditCard } from 'lucide-react';
import { useCart } from '../../../contexts/CartContext';

function BasketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const [basket, setBasket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [availabilities, setAvailabilities] = useState([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchBasketDetail = async () => {
      setLoading(true);
      try {
        // TODO: Appeler l'API réelle
        // const response = await fetch(`http://localhost:4000/api/baskets/${params.id}`);
        // const data = await response.json();

        // Simulation avec données différentes selon l'ID
        setTimeout(() => {
          const basketsData = {
            '1': {
              id: '1',
              name: 'Panier Découverte',
              description: 'Un panier varié pour découvrir nos produits locaux. Idéal pour 2 personnes. Ce panier contient une sélection de légumes de saison cultivés avec soin par nos producteurs partenaires.',
              price: 25.00,
              image: '/icons/panier-decouverte.png',
              products: [
                {
                  product: {
                    id: 1,
                    name: 'Carottes',
                    description: 'Carottes bio croquantes et sucrées',
                    unit: 'kg',
                    origin: 'Île-de-France',
                    producer: { name: 'Ferme des Lilas', specialty: 'Légumes de saison' }
                  },
                  quantity: 1.5
                },
                {
                  product: {
                    id: 2,
                    name: 'Tomates',
                    description: 'Tomates anciennes variées',
                    unit: 'kg',
                    origin: 'Île-de-France',
                    producer: { name: 'Ferme des Lilas', specialty: 'Légumes de saison' }
                  },
                  quantity: 1.0
                },
                {
                  product: {
                    id: 3,
                    name: 'Salade',
                    description: 'Mélange de salades de saison',
                    unit: 'pièce',
                    origin: 'Île-de-France',
                    producer: { name: 'Ferme des Lilas', specialty: 'Légumes de saison' }
                  },
                  quantity: 2
                }
              ]
            },
            '2': {
              id: '2',
              name: 'Panier Famille',
              description: 'Un grand panier pour toute la famille. Idéal pour 4-5 personnes. Une sélection généreuse de légumes et fruits de saison pour des repas sains et équilibrés toute la semaine.',
              price: 45.00,
              image: '/icons/panier-famille.png',
              products: [
                {
                  product: {
                    id: 1,
                    name: 'Carottes',
                    description: 'Carottes bio croquantes et sucrées',
                    unit: 'kg',
                    origin: 'Île-de-France',
                    producer: { name: 'Ferme des Lilas', specialty: 'Légumes de saison' }
                  },
                  quantity: 2.5
                },
                {
                  product: {
                    id: 2,
                    name: 'Pommes de terre',
                    description: 'Pommes de terre Charlotte',
                    unit: 'kg',
                    origin: 'Île-de-France',
                    producer: { name: 'Ferme des Lilas', specialty: 'Légumes de saison' }
                  },
                  quantity: 3.0
                },
                {
                  product: {
                    id: 3,
                    name: 'Courgettes',
                    description: 'Courgettes vertes bio',
                    unit: 'kg',
                    origin: 'Île-de-France',
                    producer: { name: 'Ferme des Lilas', specialty: 'Légumes de saison' }
                  },
                  quantity: 1.5
                },
                {
                  product: {
                    id: 4,
                    name: 'Pommes',
                    description: 'Pommes bio variétés anciennes',
                    unit: 'kg',
                    origin: 'Normandie',
                    producer: { name: 'Les Vergers du Soleil', specialty: 'Fruits et légumes' }
                  },
                  quantity: 2.0
                },
                {
                  product: {
                    id: 5,
                    name: 'Salade',
                    description: 'Mélange de salades de saison',
                    unit: 'pièce',
                    origin: 'Île-de-France',
                    producer: { name: 'Ferme des Lilas', specialty: 'Légumes de saison' }
                  },
                  quantity: 3
                }
              ]
            },
            '3': {
              id: '3',
              name: 'Panier Fruits',
              description: 'Un panier 100% fruits de saison. Parfait pour les amateurs de fruits frais et locaux. Une sélection variée pour des desserts, goûters et smoothies délicieux.',
              price: 18.00,
              image: '/icons/panier-fruits.png',
              products: [
                {
                  product: {
                    id: 4,
                    name: 'Pommes',
                    description: 'Pommes bio variétés anciennes',
                    unit: 'kg',
                    origin: 'Normandie',
                    producer: { name: 'Les Vergers du Soleil', specialty: 'Fruits et légumes' }
                  },
                  quantity: 1.5
                },
                {
                  product: {
                    id: 6,
                    name: 'Poires',
                    description: 'Poires Williams bio',
                    unit: 'kg',
                    origin: 'Normandie',
                    producer: { name: 'Les Vergers du Soleil', specialty: 'Fruits et légumes' }
                  },
                  quantity: 1.0
                },
                {
                  product: {
                    id: 7,
                    name: 'Raisins',
                    description: 'Raisins blancs et noirs',
                    unit: 'kg',
                    origin: 'Provence',
                    producer: { name: 'Vignoble Bio du Sud', specialty: 'Fruits' }
                  },
                  quantity: 0.5
                }
              ]
            }
          };

          const basketData = basketsData[params.id];
          
          if (!basketData) {
            setBasket(null);
            setLoading(false);
            return;
          }

          setBasket({ ...basketData, isActive: true });

          // Simuler des disponibilités
          setAvailabilities([
            {
              id: 1,
              distributionDate: '2024-12-15',
              availableQuantity: 20,
              pickupLocation: {
                id: 1,
                name: 'Place du Marché - Paris',
                address: '12 Place du Marché, 75001 Paris'
              }
            },
            {
              id: 2,
              distributionDate: '2024-12-22',
              availableQuantity: 15,
              pickupLocation: {
                id: 1,
                name: 'Place du Marché - Paris',
                address: '12 Place du Marché, 75001 Paris'
              }
            }
          ]);

          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Erreur:', error);
        setLoading(false);
      }
    };

    fetchBasketDetail();
  }, [params.id]);

  // Mémoriser la disponibilité sélectionnée pour éviter les répétitions
  const selectedAvailability = useMemo(() => {
    return availabilities.find((a) => a.id.toString() === selectedDate);
  }, [availabilities, selectedDate]);

  // Quantité maximale disponible
  const maxQuantity = selectedAvailability?.availableQuantity || 99;

  const handleAddToCart = () => {
    if (!selectedDate || !selectedLocation) {
      alert('Veuillez sélectionner une date et un point de retrait');
      return;
    }

    if (quantity > maxQuantity) {
      alert(`Quantité maximale disponible : ${maxQuantity}`);
      return;
    }

    // Ajouter au panier
    addToCart({
      basketId: basket.id,
      basketName: basket.name,
      basketImage: basket.image,
      price: basket.price,
      quantity: quantity,
      availabilityId: selectedAvailability.id,
      distributionDate: selectedAvailability.distributionDate,
      pickupLocation: selectedAvailability.pickupLocation,
    });

    alert('Panier ajouté avec succès !');
  };

  const handleBuyNow = () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      router.push('/auth/login');
      return;
    }

    if (!selectedDate || !selectedLocation) {
      alert('Veuillez sélectionner une date et un point de retrait');
      return;
    }

    if (quantity > maxQuantity) {
      alert(`Quantité maximale disponible : ${maxQuantity}`);
      return;
    }

    // TODO: Rediriger vers la page de paiement
    router.push('/checkout');
  };

  if (loading) {
    return (
      <div className="basket-detail-page">
        <div className="container">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!basket) {
    return (
      <div className="basket-detail-page">
        <div className="container">
          <div className="empty-state">
            <p>Panier introuvable</p>
            <Link href="/paniers" className="btn btn-primary mt-lg">
              Retour aux paniers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="basket-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/">Accueil</Link>
          <span className="breadcrumb-separator">›</span>
          <Link href="/paniers">Nos Paniers</Link>
          <span className="breadcrumb-separator">›</span>
          <span>{basket.name}</span>
        </nav>

        {/* Contenu principal */}
        <div className="basket-detail-content">
          {/* Colonne gauche - Image et infos */}
          <div className="basket-detail-main">
            <div className="basket-detail-image">
              <Image 
                src={basket.image} 
                alt={basket.name}
                width={200}
                height={200}
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div className="basket-detail-info">
              <h1 className="basket-detail-title">{basket.name}</h1>
              <p className="basket-detail-description">{basket.description}</p>

              {/* Composition */}
              <div className="basket-composition">
                <h2 className="basket-section-title">Composition du panier</h2>
                <div className="basket-products-list">
                  {basket.products.map((item, index) => (
                    <div key={index} className="basket-product-item">
                      <div className="basket-product-info">
                        <h3 className="basket-product-name">{item.product.name}</h3>
                        <p className="basket-product-description">
                          {item.product.description}
                        </p>
                        <div className="basket-product-meta">
                          <span className="basket-product-producer">
                            <Tractor size={16} /> {item.product.producer.name}
                          </span>
                          <span className="basket-product-origin">
                            <MapPin size={16} /> {item.product.origin}
                          </span>
                        </div>
                      </div>
                      <div className="basket-product-quantity">
                        {item.quantity} {item.product.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite - Commander */}
          <div className="basket-detail-sidebar">
            <div className="basket-order-card">
              <div className="basket-order-price">
                <span className="basket-order-price-amount">{basket.price.toFixed(2)}€</span>
                <span className="basket-order-price-label">par panier</span>
              </div>

              {/* Sélection date */}
              <div className="form-group">
                <label htmlFor="date" className="form-label">
                  Date de distribution
                </label>
                {availabilities.length === 0 ? (
                  <p className="empty-message">Aucune distribution disponible pour le moment</p>
                ) : (
                  <select
                    id="date"
                    className="select"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  >
                    <option value="">Choisir une date</option>
                    {availabilities.map((avail) => (
                      <option key={avail.id} value={avail.id}>
                        {new Date(avail.distributionDate).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long'
                        })} ({avail.availableQuantity} disponibles)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Sélection point de retrait */}
              {selectedDate && selectedAvailability && (
                <div className="form-group">
                  <label htmlFor="location" className="form-label">
                    Point de retrait
                  </label>
                  <select
                    id="location"
                    className="select"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                  >
                    <option value="">Choisir un point de retrait</option>
                    <option value={selectedAvailability.pickupLocation.id}>
                      {selectedAvailability.pickupLocation.name}
                    </option>
                  </select>
                  {selectedLocation && (
                    <p className="pickup-address">
                      {selectedAvailability.pickupLocation.address}
                    </p>
                  )}
                </div>
              )}

              {/* Quantité */}
              <div className="form-group">
                <label htmlFor="quantity" className="form-label">
                  Quantité {selectedDate && `(max: ${maxQuantity})`}
                </label>
                <div className="quantity-selector">
                  <button
                    type="button"
                    className="quantity-btn"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    id="quantity"
                    className="quantity-input"
                    value={quantity}
                    min="1"
                    max={maxQuantity}
                    readOnly
                  />
                  <button
                    type="button"
                    className="quantity-btn"
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="basket-order-total">
                <span>Total</span>
                <span className="basket-order-total-amount">
                  {(basket.price * quantity).toFixed(2)}€
                </span>
              </div>

              {/* Boutons */}
              <div className="basket-order-actions">
                <button
                  onClick={handleBuyNow}
                  className="btn btn-primary btn-lg"
                >
                  <CreditCard size={20} />
                  Commander maintenant
                </button>
                <button
                  onClick={handleAddToCart}
                  className="btn btn-outline btn-lg"
                >
                  <ShoppingCart size={20} />
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BasketDetailPage;