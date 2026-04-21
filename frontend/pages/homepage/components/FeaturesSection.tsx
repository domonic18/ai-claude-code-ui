/**
 * Features Section Component
 *
 * Features showcase section for the homepage.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FeaturesSectionProps } from '../types/homepage.types';

interface FeatureItem {
  key: string;
  icon: string;
}

const featureItems: FeatureItem[] = [
  { key: 'chat', icon: '💬' },
  { key: 'collaboration', icon: '👥' },
  { key: 'multiModel', icon: '🤖' },
  { key: 'fileManager', icon: '📁' },
  { key: 'terminal', icon: '⚡' },
  { key: 'tasks', icon: '✅' },
];

export function FeaturesSection({ className = '' }: FeaturesSectionProps) {
  const { t } = useTranslation();

  return (
    <section className={`py-20 px-4 bg-muted/30 ${className}`}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t('homepage.features.title')}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featureItems.map((feature) => (
            <div
              key={feature.key}
              className="p-6 bg-card rounded-lg border hover:shadow-lg transition-shadow duration-200"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">
                {t(`homepage.features.${feature.key}.title`)}
              </h3>
              <p className="text-muted-foreground">
                {t(`homepage.features.${feature.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
