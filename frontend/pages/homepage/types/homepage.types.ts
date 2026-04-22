/**
 * Homepage Types
 *
 * Type definitions for homepage components.
 */

/**
 * Feature card data structure
 */
export interface Feature {
  key: string;
  icon: string;
  title: string;
  description: string;
}

// CTAButtonVariant 的类型别名定义
/**
 * CTA button variants
 */
export type CTAButtonVariant = 'primary' | 'outline' | 'ghost';

// CTAButtonSize 的类型别名定义
/**
 * CTA button sizes
 */
export type CTAButtonSize = 'sm' | 'md' | 'lg';

// HeroSectionProps 的类型定义
/**
 * Hero section props
 */
export interface HeroSectionProps {
  className?: string;
}

// FeaturesSectionProps 的类型定义
/**
 * Features section props
 */
export interface FeaturesSectionProps {
  className?: string;
}

// CTAButtonProps 的类型定义
/**
 * CTA button props
 */
export interface CTAButtonProps {
  to?: string;
  href?: string;
  variant?: CTAButtonVariant;
  size?: CTAButtonSize;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

// HomepageProps 的类型定义
/**
 * Homepage page props
 */
export interface HomepageProps {
  className?: string;
}
