import debounce from "../utils/debounce";

interface LoadingOptions {
  isJS?: boolean;
  isLoad?: boolean;
  isIos?: boolean;
  isResize?: boolean;
  isReduceMotion?: boolean;
  once?: boolean;
  viewport?: number;
  targetSelector?: string;
  loadingAnimation?: () => Promise<boolean>;
  loadingOutAnimation?: () => Promise<boolean>;
  pageTransitionOut?: () => Promise<boolean>;
  pageTransitionIn?: () => Promise<boolean>;
}

export default class Loading {
  private resizeTimeoutId: number | undefined;
  private loadingTimerId: number | undefined;
  private isLoaded: boolean;
  private isAnimated: boolean;
  private isVisited: boolean;
  private isIos: boolean;
  private options: LoadingOptions;
  private targetElem: HTMLElement | null;
  private event: CustomEvent;

  private defaultOptions: LoadingOptions = {
    isJS: true,
    isLoad: true,
    isIos: true,
    isResize: true,
    isReduceMotion: true,
    once: true,
    viewport: 375,
    targetSelector: "html",
    loadingAnimation: undefined,
    loadingOutAnimation: undefined,
    pageTransitionOut: undefined,
    pageTransitionIn: undefined,
  };

  constructor(options?: LoadingOptions) {
    this.resizeTimeoutId = undefined;
    this.loadingTimerId = undefined;
    this.isLoaded = false;
    this.isAnimated = false;
    this.isVisited = false;
    this.isIos = false;
    this.event = new CustomEvent("pageLoaded");
    this.options = { ...this.defaultOptions, ...options };
    this.targetElem = document.querySelector(this.options.targetSelector!);

    if (!this.targetElem) {
      return;
    }

    this._init();
  }

  private async _init() {
    if (this.options.isJS) {
      this.targetElem!.removeAttribute("data-script");
    }

    if (this.options.viewport) {
      const debouncedResize = debounce(this._setViewport.bind(this));
      this._setViewport();
      window.addEventListener("resize", debouncedResize, false);
    }

    if (this.options.once) {
      this._getVisited();
    }

    if (this.options.isLoad) {
      window.addEventListener("load", this._loading.bind(this));
    }

    if (this.options.isReduceMotion) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      (window as any).isReduceMotion = mediaQuery.matches;

      mediaQuery.addEventListener("change", () => {
        (window as any).isReduceMotion = mediaQuery.matches;
      });
    }

    if (this.options.isIos) {
      this._checkIos();
    }

    if (this.options.isResize) {
      window.addEventListener("resize", this._resize.bind(this), { passive: true });
    }

    this.isAnimated = this.options.loadingAnimation && (!this.options.once || !this.isVisited) ? await this.options.loadingAnimation() : true;

    this._checkLoaded();
  }

  private _setViewport() {
    const value = window.outerWidth > this.options.viewport! ? "width=device-width, initial-scale=1.0" : `width=${this.options.viewport}`;
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && viewport.getAttribute("content") !== value) {
      viewport.setAttribute("content", value);
    }
  }

  private async _loading() {
    await this._imageLoader();
    this.isLoaded = true;
    await this._checkLoaded();
  }

  private async _checkLoaded() {
    if (this.isAnimated && this.isLoaded) {
      if (this.options.loadingOutAnimation && (!this.options.once || !this.isVisited)) await this.options.loadingOutAnimation();
      if (this.options.once && !this.isVisited) this._setVisited();

      this.run();
    }
  }

  private async _imageLoader() {
    const img_elements = document.querySelectorAll<HTMLImageElement>("img:not([loading='lazy'])");

    if (!img_elements.length) {
      return;
    }

    let counter = 0;

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 20000);

      img_elements.forEach((imgElem) => {
        const isLoaded = imgElem.complete && imgElem.naturalHeight !== 0;

        if (isLoaded) {
          counter++;
        }

        if (counter >= img_elements.length) {
          resolve(true);
        }

        imgElem.addEventListener("load", () => {
          counter++;

          if (counter >= img_elements.length) {
            resolve(true);
          }
        });
      });
    });
  }

  private async run() {
    this.targetElem!.setAttribute("data-loaded", "");
    document.body.dispatchEvent(this.event);

    if ((window as any).isPageTransition) {
      (window as any).isPageTransition = false;
      if (this.options.pageTransitionIn) await this.options.pageTransitionIn();
    }
  }

  private _setVisited() {
    sessionStorage.setItem("isVisited", "true");
    this._getVisited();
  }

  private _getVisited() {
    this.isVisited = !!sessionStorage.getItem("isVisited");
  }

  private _checkIos() {
    this.isIos = /iP(hone|(o|a)d)/.test(navigator.userAgent) || (/iPad|Macintosh/i.test(navigator.userAgent) && "ontouchend" in document);

    if (this.isIos) {
      this.targetElem!.setAttribute("data-ios", "");
    }
  }

  private _resize() {
    this.targetElem!.setAttribute("data-resize", "");
    clearTimeout(this.resizeTimeoutId);

    this.resizeTimeoutId = window.setTimeout(() => {
      this.targetElem!.removeAttribute("data-resize");
    }, 500);
  }
}
