import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";

type MediaQueryConditions = {
  isDesktop: boolean;
  isMobile: boolean;
  reduceMotion: boolean;
};

gsap.registerPlugin(CustomEase);

const mm = gsap.matchMedia();
const breakPoint = 1024;
const mediaQuery = {
  isDesktop: `(min-width: ${breakPoint}px)`,
  isMobile: `(max-width: ${breakPoint - 1}px)`,
  reduceMotion: "(prefers-reduced-motion: reduce)",
};

const logo = document.querySelector(".intro__logo");

export const loadingAnimation = async () => {
  return new Promise((resolve) => {
    mm.add(mediaQuery, (context) => {
      const { reduceMotion } = context.conditions as MediaQueryConditions;
      const tl = gsap.timeline({
        // トランジションの詳細をここに追加
        onComplete: () => {
          resolve(true);
        },
      });
    });
  });
};

export const loadingOutAnimation = async () => {
  return new Promise((resolve) => {
    mm.add(mediaQuery, (context) => {
      const { reduceMotion } = context.conditions as MediaQueryConditions;
      const tl = gsap.timeline({
        // トランジションの詳細をここに追加
        onComplete: () => {
          resolve(true);
        },
      });
    });
  });
};

export const pageTransitionOut = async () => {
  return new Promise((resolve) => {
    const tl = gsap.timeline();
    // トランジションの詳細をここに追加
    resolve(true);
  });
};

export const pageTransitionIn = async () => {
  return new Promise((resolve) => {
    const tl = gsap.timeline();
    // トランジションの詳細をここに追加
    resolve(true);
  });
};
