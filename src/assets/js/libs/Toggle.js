export default class Toggle {
  constructor(ele, options, callback) {
    this.DOM = {};
    this.DOM.btn = document.querySelectorAll(ele);
    this.DOM.target = document.querySelector("html");
    this.DOM.acordionPanels = [];

    this.defaultOptions = {
      focusTarget: false,
      hiddenTarget: false,
      overlay: false,
      relation: false,
      mobileOnly: false,
      focusOut: false,
      label: false,
      isCloseBody: false,
      acordion: false,
      breakPoint: 1024,
    };
    this.options = Object.assign(this.defaultOptions, options);

    this.elem = ele;
    this.objectName = ele.substring(4);
    this.callback = callback;

    // Turbo Drive
    if (window.Turbo) {
      document.documentElement.addEventListener("turbo:before-visit", this._close.bind(this));
    }

    this._init();
  }

  _init() {
    // フォーカス
    if (this.options.focusTarget !== false) {
      this.DOM.focusTarget = document.querySelector(this.options.focusTarget);
    }

    // リレーション
    if (this.options.relation !== false) {
      if (Array.isArray(this.options.relation)) {
        this.DOM.relation = [];
        this.relationObjectName = [];
        this.options.relation.forEach((val) => {
          this.DOM.relation.push(document.querySelector(val));
          this.relationObjectName.push(val.substring(4));
        });
      } else {
        this.DOM.relation = document.querySelector(this.options.relation);
        this.relationObjectName = this.options.relation.substring(4);
      }
    }

    // aria-hidden
    if (this.options.hiddenTarget !== false) {
      this.DOM.hiddenTarget = document.querySelector(this.options.hiddenTarget);
    }

    // Toggle
    if (this.DOM.btn !== null) {
      this.DOM.btn.forEach((elem) => {
        elem.addEventListener("click", this._toggle.bind(this), { passive: true });
      });
    }

    // bodyで閉じるボタン
    if (this.options.isCloseBody) {
      document.body.addEventListener("click", this._closePanel.bind(this), { passive: true });
    }

    // リサイズでPCサイズになったら閉じる
    if (this.options.mobileOnly) {
      this.mediaQuery = window.matchMedia(`(min-width: ${this.options.breakPoint}px)`);
      this.mediaQuery.addEventListener("change", this._handleMobileChange.bind(this));
      this._handleMobileChange(this.mediaQuery);
    }

    this._close();
  }

  _toggle(e) {
    const isExpanded = e.currentTarget.getAttribute("aria-expanded") !== "false";
    const buttons = document.querySelectorAll(`[aria-controls="${e.currentTarget.getAttribute("aria-controls")}"]`);

    // aria-expanded
    buttons.forEach((el) => {
      el.setAttribute("aria-expanded", !isExpanded);
    });

    // コントール対象取得のaria-hiddenの操作
    this.DOM.controls = document.querySelector(`#${e.currentTarget.getAttribute("aria-controls")}`);
    if (this.DOM.controls.getAttribute("aria-hidden") !== null) {
      this.DOM.controls.setAttribute("aria-hidden", isExpanded);
    }

    // コントール対象取得の data-active属性
    if (this.DOM.controls.getAttribute("data-active") !== null) {
      this.DOM.controls.setAttribute("data-active", !isExpanded);
    }

    // フォーカスを外す
    if (this.options.focusOut) {
      e.currentTarget.blur();
    }

    // ラベルの付け替え
    if (this.options.label) {
      const label = isExpanded ? this.options.label.open : this.options.label.close;
      e.currentTarget.querySelector(this.options.label.el).innerText = label;
    }

    this.DOM.target.classList.toggle(`is-${this.objectName}Active`);

    // relation
    if (this.options.relation !== false) {
      if (Array.isArray(this.options.relation)) {
        this.DOM.relation.forEach((val, i) => {
          if (val !== null) {
            val.setAttribute("aria-expanded", !isExpanded);
            this.DOM.target.classList.remove(`is-${this.relationObjectName[i]}Active`);
          }
        });
      } else {
        this.DOM.relation.setAttribute("aria-expanded", !isExpanded);
        this.DOM.target.classList.remove(`is-${this.relationObjectName}Active`);
      }
    }

    // aria-hidden
    if (this.options.hiddenTarget !== false) {
      this.DOM.hiddenTarget.setAttribute("aria-hidden", !!isExpanded);
    }

    // フォーカス
    if (this.options.focusTarget !== false && !isExpanded) {
      this.DOM.focusTarget.focus();
    }

    // オーバーレイ
    if (this.options.overlay) {
      document.documentElement.classList.toggle("is-overlay");
      document.documentElement.classList.toggle("is-noScrolling");
    }

    // コールバック
    if (this.callback) {
      this.callback(this.DOM.controls, !isExpanded);
    }
  }

  _closePanel(e) {
    if (!this.DOM.controls) {
      return;
    }

    const hasClass = e.path.filter((el) => {
      return el.classList && (el.classList.contains(this.DOM.controls.classList.value) || el.classList.contains(this.elem.substring(1)));
    });

    if (hasClass.length) {
      return;
    }

    this._close();
  }

  _close() {
    if (!this.DOM.controls) {
      return;
    }
    const id = this.DOM.controls.getAttribute("id");
    const btns = document.querySelectorAll(`[aria-controls="${id}"]`);
    btns.forEach((btn) => {
      btn.setAttribute("aria-expanded", false);

      // ラベルの付け替え
      if (this.options.label) {
        btn.querySelector(this.options.label.el).innerText = this.options.label.open;
      }
    });

    if (this.DOM.controls.getAttribute("aria-hidden") !== null) {
      this.DOM.controls.setAttribute("aria-hidden", true);
    }

    if (this.DOM.controls.getAttribute("data-active") !== null) {
      this.DOM.controls.setAttribute("data-active", false);
    }

    this.DOM.target.classList.remove(`is-${this.objectName}Active`);

    // コールバック
    if (this.callback) {
      this.callback(this.DOM.controls, false);
    }
  }

  _handleMobileChange(e) {
    if (e.matches) {
      this._close();
    }
  }
}
