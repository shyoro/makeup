// GSAP with the plugins the scroll story uses, registered once. Scene scripts
// import from here, never from 'gsap' directly.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

export { gsap, ScrollTrigger, DrawSVGPlugin };
