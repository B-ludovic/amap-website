import ProducerSpaceShell from '../../components/producer/ProducerSpaceShell';

export const metadata = {
  title: 'Espace producteur',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EspaceProducteurLayout({ children }) {
  return <ProducerSpaceShell>{children}</ProducerSpaceShell>;
}
