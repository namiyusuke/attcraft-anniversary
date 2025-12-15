export default class Observer {
  constructor(target, elem, flag = false, options, stagger = 0) {
    this.observer = new IntersectionObserver(this.callback.bind(this), options);
    this.targets = document.querySelectorAll(target);
    this.elem = elem;
    this.flag = flag;
    this.stagger = stagger; // 各要素間のディレイ（ミリ秒）
    this.options = {
      root: null,
      rootMargin: "0 0 -20% 0",
      threshold: 0.5,
      ...options  // 外部から渡されたオプションでデフォルト値を上書き
    };
    // 各要素にインデックスを付与
    this.targets.forEach((element, index) => {
      element._observerIndex = index;
      this.observer.observe(element);
    });
  }

  callback(entries, observer) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (this.stagger > 0) {
          const index = entry.target._observerIndex || 0;
          setTimeout(() => {
            console.log(this.stagger);
            entry.target.classList.add(this.elem);
          }, index * this.stagger);
        } else {
          entry.target.classList.add(this.elem);
        }
      } else if (this.flag) {
        entry.target.classList.remove(this.elem);
      }
    });
  }
}
