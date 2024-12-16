import gsap from "gsap";

interface options {
  duration?: number,
  ease?: string
}

export default class Accordion {
  els: NodeListOf<HTMLElement>;
  options: options;

  constructor(els: string, options?: options) {
    this.els = document.querySelectorAll<HTMLElement>(els);

    const defaultOptions = {
      duration: 0.4,
      ease: "power3.out",
    };

    this.options = Object.assign(defaultOptions, options);


    this._init();
  }

  _init() {
    this.els?.forEach((el) => {

      if (!(el instanceof HTMLElement)) {
        console.error(`${el}がHTMLElementではありません`);
        return;
      }

      const trigger = el.querySelector('[data-accordion-trigger]');
      const content = el.querySelector('[data-accordion-content]');

      if (!(content instanceof HTMLElement)) {
        console.error(`${content}がHTMLElementではありません`);
        return;
      }

      content.style.overflow = 'hidden';

      trigger?.addEventListener("click", (e) => {
        e.preventDefault();

        if ("open" in el.dataset) {

          delete el.dataset.open;


          // アニメーション実行
          this.close(content as HTMLElement, el);
        } else {


          el.setAttribute("open", "");
          el.setAttribute("data-open", "");

          // アニメーション実行
          this.open(content as HTMLElement);
        }
      });

    });

  }

  open(content: HTMLElement) {
    gsap.fromTo(
      content,
      {
        height: 0,
        opacity: 0,
      },
      {
        height: "auto",
        opacity: 1,
        duration: this.options.duration,
        ease: this.options.ease,
        overwrite: true,
      }).restart();
  }

  close(content: HTMLElement, el: HTMLElement) {
    gsap.to(content, {
      height: 0,
      opacity: 0,
      duration: this.options.duration,
      ease: this.options.ease,
      overwrite: true,
      onComplete: () => {
        el.removeAttribute("open");
      },
    }).restart();
  }
}
