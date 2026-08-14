import Link from 'next/link';
import Image from 'next/image';

/* Header réduit des pages d'authentification : la maquette y remplace la
   navigation complète par un simple retour au site. Sur l'inscription, ce
   retour cède la place au renvoi vers la connexion. */
function AuthHeader({ variant = 'back' }) {
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

        {variant === 'signin' ? (
          <div className="auth-header-signin">
            <span className="auth-header-signin-text">Déjà un compte ?</span>
            <Link href="/auth/login" className="btn btn-secondary btn-sm">
              Se connecter
            </Link>
          </div>
        ) : (
          <Link href="/" className="auth-header-back">
            <span className="auth-header-arrow" aria-hidden="true">←</span>
            <span>Retour au site</span>
          </Link>
        )}
      </div>
    </header>
  );
}

export default AuthHeader;
