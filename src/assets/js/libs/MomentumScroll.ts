import Lenis, { type LenisOptions } from "lenis";

const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

export default class MomentumScroll {
  lenis: Lenis;
  linkEls: NodeListOf<HTMLElement>;
  animationFrameId: number;
  options: LenisOptions | undefined;


  constructor(options?: LenisOptions) {
    this.lenis = new Lenis(options);
    this.linkEls = document.querySelectorAll('a[href^="#"]');
    this.animationFrameId = 0;
    this.options = options;

    mediaQuery.addEventListener("change", this._changeReducedMotion.bind(this));

    this.linkEls?.forEach((el) => {
      el.addEventListener("click", this._pageLink.bind(this));
    });

    if (!mediaQuery.matches) {
      this._run();
    }
  }


  private _raf(time: number) {
    this.lenis?.raf(time);
    this.animationFrameId = requestAnimationFrame(this._raf.bind(this));
  }

  private _run() {
    this.animationFrameId = requestAnimationFrame(this._raf.bind(this));
  }

  private _changeReducedMotion() {
    if (mediaQuery.matches) {
      cancelAnimationFrame(this.animationFrameId);
      this.lenis.destroy();
    } else {
      this.lenis = new Lenis(this.options);
      this._run();
    }
  }

  private _pageLink(e: Event) {
    if (!( e.currentTarget instanceof HTMLElement)) {
      console.error(`${ e.currentTarget}がHTMLElementではありません`);
      return;
    }

    const anchor = e.currentTarget?.getAttribute("href");
    this.lenis?.scrollTo(anchor!);
  }

  stop() {
    this.lenis?.stop();
  }

  start() {
    this.lenis?.start();
  }

  scrollTo(anchor: string | number | HTMLElement) {
    this.lenis?.scrollTo(anchor);
  }

}
