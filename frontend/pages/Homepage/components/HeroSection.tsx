/**
 * Hero Section Component
 *
 * Main hero section for the homepage.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CTAButton } from './CTAButton';
import type { HeroSectionProps } from '../types/homepage.types';

export function HeroSection({ className = '' }: HeroSectionProps) {
  const { t } = useTranslation();

  return (
    <section className={`pt-32 pb-20 px-4 ${className}`}>
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          {t('homepage.title')}
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          {t('homepage.subtitle')}
        </p>
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
          {t('homepage.description')}
        </p>
        <CTAButton to="/login" size="lg">
          {t('homepage.cta.login')}
        </CTAButton>
      </div>
    </section>
  );
}
