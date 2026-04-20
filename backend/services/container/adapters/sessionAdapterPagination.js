/**
 * Session Adapter Pagination Utilities
 *
 * Sorting and pagination utilities for session adapter
 *
 * @module container/adapters/sessionAdapterPagination
 */

/**
 * Sorts sessions by last activity (most recent first)
 * @param {Array} sessions - Sessions array
 * @returns {Array} Sorted sessions
 */
export function sortSessionsByActivity(sessions) {
  return sessions.sort((a, b) =>
    new Date(b.lastActivity) - new Date(a.lastActivity)
  );
}

/**
 * Sorts messages by timestamp (oldest first)
 * @param {Array} messages - Messages array
 * @returns {Array} Sorted messages
 */
export function sortMessagesByTimestamp(messages) {
  return messages.sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });
}

/**
 * Applies pagination to an array
 * @param {Array} items - Items to paginate
 * @param {number} offset - Offset
 * @param {number} limit - Limit
 * @returns {Object} Paginated result
 */
export function paginate(items, offset, limit) {
  const total = items.length;
  const paginated = items.slice(offset, offset + limit);

  return {
    total,
    hasMore: offset + limit < total,
    items: paginated
  };
}

/**
 * Searches sessions by query
 * @param {Array} sessions - Sessions array
 * @param {string} query - Search query
 * @param {number} limit - Result limit
 * @returns {Object} Search results
 */
export function searchSessions(sessions, query, limit) {
  const queryLower = query.toLowerCase();

  const results = sessions.filter(session => {
    const summaryLower = (session.summary || '').toLowerCase();
    const lastMessageLower = (session.lastUserMessage || '').toLowerCase();
    return summaryLower.includes(queryLower) || lastMessageLower.includes(queryLower);
  });

  return {
    query,
    sessions: results.slice(0, limit),
    total: results.length
  };
}
