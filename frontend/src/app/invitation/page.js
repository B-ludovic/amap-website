import InviteGate from '../../components/InviteGate';

export const metadata = {
  title: 'Accès sur invitation',
  /* La porte est ce que les robots voient de toutes les URL du site tant qu'elle
     est fermée. Sans ce noindex, c'est elle qui s'indexerait à la place des pages. */
  robots: { index: false, follow: false },
};

export default function InvitationPage() {
  return <InviteGate />;
}
