// 必要なモジュールを読み込み
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// アプリケーションの初期化関数
let currentApp = null;

async function initApp() {
  // #webgl要素が存在する場合のみ初期化
  const webglElement = document.querySelector('#webgl');
  if (!webglElement) return;

  // 既存のアプリがあれば破棄
  if (currentApp) {
    currentApp.dispose();
  }

  currentApp = new App3();
  await currentApp.load();
  currentApp.init();
  currentApp.render();
}

// DOM がパースされたことを検出するイベントで App3 クラスをインスタンス化する
window.addEventListener('DOMContentLoaded', initApp, false);

// Swupのページ遷移後にも再初期化
window.addEventListener('swup:pageview', initApp, false);

/**
 * 紙めくりスライダーアプリケーション
 */
class App3 {
  /**
   * カメラ定義のための定数
   */
  static get CAMERA_PARAM() {
    return {
      fovy: 60,
      aspect: window.innerWidth / window.innerHeight,
      near: 0.1,
      far: 10.0,
    };
  }
  /**
   * レンダラー定義のための定数
   */
  static get RENDERER_PARAM() {
    return {
      clearColor: 0xffffff,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }
  /**
   * アンビエントライト定義のための定数
   */
  static get AMBIENT_LIGHT_PARAM() {
    return {
      color: 0xffffff,
      intensity: 1.0,
    };
  }

  /**
   * コンストラクタ
   * @constructor
   */
  constructor() {
    this.renderer;         // レンダラ
    this.scene;            // シーン
    this.camera;           // カメラ
    this.ambientLight;     // アンビエントライト
    this.controls;         // オービットコントロール

    // Raycaster のインスタンスを生成する
    this.raycaster = new THREE.Raycaster();
    // 再利用可能なベクトル（パフォーマンス最適化）
    this._tempVec2 = new THREE.Vector2();

    this.render = this.render.bind(this);

    // 紙めくりトランジション用の状態
    this.fullscreenMesh = null; // フルスクリーン用メッシュ
    this.rippleMaterial = null; // 紙めくりシェーダーマテリアル
    this.currentSlideIndex = 0; // 現在のスライドインデックス
    this.nextSlideIndex = 1; // 次のスライドインデックス
    this.isRippleTransitioning = false; // 紙めくりトランジション中
    this.rippleProgress = 0; // トランジションの進行度
    this.rippleScrollAccumulator = 0; // スクロール蓄積量
    this.rippleScrollThreshold = 150; // トランジション開始に必要なスクロール量
    this.isEnteringFullscreen = false; // 入場アニメーション中
    this.enterProgress = 0; // 入場アニメーションの進行度
    this.isMessageAnimating = false; // メッセージアニメーション中
    this.pendingDirection = 0; // 待機中のスクロール方向
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // 遷移中フラグ（二重遷移防止用）
    let isNavigating = false;

    // クリック/タッチ処理
    const handlePointerClick = (clientX, clientY) => {
      if (isNavigating) return;

      const x = clientX / window.innerWidth * 2.0 - 1.0;
      const y = clientY / window.innerHeight * 2.0 - 1.0;
      this._tempVec2.set(x, -y);
      this.raycaster.setFromCamera(this._tempVec2, this.camera);
      const intersects = this.raycaster.intersectObjects([this.fullscreenMesh]);

      if (intersects.length > 0) {
        const url = this.urls[this.currentSlideIndex];
        if (url) {
          isNavigating = true;
          if (window.swup) {
            window.swup.navigate(url);
          } else {
            window.location.href = url;
          }
        }
      }
    };

    // マウスクリックイベント
    window.addEventListener('click', (mouseEvent) => {
      handlePointerClick(mouseEvent.clientX, mouseEvent.clientY);
    }, false);

    // タッチタップイベント（スマホ対応）
    window.addEventListener('touchend', (touchEvent) => {
      if (touchEvent.changedTouches.length > 0) {
        handlePointerClick(touchEvent.changedTouches[0].clientX, touchEvent.changedTouches[0].clientY);
      }
    }, { passive: true });

    // リサイズイベント
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      // フルスクリーンプレーンのサイズも更新
      const currentAspect = this.textures[this.currentSlideIndex]?.userData?.aspect || 1;
      this.updateFullscreenPlaneSize(currentAspect);
    }, false);

    // スクロールイベント（紙めくりトランジション）
    const slideMessages = document.getElementById('slide-messages');

    // スクロールが一番下に達したかチェックする関数
    const isAtBottom = () => {
      if (!slideMessages) return false;
      const threshold = 50; // 許容範囲
      return slideMessages.scrollHeight - slideMessages.scrollTop - slideMessages.clientHeight < threshold;
    };

    // スクロールが一番上に達したかチェックする関数
    const isAtTop = () => {
      if (!slideMessages) return false;
      return slideMessages.scrollTop < 50;
    };

    window.addEventListener('wheel', (event) => {
      if (this.isRippleTransitioning || this.isEnteringFullscreen || this.isMessageAnimating) return;

      const direction = event.deltaY > 0 ? 1 : -1;

      // 下にスクロール中で、一番下に達している場合
      if (direction > 0 && isAtBottom()) {
        this.rippleScrollAccumulator += Math.abs(event.deltaY);
        if (this.rippleScrollAccumulator >= this.rippleScrollThreshold) {
          this.rippleScrollAccumulator = 0;
          this.startMessageThenTransition(direction);
        }
      }
      // 上にスクロール中で、一番上に達している場合
      else if (direction < 0 && isAtTop()) {
        this.rippleScrollAccumulator += Math.abs(event.deltaY);
        if (this.rippleScrollAccumulator >= this.rippleScrollThreshold) {
          this.rippleScrollAccumulator = 0;
          this.startMessageThenTransition(direction);
        }
      } else {
        // まだスクロール中なので蓄積をリセット
        this.rippleScrollAccumulator = 0;
      }
    }, { passive: true });

    // タッチスクロール対応
    let touchStartY = 0;

    window.addEventListener('touchstart', (event) => {
      if (event.touches.length > 0) {
        touchStartY = event.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (event) => {
      if (this.isRippleTransitioning || this.isEnteringFullscreen || this.isMessageAnimating) return;
      if (event.touches.length > 0) {
        const deltaY = touchStartY - event.touches[0].clientY;
        touchStartY = event.touches[0].clientY;
        const direction = deltaY > 0 ? 1 : -1;

        // 下にスクロール中で、一番下に達している場合
        if (direction > 0 && isAtBottom()) {
          this.rippleScrollAccumulator += Math.abs(deltaY);
          if (this.rippleScrollAccumulator >= this.rippleScrollThreshold) {
            this.rippleScrollAccumulator = 0;
            this.startMessageThenTransition(direction);
          }
        }
        // 上にスクロール中で、一番上に達している場合
        else if (direction < 0 && isAtTop()) {
          this.rippleScrollAccumulator += Math.abs(deltaY);
          if (this.rippleScrollAccumulator >= this.rippleScrollThreshold) {
            this.rippleScrollAccumulator = 0;
            this.startMessageThenTransition(direction);
          }
        } else {
          this.rippleScrollAccumulator = 0;
        }
      }
    }, { passive: true });
  }

  /**
   * メッセージアニメーション後にテクスチャ遷移を開始
   */
  startMessageThenTransition(direction) {
    if (this.isMessageAnimating || this.isRippleTransitioning || this.isEnteringFullscreen) return;

    this.isMessageAnimating = true;
    this.pendingDirection = direction;

    // 次のインデックスを計算
    let nextIndex = this.currentSlideIndex + direction;
    if (nextIndex >= this.textures.length) {
      nextIndex = 0;
    } else if (nextIndex < 0) {
      nextIndex = this.textures.length - 1;
    }

    // 先にメッセージをアニメーション表示
    this.showSlideMessage(nextIndex, () => {
      // メッセージアニメーション完了後にテクスチャ遷移
      this.isMessageAnimating = false;
      this.startRippleTransition(this.pendingDirection);
    });
  }

  /**
   * 波紋トランジションを開始
   */
  startRippleTransition(direction) {
    if (this.isRippleTransitioning) return;

    // 次のインデックスを計算
    this.nextSlideIndex = this.currentSlideIndex + direction;
    if (this.nextSlideIndex >= this.textures.length) {
      this.nextSlideIndex = 0;
    } else if (this.nextSlideIndex < 0) {
      this.nextSlideIndex = this.textures.length - 1;
    }

    // テクスチャを設定
    this.rippleMaterial.uniforms.uTexture1.value = this.textures[this.currentSlideIndex];
    this.rippleMaterial.uniforms.uTexture2.value = this.textures[this.nextSlideIndex];
    this.rippleMaterial.uniforms.uTexture1Aspect.value = this.textures[this.currentSlideIndex]?.userData?.aspect || 1;
    this.rippleMaterial.uniforms.uTexture2Aspect.value = this.textures[this.nextSlideIndex]?.userData?.aspect || 1;
    this.rippleMaterial.uniforms.uTexture1Flipped.value = this.textures[this.currentSlideIndex]?.userData?.isVideo ? 0.0 : 1.0;
    this.rippleMaterial.uniforms.uTexture2Flipped.value = this.textures[this.nextSlideIndex]?.userData?.isVideo ? 0.0 : 1.0;
    this.rippleMaterial.uniforms.uProgress.value = 0;

    this.isRippleTransitioning = true;
    this.rippleProgress = 0;
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  async load() {
    // 読み込む画像のパス
    const imagePath = ['img/good_portforio.png','video/sakaba.mp4','img/sankou.webp','img/podcast.png','img/app.png','video/arcraft.mp4','img/attcraft_4th.png','img/x_post_nami.png','img/x_post_kuu.png','img/about.jpg'];
    const loader = new THREE.TextureLoader();
    this.videoElements = []; // 動画要素を保持
    this.textures = await Promise.all(imagePath.map((path) => {
      return new Promise((resolve) => {
        // 動画ファイルの場合
        if (path.endsWith('.mp4') || path.endsWith('.webm')) {
          const video = document.createElement('video');
          video.src = path;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.load();

          video.addEventListener('loadeddata', () => {
            video.play();
            const tex = new THREE.VideoTexture(video);
            tex.colorSpace = THREE.SRGBColorSpace;
            // ClampToEdgeWrappingで端の黒線を防止
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            // テクスチャ品質向上（ぼやけ防止）
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            // 動画の端の黒線をクロップ（UVを少し内側に縮小）+ 水平反転
            const cropAmount = 0.02; // 2%クロップ
            tex.offset.set(1 - cropAmount, cropAmount);
            tex.repeat.set(-(1 - cropAmount * 2), 1 - cropAmount * 2);
            // テクスチャのアスペクト比と動画フラグを保存
            tex.userData = { aspect: video.videoWidth / video.videoHeight, isVideo: true };
            this.videoElements.push(video);
            resolve(tex);
          });
        } else {
          // 画像ファイルの場合
          loader.load(path, (tex) => {

            tex.colorSpace = THREE.SRGBColorSpace;
            // ClampToEdgeWrappingで端の黒線を防止
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            // テクスチャ品質向上（ぼやけ防止）
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            // テクスチャを水平反転（裏向き対策）
            tex.repeat.x = -1;
            tex.offset.x = 1;
            // テクスチャのアスペクト比と動画フラグを保存
            tex.userData = { aspect: tex.image.width / tex.image.height, isVideo: false };
            resolve(tex);
          });
        }
       });
    }));
  }

  /**
   * 初期化処理
   */
  init() {
    // レンダラー
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(new THREE.Color(App3.RENDERER_PARAM.clearColor), 0);
    this.renderer.setSize(App3.RENDERER_PARAM.width, App3.RENDERER_PARAM.height);
    // 高解像度ディスプレイ対応（スマホでぼやけ防止）
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const wrapper = document.querySelector('#webgl');
    wrapper.appendChild(this.renderer.domElement);

    // シーン
    this.scene = new THREE.Scene();

    // カメラ（正面から見る位置）
    this.camera = new THREE.PerspectiveCamera(
      App3.CAMERA_PARAM.fovy,
      App3.CAMERA_PARAM.aspect,
      App3.CAMERA_PARAM.near,
      App3.CAMERA_PARAM.far,
    );
    this.camera.position.set(0, 0, 3);
    this.camera.lookAt(0, 0, 0);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      App3.AMBIENT_LIGHT_PARAM.color,
      App3.AMBIENT_LIGHT_PARAM.intensity,
    );
    this.scene.add(this.ambientLight);

    // 各画像の遷移先URL
    this.urls = [
      '/detail/good_portforio',
      '/detail/sakaba',
      '/detail/sankou',
      '/detail/podcast',
      '/detail/app',
      '/detail/arcraft',
      '/detail/attcraft_4th',
      '/detail/x_post_nami',
      '/detail/x_post_kuu',
      '/about',
    ];

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;

    // 紙めくりトランジション用のシェーダーマテリアルとメッシュを作成
    this.createRippleFullscreen();

    // フルスクリーンモードで開始
    this.startFullscreenMode();

    // イベントリスナーを設定
    this.setupEventListeners();
  }

  /**
   * フルスクリーンモードで開始
   */
  startFullscreenMode() {
    // 最初のテクスチャを設定
    this.currentSlideIndex = 0;
    const currentAspect = this.textures[this.currentSlideIndex]?.userData?.aspect || 1;
    const currentTexture = this.textures[this.currentSlideIndex];
    const isVideo = currentTexture?.userData?.isVideo ? 0.0 : 1.0;

    // プレーンのサイズを画像のアスペクト比に合わせて更新
    this.updateFullscreenPlaneSize(currentAspect);

    // フルスクリーンメッシュを表示
    this.fullscreenMesh.visible = true;
    this.fullscreenMesh.position.set(0, 0, 0);

    // テクスチャをシェーダーに設定（両方に同じテクスチャを設定）
    this.rippleMaterial.uniforms.uTexture1.value = currentTexture;
    this.rippleMaterial.uniforms.uTexture1Aspect.value = currentAspect;
    this.rippleMaterial.uniforms.uTexture1Flipped.value = isVideo;
    this.rippleMaterial.uniforms.uTexture2.value = currentTexture;
    this.rippleMaterial.uniforms.uTexture2Aspect.value = currentAspect;
    this.rippleMaterial.uniforms.uTexture2Flipped.value = isVideo;
    // 初期状態: フラット（uProgress=0）、透明（uOpacity=0）
    this.rippleMaterial.uniforms.uProgress.value = 0;
    this.rippleMaterial.uniforms.uOpacity.value = 0;

    // 入場アニメーションを開始
    this.isEnteringFullscreen = true;
    this.enterProgress = 0;

    // メッセージアニメーション中はスクロールをブロック
    this.isMessageAnimating = true;

    // スライドメッセージを表示（完了後にスクロールを許可）
    this.showSlideMessage(this.currentSlideIndex, () => {
      this.isMessageAnimating = false;
    });
  }

  /**
   * スライドメッセージを表示
   * @param {number} slideIndex - 表示するスライドのインデックス
   * @param {function} onComplete - アニメーション完了後のコールバック（オプション）
   */
  showSlideMessage(slideIndex, onComplete = null) {
    // スクロール位置を一番上にリセット
    const slideMessagesContainer = document.getElementById('slide-messages');
    if (slideMessagesContainer) {
      slideMessagesContainer.scrollTop = 0;
    }

    // すべてのスライドメッセージを非表示にし、detail-visibleクラスを削除
    const allMessages = document.querySelectorAll('.slide-message');
    allMessages.forEach((msg) => {
      msg.classList.remove('active');
      // js-detailからdetail-visibleを削除してアニメーションをリセット
      const details = msg.querySelectorAll('.js-detail');
      details.forEach((detail) => {
        detail.classList.remove('detail-visible');
      });
    });

    // 対象のスライドメッセージを表示
    const targetMessage = document.querySelector(`.slide-message[data-slide="${slideIndex}"]`);
    if (targetMessage) {
      targetMessage.classList.add('active');

      const details = targetMessage.querySelectorAll('.js-detail');
      const detailCount = details.length;
      const delayPerItem = 300; // 各アイテムの遅延
      const animationDuration = 600; // CSSアニメーションの時間

      // 順番にアニメーション
      details.forEach((detail, index) => {
        setTimeout(() => {
          detail.classList.add('detail-visible');
        }, index * delayPerItem);
      });

      // すべてのアニメーション完了後にコールバック
      if (onComplete) {
        const totalTime = (detailCount - 1) * delayPerItem + animationDuration;
        setTimeout(() => {
          onComplete();
        }, totalTime);
      }
    } else if (onComplete) {
      // 対象メッセージがない場合もコールバック実行
      onComplete();
    }
  }

  /**
   * 波紋トランジション用のフルスクリーンメッシュを作成
   */
  createRippleFullscreen() {
    // 波紋シェーダーの頂点シェーダー
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // 波紋シェーダーのフラグメントシェーダー
    const fragmentShader = `
      uniform sampler2D uTexture1;
      uniform sampler2D uTexture2;
      uniform float uProgress;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uTexture1Aspect;
      uniform float uTexture2Aspect;
      uniform float uTexture1Flipped;
      uniform float uTexture2Flipped;
      uniform float uOpacity;

      varying vec2 vUv;

      void main() {
        // 中心からの距離を計算
        vec2 center = vec2(0.5, 0.5);
        vec2 diff = vUv - center;
        float dist = length(diff);

        // 波紋のパラメータ
        float rippleWidth = 0.82;
        float maxDist = 0.75;
        float rippleEdge = uProgress * maxDist * 1.8;

        // 波紋の形状を計算（uProgressが0のときは完全に0）
        float ripple = uProgress > 0.0
          ? smoothstep(rippleEdge - rippleWidth, rippleEdge, dist)
            * (1.0 - smoothstep(rippleEdge, rippleEdge + rippleWidth * 0.3, dist))
          : 0.0;

        // 波紋による歪み（uProgressが0のときは歪みなし）
        // ゼロ除算防止のため小さな値を追加
        vec2 dir = length(diff) > 0.001 ? normalize(diff) : vec2(0.0);

        // 波の揺らぎを作成
        float wave1 = sin(uTime * 10.0 + dist * 20.0) * 2.0;
        float combinedWave = wave1;

        // 揺らぎを終盤で減衰させる（進行度が高くなるほど揺らぎが弱くなる）
        float fadeOut = 1.0 - smoothstep(0.6, 1.0, uProgress);
        float distortion = uProgress > 0.0 ? ripple * 0.16 * combinedWave * fadeOut : 0.0;
        vec2 distortedUv = vUv + dir * distortion;

        // UVをそのまま使用（テクスチャ側で反転済み）
        vec2 uv1 = distortedUv;
        vec2 uv2 = distortedUv;

        // テクスチャサンプリング
        vec4 tex1 = texture2D(uTexture1, uv1);
        vec4 tex2 = texture2D(uTexture2, uv2);

        // 中心から外側に向かって徐々に切り替わる
        // progressが進むにつれて、より外側まで新しい画像が広がる
        float radius = uProgress * 1.2; // 切り替わりの半径（progressに比例）
        float mixFactor = smoothstep(radius - 0.3, radius, dist);
        mixFactor = 1.0 - mixFactor; // 中心が1、外側が0

        // 画像テクスチャにのみガンマ補正を適用（動画は適用しない）
        if (uTexture1Flipped > 0.5) {
          tex1.rgb = pow(tex1.rgb, vec3(1.0 / 2.2));
        }
        if (uTexture2Flipped > 0.5) {
          tex2.rgb = pow(tex2.rgb, vec3(1.0 / 2.2));
        }

        // 色を混合（tex1が古い画像、tex2が新しい画像）
        vec4 finalColor = mix(tex1, tex2, mixFactor);
        finalColor.a = uOpacity;

        gl_FragColor = finalColor;
      }
    `;

    // シェーダーマテリアルを作成
    this.rippleMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        uTexture1: { value: this.textures[0] },
        uTexture2: { value: this.textures[1] },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uTexture1Aspect: { value: this.textures[0]?.userData?.aspect || 1 },
        uTexture2Aspect: { value: this.textures[1]?.userData?.aspect || 1 },
        uTexture1Flipped: { value: this.textures[0]?.userData?.isVideo ? 0.0 : 1.0 },
        uTexture2Flipped: { value: this.textures[1]?.userData?.isVideo ? 0.0 : 1.0 },
        uOpacity: { value: 1 },
      },
      transparent: true,
    });

    // 初期プレーンジオメトリ（後で画像に合わせてサイズ更新）
    const fullscreenGeometry = new THREE.PlaneGeometry(1, 1);
    this.fullscreenMesh = new THREE.Mesh(fullscreenGeometry, this.rippleMaterial);
    this.fullscreenMesh.position.set(0, 0, 0);
    this.fullscreenMesh.visible = false; // 初期は非表示
    this.scene.add(this.fullscreenMesh);
  }

  /**
   * フルスクリーンプレーンのサイズを画像のアスペクト比に合わせて更新
   */
  updateFullscreenPlaneSize(textureAspect) {
    const distance = 3; // カメラからプレーンまでの距離
    const fovRad = (App3.CAMERA_PARAM.fovy * Math.PI) / 180;
    const maxHeight = 2 * distance * Math.tan(fovRad / 2);
    const maxWidth = maxHeight * (window.innerWidth / window.innerHeight);

    // サイズのスケール（0.0〜1.0、1.0で画面いっぱい）
    const scale = 0.8;

    let planeWidth, planeHeight;
    if (textureAspect > maxWidth / maxHeight) {
      // 画像が横長の場合、幅を画面に合わせる
      planeWidth = maxWidth * scale;
      planeHeight = planeWidth / textureAspect;
    } else {
      // 画像が縦長の場合、高さを画面に合わせる
      planeHeight = maxHeight * scale;
      planeWidth = planeHeight * textureAspect;
    }

    // ジオメトリを更新
    this.fullscreenMesh.geometry.dispose();
    this.fullscreenMesh.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  }

  /**
   * 描画処理
   */
  render() {
    // 破棄済みならアニメーションループを停止
    if (this.isDisposed) return;

    requestAnimationFrame(this.render);
    this.controls.update();

    // 波紋トランジションのアニメーション処理
    if (this.rippleMaterial) {
      // 時間を更新
      this.rippleMaterial.uniforms.uTime.value += 0.016;
      this.rippleMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

      // 入場アニメーション（opacity 0→1）
      if (this.isEnteringFullscreen) {
        this.enterProgress += 0.02;

        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const opacityProgress = easeOutCubic(Math.min(this.enterProgress, 1));
        this.rippleMaterial.uniforms.uOpacity.value = opacityProgress;

        if (this.enterProgress >= 1) {
          this.isEnteringFullscreen = false;
          this.enterProgress = 0;
          this.rippleMaterial.uniforms.uOpacity.value = 1;
          this.rippleMaterial.uniforms.uProgress.value = 0;
        }
      }

      // トランジション中
      if (this.isRippleTransitioning) {
        this.rippleProgress += 0.009; // トランジション速度

        // イージング関数を適用（easeOutQuad: 滑らかに減速）
        const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
        const easedProgress = easeOutQuad(Math.min(this.rippleProgress, 1));
        this.rippleMaterial.uniforms.uProgress.value = easedProgress;

        if (this.rippleProgress >= 1) {
          // トランジション完了
          this.isRippleTransitioning = false;
          this.rippleProgress = 0;
          this.rippleMaterial.uniforms.uProgress.value = 0;
          this.currentSlideIndex = this.nextSlideIndex;

          // 現在のテクスチャを更新
          const newAspect = this.textures[this.currentSlideIndex]?.userData?.aspect || 1;
          this.rippleMaterial.uniforms.uTexture1.value = this.textures[this.currentSlideIndex];
          this.rippleMaterial.uniforms.uTexture1Aspect.value = newAspect;
          this.rippleMaterial.uniforms.uTexture1Flipped.value = this.textures[this.currentSlideIndex]?.userData?.isVideo ? 0.0 : 1.0;

          // プレーンのサイズを新しい画像のアスペクト比に合わせて更新
          this.updateFullscreenPlaneSize(newAspect);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * リソースの破棄
   */
  dispose() {
    // アニメーションループを停止
    this.isDisposed = true;

    // Three.jsリソースの破棄
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }

    this.textures?.forEach((texture) => {
      texture.dispose();
    });

    // 動画要素の破棄
    this.videoElements?.forEach((video) => {
      video.pause();
      video.src = '';
      video.load();
    });

    // 紙めくりシェーダーマテリアルの破棄
    if (this.rippleMaterial) {
      this.rippleMaterial.dispose();
    }

    // フルスクリーンメッシュのジオメトリ破棄
    if (this.fullscreenMesh) {
      this.fullscreenMesh.geometry.dispose();
    }
  }
}
