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

/**
 * CTA button variants
 */
export type CTAButtonVariant = 'primary' | 'outline' | 'ghost';

/**
 * CTA button sizes
 */
export type CTAButtonSize = 'sm' | 'md' | 'lg';

/**
 * Hero section props
 */
export interface HeroSectionProps {
  className?: string;
}

/**
 * Features section props
 */
export interface FeaturesSectionProps {
  className?: string;
}

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

/**
 * Homepage page props
 */
export interface HomepageProps {
  className?: string;
}
