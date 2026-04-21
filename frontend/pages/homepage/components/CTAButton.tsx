/**
 * CTA Button Component
 *
 * Call-to-action button component for homepage.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { CTAButtonProps } from '../types/homepage.types';

export function CTAButton({
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
}: CTAButtonProps) {
  // Base styles
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  // Size styles
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  // Variant styles
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
    outline: 'border-2 border-primary text-primary hover:bg-primary/10 focus:ring-primary',
    ghost: 'text-foreground hover:bg-accent focus:ring-accent',
  };

  const combinedClassName = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`.trim();

  // Render as Link if 'to' prop is provided
  if (to) {
    return (
      <Link to={to} className={combinedClassName} onClick={onClick}>
        {children}
      </Link>
    );
  }

  // Render as anchor tag if 'href' prop is provided
  if (href) {
    return (
      <a href={href} className={combinedClassName} onClick={onClick}>
        {children}
      </a>
    );
  }

  // Render as button
  return (
    <button className={combinedClassName} onClick={onClick}>
      {children}
    </button>
  );
}
