import Link from 'next/link';
import Image from 'next/image';

function BasketCard({ basket }) {
  return (
    <article className="basket-card">
      <div className="basket-card-image">
        <Image src={basket.image} alt={basket.name} width={80} height={80} className="basket-card-icon" />
      </div>
      
      <div className="basket-card-content">
        <h3 className="basket-card-title">{basket.name}</h3>
        <p className="basket-card-description">{basket.description}</p>
        
        {basket.products && basket.products.length > 0 && (
          <div className="basket-card-products">
            <h4 className="basket-card-products-title">Contenu :</h4>
            <ul className="basket-card-products-list">
              {basket.products.slice(0, 3).map((product, index) => (
                <li key={index}>
                  {product.name} ({product.quantity} {product.unit})
                </li>
              ))}
              {basket.products.length > 3 && (
                <li className="basket-card-products-more">
                  +{basket.products.length - 3} autre{basket.products.length - 3 > 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      
      <div className="basket-card-footer">
        <div className="basket-card-price-container">
          <span className="basket-card-price">{basket.price.toFixed(2)}€</span>
          <span className="basket-card-price-label">par panier</span>
        </div>
        <Link href={`/paniers/${basket.id}`} className="btn btn-primary">
          Voir détails
        </Link>
      </div>
    </article>
  );
}

export default BasketCard;