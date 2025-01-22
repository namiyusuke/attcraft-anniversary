export default class Observer {
  constructor(target) {
    this.observer = new IntersectionObserver(this.callback.bind(this), {
      root: null,
      rootMargin: "0px",
      threshold: 0.5,
    });
    this.targets = document.querySelectorAll(target);
    // 各要素に対してobserveを実行
    this.targets.forEach(element => {
      this.observer.observe(element);
    });
  }

  callback(entries, observer) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-shown");
      }
    });
  }
}
