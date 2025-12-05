import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone } from 'lucide-react';

export default function ProducerCard({ producer }) {
  return (
    <article className="producer-card">
      <div className="producer-card-header">
        <div className="producer-card-image">
          <Image 
            src={producer.image} 
            alt={producer.name} 
            width={60} 
            height={60} 
            className="producer-card-icon" 
          />
        </div>
        <div className="producer-card-header-content">
          <h3 className="producer-card-title">{producer.name}</h3>
          {producer.specialty && (
            <span className="producer-card-specialty">{producer.specialty}</span>
          )}
        </div>
      </div>

      <div className="producer-card-body">
        <p className="producer-card-description">{producer.description}</p>
      </div>

      <div className="producer-card-footer">
        <div className="producer-card-contact">
          {producer.email && (
            <a 
              href={`mailto:${producer.email}`} 
              className="producer-card-contact-item"
              title={`Email ${producer.name}`}
            >
              <Mail size={20} className="producer-card-contact-icon" />
              <span className="producer-card-contact-text">{producer.email}</span>
            </a>
          )}
          {producer.phone && (
            <a 
              href={`tel:${producer.phone}`} 
              className="producer-card-contact-item"
              title={`Téléphone ${producer.name}`}
            >
              <Phone size={20} className="producer-card-contact-icon" />
              <span className="producer-card-contact-text">{producer.phone}</span>
            </a>
          )}
        </div>
        
        <Link href={`/producteurs/${producer.id}`} className="btn btn-outline btn-sm">
          En savoir plus
        </Link>
      </div>
    </article>
  );
}