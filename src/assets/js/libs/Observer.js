export default class Observer {
  constructor(target, elem, flag = false, options, stagger = 0) {
    this.observer = new IntersectionObserver(this.callback.bind(this), options);
    this.targets = document.querySelectorAll(target);
    this.elem = elem;
    this.flag = flag;
    this.stagger = stagger; // 各要素間のディレイ（ミリ秒）
    this.options = {
      root: null,
      rootMargin: "0 0 -50% 0",
      threshold: 0.1,
      ...options  // 外部から渡されたオプションでデフォルト値を上書き
    };
    // 各要素にインデックスを付与
    this.targets.forEach((element, index) => {
      element._observerIndex = index;
      this.observer.observe(element);
    });
  }

  callback(entries, observer) {
    // 画面に入った要素だけをフィルタリングし、DOM順にソート
    const intersectingEntries = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => (a.target._observerIndex || 0) - (b.target._observerIndex || 0));

    intersectingEntries.forEach((entry, index) => {
      if (this.stagger > 0) {
        // 最初の要素にも遅延を入れて均等なリズムに
        setTimeout(() => {
          entry.target.classList.add(this.elem);
        }, (index + 1) * this.stagger);
      } else {
        entry.target.classList.add(this.elem);
      }
    });

    // 画面外に出た要素の処理
    entries.forEach((entry) => {
      if (!entry.isIntersecting && this.flag) {
        entry.target.classList.remove(this.elem);
      }
    });
  }
}
