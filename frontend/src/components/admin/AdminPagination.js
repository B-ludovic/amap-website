'use client';

/* Pagination commune à toutes les listes de l'administration.

   Elle ne s'affiche qu'au-delà d'une page : sur une liste courte, un contrôle
   inerte n'apprend rien. En revanche, dès qu'il y a plusieurs pages, il faut
   que ça se voie — une liste tronquée en silence donne à croire que la base ne
   contient que ce qui est à l'écran. */
export default function AdminPagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="admin-pager">
      <span className="admin-pager-state">
        Page {page} sur {totalPages}
      </span>
      <div className="admin-pager-controls">
        <button
          type="button"
          className="admin-btn-link"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          ← Précédent
        </button>
        <button
          type="button"
          className="admin-btn-link"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
