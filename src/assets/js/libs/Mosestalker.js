// マウスストーカー用
// グローバルイベントが設定済みかどうかのフラグ
let globalEventsInitialized = false;

export default class Stalker {
  constructor(target) {
    this.mouseStalkerClass = "js-mouse-stalker";
    this.mouseCursorClass = "js-mouse-stalker__cursor";
    this.mouseTarget = "js-link";
    this.mouseFollowerClass = "js-mouse-stalker__follower";
    this.hoverClass = "is-hover";
    this.dragClass = "is-drag";
    this.target = "js-img";

    const _ua = this._ua(window.navigator.userAgent.toLowerCase());

    if (!_ua.Mobile && !_ua.Tablet) {
      this.mouseStalker();
    }
  }

  mouseStalker() {
    const stalker = document.querySelector("." + this.mouseStalkerClass);
    const cursor = document.querySelector("." + this.mouseCursorClass);
    const follower = document.querySelector("." + this.mouseFollowerClass);
    const links = document.querySelectorAll("." + this.mouseTarget);
    const swipers = document.querySelectorAll(".swiper-container:not(.no-drag)");

    const cursorWidth = 20;
    let mouseX = 0;
    let mouseY = 0;

    // グローバルイベントは一度だけ設定
    if (stalker && !globalEventsInitialized) {
      globalEventsInitialized = true;

      document.addEventListener("mousemove", (e) => {
        // stalker.style.opacity = 1;
        stalker.style.transform = "scale(" + 1 + ")";
        stalker.style.transformOrigin = e.clientX + "px " + e.clientY + "px";
        mouseX = e.clientX;
        mouseY = e.clientY;

        cursor.style.transform =
          "translate(" + parseInt(mouseX - cursorWidth / 2) + "px," + parseInt(mouseY - cursorWidth / 2) + "px)";
      });

      document.addEventListener("mouseleave", (e) => {
        // stalker.style.opacity = 0;
        stalker.style.transform = "scale(" + 0 + ")";
                stalker.style.transformOrigin = e.clientX + "px " + e.clientY + "px";
      });

      document.addEventListener("mouseenter", (e) => {
        // stalker.style.opacity = 1;
        stalker.style.transform = "scale(" + 1 + ")";
        stalker.style.transformOrigin = e.clientX + "px " + e.clientY + "px";
      });
    }

    const linkEnter = (el, imageSrc) => {
      if (stalker) {
        el.addEventListener("mouseenter", (e) => {
          if (!stalker.classList.contains(this.dragClass)) {
            stalker.classList.add(this.hoverClass);
            // 画像がある場合はカーソルに表示
            if (imageSrc && cursor) {
              cursor.style.backgroundImage = `url(${imageSrc})`;
              cursor.style.backgroundSize = "cover";
              cursor.style.backgroundPosition = "center";
            }
          }
        });
      }
    };

    const linkLeave = (el) => {
      if (stalker) {
        el.addEventListener("mouseleave", (e) => {
          stalker.classList.remove(this.hoverClass);
          // トランジション完了後に画像をクリア（CSSのtransition-durationに合わせて900ms）
          if (cursor) {
            setTimeout(() => {
              // ホバー中でなければ画像をクリア
              if (!stalker.classList.contains(this.hoverClass)) {
                cursor.style.backgroundImage = "";
              }
            }, 900);
          }
        });
      }
    };

    const swiperEnter = (el) => {
      if (stalker) {
        el.addEventListener("mouseenter", (e) => {
          stalker.classList.add(this.dragClass);
        });
      }
    };

    const swiperLeave = (el) => {
      if (stalker) {
        el.addEventListener("mouseleave", (e) => {
          stalker.classList.remove(this.dragClass);
        });
      }
    };

    if (stalker) {
      if (links.length > 0) {
        links.forEach((element) => {
          // 既にイベントリスナーが設定されている場合はスキップ
          if (element.dataset.stalkerInitialized) return;
          element.dataset.stalkerInitialized = "true";

          // data-src属性を持つ子要素、または要素自体のdata-srcを取得
          const imageEl = element.querySelector("[data-src]");
          const imageSrc = imageEl ? imageEl.getAttribute("data-src") : element.getAttribute("data-src");

          linkEnter(element, imageSrc);
          linkLeave(element);
        });
      }
      if (swipers.length > 0) {
        swipers.forEach((element) => {
          // 既にイベントリスナーが設定されている場合はスキップ
          if (element.dataset.stalkerInitialized) return;
          element.dataset.stalkerInitialized = "true";

          swiperEnter(element);
          swiperLeave(element);
        });
      }
    }
  }

  _ua(u) {
    return {
      Tablet:
        (u.indexOf("windows") != -1 && u.indexOf("touch") != -1 && u.indexOf("tablet pc") == -1) ||
        u.indexOf("ipad") != -1 ||
        (u.indexOf("android") != -1 && u.indexOf("mobile") == -1) ||
        (u.indexOf("firefox") != -1 && u.indexOf("tablet") != -1) ||
        u.indexOf("kindle") != -1 ||
        u.indexOf("silk") != -1 ||
        u.indexOf("playbook") != -1 ||
        (u.indexOf("macintosh") > -1 && "ontouchend" in document),
      Mobile:
        (u.indexOf("windows") != -1 && u.indexOf("phone") != -1) ||
        u.indexOf("iphone") != -1 ||
        u.indexOf("ipod") != -1 ||
        (u.indexOf("android") != -1 && u.indexOf("mobile") != -1) ||
        (u.indexOf("firefox") != -1 && u.indexOf("mobile") != -1) ||
        u.indexOf("blackberry") != -1,
    };
  }
}
