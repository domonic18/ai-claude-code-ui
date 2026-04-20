/**
 * fileFormatters.ts
 *
 * 文件格式化辅助函数
 * 提供文件大小、时间和类型格式化工具
 */

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @param units - 单位数组
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number | undefined, units: string[]): string {
  if (!bytes || bytes === 0) return `0 ${units[0]}`;
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

/**
 * 格式化相对时间
 * @param date - 日期字符串或Date对象
 * @param t - 翻译函数
 * @returns 相对时间字符串
 */
export function formatRelativeTime(
  date: string | Date | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!date) return '-';
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return t('fileExplorer.time.justNow');
  if (diffInSeconds < 3600) return t('fileExplorer.time.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
  if (diffInSeconds < 86400) return t('fileExplorer.time.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
  if (diffInSeconds < 2592000) return t('fileExplorer.time.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
  return past.toLocaleDateString();
}

/**
 * 检查是否为图片文件
 * @param filename - 文件名
 * @returns 是否为图片
 */
export function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  return ext ? imageExtensions.includes(ext) : false;
}
