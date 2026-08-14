import Link from 'next/link';
import Image from 'next/image';

/* Header réduit des pages d'authentification : la maquette y remplace la
   navigation complète par un simple retour au site. */
function AuthHeader() {
  return (
    <header className="auth-header-bar">
      <div className="container auth-header-inner">
        <Link href="/" className="header-logo">
          <Image
            src="/icons/logo.png"
            alt="Logo Aux P'tits Pois"
            width={42}
            height={42}
            className="logo-icon"
          />
          <span className="logo-text">Aux P&apos;tits Pois</span>
        </Link>

        <Link href="/" className="auth-header-back">
          <span className="auth-header-arrow" aria-hidden="true">←</span>
          <span>Retour au site</span>
        </Link>
      </div>
    </header>
  );
}

export default AuthHeader;
