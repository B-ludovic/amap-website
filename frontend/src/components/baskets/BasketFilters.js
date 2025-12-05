function BasketFilters({ filters, onFilterChange }) {
  return (
    <div className="basket-filters">
      <div className="filter-group">
        <label htmlFor="priceRange" className="filter-label">
          Prix
        </label>
        <select
          id="priceRange"
          className="filter-select"
          value={filters.priceRange}
          onChange={(e) => onFilterChange({ priceRange: e.target.value })}
        >
          <option value="all">Tous les prix</option>
          <option value="0-20">Moins de 20€</option>
          <option value="20-40">20€ - 40€</option>
          <option value="40+">Plus de 40€</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="sortBy" className="filter-label">
          Trier par
        </label>
        <select
          id="sortBy"
          className="filter-select"
          value={filters.sortBy}
          onChange={(e) => onFilterChange({ sortBy: e.target.value })}
        >
          <option value="name">Nom</option>
          <option value="price-asc">Prix croissant</option>
          <option value="price-desc">Prix décroissant</option>
        </select>
      </div>
    </div>
  );
}

export default BasketFilters;