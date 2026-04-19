/**
 * Pagination Utility
 *
 * Utility functions for applying pagination and sorting to data arrays.
 *
 * @module controllers/utils/pagination
 */

/**
 * Apply pagination and sorting to an array of items
 *
 * @param {Array} items - Array of items to paginate and sort
 * @param {Object} options - Pagination and sorting options
 * @param {string} [options.sort='lastActivity'] - Field to sort by
 * @param {string} [options.order='desc'] - Sort order ('asc' or 'desc')
 * @param {number} [options.limit=50] - Maximum number of items to return
 * @returns {Object} Object containing paginated items and metadata
 * @returns {Array} returns.items - Paginated array of items
 * @returns {Object} returns.meta - Metadata about pagination
 * @returns {Object} returns.meta.pagination - Pagination details
 * @returns {number} returns.meta.pagination.page - Current page number (always 1 for this implementation)
 * @returns {number} returns.meta.pagination.limit - Number of items per page
 * @returns {number} returns.meta.pagination.total - Total number of items
 * @returns {boolean} returns.meta.pagination.hasMore - Whether there are more items
 */
export function applyPagination(items, options = {}) {
  const { sort = 'lastActivity', order = 'desc', limit = 50 } = options;

  let sorted = [...items];
  if (sort) {
    sorted.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        return order === 'desc' ? bDate - aDate : aDate - bDate;
      }

      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }

  const total = sorted.length;
  const paginated = sorted.slice(0, limit);

  return {
    items: paginated,
    meta: {
      pagination: {
        page: 1,
        limit,
        total,
        hasMore: limit < total
      }
    }
  };
}

export default applyPagination;
