/**
 * Container Statistics Extractors
 *
 * Helper functions for extracting network and disk statistics from container data.
 *
 * @module container/core/containerStatsExtractors
 */

/**
 * From network data extract network statistics
 * @param {object} networks - Network data object
 * @returns {object} Formatted network statistics
 */
export function extractNetworkStats(networks) {
  const result = {};

  for (const [name, data] of Object.entries(networks)) {
    result[name] = {
      rxBytes: data.rx_bytes || 0,
      txBytes: data.tx_bytes || 0,
      rxDropped: data.rx_dropped || 0,
      txDropped: data.tx_dropped || 0,
      rxErrors: data.rx_errors || 0,
      txErrors: data.tx_errors || 0
    };
  }

  return result;
}

/**
 * From disk I/O data extract disk statistics
 * @param {Array} ioRecursive - I/O service bytes recursive array
 * @returns {object} Formatted disk I/O statistics
 */
export function extractDiskStats(ioRecursive) {
  const result = {
    readBytes: 0,
    writeBytes: 0,
    readCount: 0,
    writeCount: 0
  };

  for (const entry of ioRecursive) {
    switch (entry.op) {
      case 'Read':
        result.readBytes = entry.value || 0;
        break;
      case 'Write':
        result.writeBytes = entry.value || 0;
        break;
      case 'Sync':
        // Sync operations are handled separately
        break;
      default:
        break;
    }
  }

  return result;
}
