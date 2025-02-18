export default class Observer {
  constructor(target, elem, flag = false, options,) {
    this.observer = new IntersectionObserver(this.callback.bind(this), options);
    this.targets = document.querySelectorAll(target);
    this.elem = elem;
    this.flag = flag;
    this.options = {
      root: null,
      rootMargin: "0px",
      threshold: 0.5,
      ...options  // 外部から渡されたオプションでデフォルト値を上書き
    };
    // 各要素に対してobserveを実行
    this.targets.forEach(element => {
      this.observer.observe(element);
    });
  }

  callback(entries, observer) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add(this.elem);
      } else if (this.flag) {
        entry.target.classList.remove(this.elem);
      }
    });
  }
}
