/**
 * message-filter.js
 *
 * 统一的消息过滤工具入口
 * Re-export from split modules for backward compatibility
 *
 * @module core/utils/message-filter
 */

import { MessageFilter } from './message-filter/MessageFilter.js';
import { MessageTransformer } from './message-filter/MessageTransformer.js';
import { MessageAggregator } from './message-filter/MessageAggregator.js';

export { MessageFilter, MessageTransformer, MessageAggregator };

export default { MessageFilter, MessageTransformer, MessageAggregator };
