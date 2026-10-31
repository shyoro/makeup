import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { PageSection } from '../../lib/sanity/types';
import Hero from './Hero.astro';
import Portfolio from './Portfolio.astro';

// Section _type → scene component. Adding a section type means one entry
// here plus its component; the page order itself is data.
export const sectionRegistry: Record<
  PageSection['_type'],
  AstroComponentFactory
> = {
  hero: Hero,
  portfolio: Portfolio,
};
