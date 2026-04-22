/**
 * Base Discovery Pagination
 *
 * Sorting and pagination utilities for project discovery
 *
 * @module projects/discovery/baseDiscoveryPagination
 */

// 在返回项目或会话列表前调用，根据前端请求参数进行排序和分页
/**
 * Applies pagination and sorting to items
 * @param {Array} items - Items to paginate (projects/sessions)
 * @param {Object} options - Pagination options
 * @param {string} options.sort - Sort field
 * @param {string} options.order - Sort direction (asc or desc)
 * @param {number} options.limit - Limit
 * @param {number} options.offset - Offset
 * @returns {Object} Paginated result
 */
export function applyPagination(items, options = {}) {
  const {
    sort = 'lastActivity',
    order = 'desc',
    limit,
    offset = 0
  } = options;

  // Sort
  let sorted = [...items];
  if (sort) {
    sorted.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];

      // Handle null values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Date comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        return order === 'desc' ? bDate - aDate : aDate - bDate;
      }

      // Numeric comparison
      if (order === 'desc') {
        return bVal - aVal;
      }
      return aVal - bVal;
    });
  }

  // Paginate
  const total = sorted.length;
  const paginated = limit ? sorted.slice(offset, offset + limit) : sorted.slice(offset);

  return {
    items: paginated,
    total,
    hasMore: limit ? offset + limit < total : false
  };
}
