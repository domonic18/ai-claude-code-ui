/**
 * Homepage Component
 *
 * Main landing page for the application.
 * Shows product introduction and features.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { CTAButton } from './components/CTAButton';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import type { HomepageProps } from './types/homepage.types';

export function Homepage({ className = '' }: HomepageProps) {
  const { t } = useTranslation();

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {/* Header */}
      <header className="fixed top-0 w-full bg-background/80 backdrop-blur-sm border-b z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            {t('homepage.title')}
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <CTAButton to="/login" variant="outline" size="sm">
              {t('common.login')}
            </CTAButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* CTA Section */}
      <section className="py-20 bg-accent/10">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-6">
            {t('homepage.cta.title')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('homepage.cta.description')}
          </p>
          <CTAButton to="/login" size="lg">
            {t('homepage.cta.getStarted')}
          </CTAButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>{t('homepage.footer.copyright')}</p>
        </div>
      </footer>
    </div>
  );
}
