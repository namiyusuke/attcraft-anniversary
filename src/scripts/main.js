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
 * three.js を効率よく扱うために自家製の制御クラスを定義
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
      x: -6.0,
      y: 2,
      z: 0.0,
      lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
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
   * ディレクショナルライト定義のための定数
   */
  static get DIRECTIONAL_LIGHT_PARAM() {
    return {
      color: 0xffffff,
      intensity: 1.0,
      x: 1.0,
      y: 1.0,
      z: 1.0,
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
   * マテリアル定義のための定数
   */
  static get MATERIAL_PARAM() {
    return {
      color: 0xffffff,
      side: THREE.DoubleSide
    };
  }
  /**
   * レイが交差した際のマテリアル定義のための定数 @@@
   */
  static get INTERSECTION_MATERIAL_PARAM() {
    return {
      color: 0x00ff00,
    };
  }
  /**
   * フォグの定義のための定数
   */
  static get FOG_PARAM() {
    return {
      fogColor: 0xffffff,
      fogNear: 10.0,
      fogFar: 20.0,
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
    this.directionalLight; // ディレクショナルライト
    this.ambientLight;     // アンビエントライト
    this.materials;        // マテリアルの配列
    this.hitMaterial;      // レイが交差した場合用のマテリアル @@@
    this.meshes;           // メッシュの配列
    this.controls;         // オービットコントロール
    this.axesHelper;       // 軸ヘルパー
    this.group;            // グループ
    this.texture1;          // テクスチャ
    this.texture2;          // テクスチャ
    // Raycaster のインスタンスを生成する @@@
    // Raycaster は「光線（Ray）を飛ばして、3D空間内のオブジェクトとの交差判定を行う」仕組み
    this.raycaster = new THREE.Raycaster();
    // 再利用可能なベクトル（パフォーマンス最適化）
    this._tempVec2 = new THREE.Vector2();
    this._tempVec3 = new THREE.Vector3();

    this.isDown = false;
    this.speed = 0.01; // 移動速度
    this.width = 1.5; // メッシュ間の幅
    this.meshTilt = 0.4; // メッシュのY軸傾き角度
    this.scrollOffset = 0; // スクロールオフセットを保存
    this.render = this.render.bind(this);
    this.touchStartX = 0;
    this.isInitialAnimation = true; // 初期アニメーションフラグ
    this.initialAnimationProgress = 0; // 初期アニメーションの進捗
    this.initialAnimationPhase = 1; // 初期アニメーションフェーズ（1: 真ん中に集合, 2: 円状展開, 3: 横一列に展開）
    this.circleAnimationRotation = 0; // 円状配置時の回転角度
    this.cameraTargetPosition = null; // カメラの目標位置
    this.isCameraAnimating = false;
    this.isCameraMoved = false; // カメラが移動済みかどうか
    this.isReturning = false; // 戻り中かどうか
    this.circleRotation = 0; // 円状配置の回転角度
    // カメラの初期位置を保存
    this.cameraInitialPosition = new THREE.Vector3(
      App3.CAMERA_PARAM.x,
      App3.CAMERA_PARAM.y,
      App3.CAMERA_PARAM.z
    );

    // 波紋トランジション用の状態
    this.isFullscreenMode = false; // フルスクリーンモード
    this.fullscreenMesh = null; // フルスクリーン用メッシュ
    this.rippleMaterial = null; // 波紋シェーダーマテリアル
    this.currentSlideIndex = 0; // 現在のスライドインデックス
    this.nextSlideIndex = 1; // 次のスライドインデックス
    this.isRippleTransitioning = false; // 波紋トランジション中
    this.rippleProgress = 0; // 波紋の進行度
    this.rippleScrollAccumulator = 0; // スクロール蓄積量
    this.rippleScrollThreshold = 150; // トランジション開始に必要なスクロール量
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // SVGマウスストーカー要素を取得
    const textureStalker = document.querySelector('.js-texture-stalker');
    const outerCircle = document.getElementById('texture-outer-circle');
    const stalkerText = document.getElementById('texture-stalker-text');

    // SVGマウスストーカーの状態
    const stalkerState = {
      current: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      delta: { x: 0, y: 0 },
      isHovering: false,
      animationId: null
    };

    // SVGマウスストーカーのアニメーション
    const animateStalker = () => {
      stalkerState.delta.x = stalkerState.target.x - stalkerState.current.x;
      stalkerState.delta.y = stalkerState.target.y - stalkerState.current.y;
      stalkerState.current.x += stalkerState.delta.x * 0.15;
      stalkerState.current.y += stalkerState.delta.y * 0.15;

      // 速度に応じて変形
      let distort = Math.sqrt(Math.pow(stalkerState.delta.x, 2) + Math.pow(stalkerState.delta.y, 2)) / 300;
      distort = Math.min(distort, 0.4);
      const scaleX = 1 + distort;
      const scaleY = 1 - distort;
      const rotate = (Math.atan2(stalkerState.delta.y, stalkerState.delta.x) / Math.PI) * 180;

      if (outerCircle) {
textureStalker.style.transformOrigin = `${stalkerState.current.x}px ${stalkerState.current.y}px`;
        outerCircle.setAttribute('cx', stalkerState.current.x);
        outerCircle.setAttribute('cy', stalkerState.current.y);
        outerCircle.style.transformOrigin = `${stalkerState.current.x}px ${stalkerState.current.y}px`;
        outerCircle.style.transform = `rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`;
      }
      if (stalkerText) {
        stalkerText.setAttribute('x', stalkerState.current.x);
        stalkerText.setAttribute('y', stalkerState.current.y);
      }

      if (stalkerState.isHovering) {
        stalkerState.animationId = requestAnimationFrame(animateStalker);
      }
    };

    // 遷移中フラグ（二重遷移防止・ホバー処理停止用）
    let isNavigating = false;

    // ホバー/タッチ処理を共通化する関数
    const handlePointerMove = (clientX, clientY) => {
      // 遷移中はホバー処理をスキップ
      if (isNavigating) return;

      // SVGマウスストーカーのターゲット位置を更新
      stalkerState.target.x = clientX;
      stalkerState.target.y = clientY;

      const x = clientX / window.innerWidth * 2.0 - 1.0;
      const y = clientY / window.innerHeight * 2.0 - 1.0;
      this._tempVec2.set(x, -y);

      this.raycaster.setFromCamera(this._tempVec2, this.camera);
      const intersects = this.raycaster.intersectObjects(this.meshes);

      this.meshes.forEach((mesh, index) => {
        mesh.material = this.materials[index];
        mesh.userData.isHovered = false;
      });

      if (intersects.length > 0) {
        intersects[0].object.userData.isHovered = true;

        // SVGマウスストーカーを表示
        if (textureStalker && !stalkerState.isHovering) {
          stalkerState.isHovering = true;
          stalkerState.current.x = clientX;
          stalkerState.current.y = clientY;
          textureStalker.classList.add('is-active');
          animateStalker();
        }
      } else {
        // ホバーが外れたらSVGマウスストーカーを非表示
        if (textureStalker && stalkerState.isHovering) {
          stalkerState.isHovering = false;
          textureStalker.classList.remove('is-active');
          if (stalkerState.animationId) {
            cancelAnimationFrame(stalkerState.animationId);
          }
        }
      }
    };

    // クリック/タッチ処理を共通化する関数

    const handlePointerClick = (clientX, clientY) => {
      // 既に遷移中なら何もしない
      if (isNavigating) return;

      const x = clientX / window.innerWidth * 2.0 - 1.0;
      const y = clientY / window.innerHeight * 2.0 - 1.0;
      this._tempVec2.set(x, -y);
      this.raycaster.setFromCamera(this._tempVec2, this.camera);
      const intersects = this.raycaster.intersectObjects(this.meshes);

      this.meshes.forEach((mesh, index) => {
        mesh.material = this.materials[index];
        mesh.userData.isHovered = false;
        mesh.userData.isClick = false;
      });

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        clickedMesh.userData.isClick = true;
        // ページ遷移
        if (clickedMesh.userData.url) {
          isNavigating = true; // 遷移中フラグをON
          // SVGマウスストーカーを即座に非表示
          if (textureStalker) {
            stalkerState.isHovering = false;
            textureStalker.classList.remove('is-active');
            if (stalkerState.animationId) {
              cancelAnimationFrame(stalkerState.animationId);
            }
          }
          if (window.swup) {
             window.swup.navigate(clickedMesh.userData.url);
          } else {
              window.location.href = clickedMesh.userData.url;
          }
        }
      } else {
        this.meshes.forEach((mesh) => {
          mesh.userData.isClick = false;
        });
      }
    };

    // マウス移動イベントの定義（ホバー検出用） @@@
    window.addEventListener('mousemove', (mouseEvent) => {
      handlePointerMove(mouseEvent.clientX, mouseEvent.clientY);
    }, false);

    // タッチ移動イベント（スマホ対応）
    window.addEventListener('touchmove', (touchEvent) => {
      if (touchEvent.touches.length > 0) {
        handlePointerMove(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
      }
    }, { passive: true });

    // マウスクリックイベント
    window.addEventListener('click', (mouseEvent) => {
      handlePointerClick(mouseEvent.clientX, mouseEvent.clientY);
    }, false);

    // タッチタップイベント（スマホ対応）
    window.addEventListener('touchstart', (touchEvent) => {
      if (touchEvent.touches.length > 0) {
        handlePointerClick(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
      }
    }, { passive: true });

    // マウスホイールイベントで無限スクロールを実現
    window.addEventListener('wheel', (event) => {
      this.scrollOffset += event.deltaY * 0.001; // スクロール量を累積
    }, { passive: true });

    // タッチスクロール対応（スマホ）
    window.addEventListener('touchstart', (event) => {
      if (event.touches.length > 0) {
        this.touchStartX = event.touches[0].clientX;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (event) => {
      if (event.touches.length > 0) {
        const touchCurrentX = event.touches[0].clientX;
        const deltaX = this.touchStartX - touchCurrentX;
        this.scrollOffset += deltaX * 0.005; // 横スワイプでスクロール
        this.touchStartX = touchCurrentX;
      }
    }, { passive: true });

    window.addEventListener('keydown', (keyEvent) => {
      switch (keyEvent.key) {
        case ' ':
          this.isDown = true;
          break;
        default:
      }
    }, false);

    window.addEventListener('keyup', () => {
      this.isDown = false;
    }, false);

    // リサイズイベント
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
    // カメラ移動ボタン → フルスクリーン波紋モードに切り替え
    const cameraMoveBtn = document.querySelector('#camera-move-btn');
    if (cameraMoveBtn) {
      cameraMoveBtn.addEventListener('click', () => {
        // フルスクリーンモードに入る
        this.enterFullscreenMode();
      });
    }

    // 元に戻るボタン
    const cameraResetBtn = document.querySelector('#camera-reset-btn');
    if (cameraResetBtn) {
      cameraResetBtn.addEventListener('click', () => {
        // フルスクリーンモードから戻る
        this.exitFullscreenMode();
      });
    }

    // フルスクリーンモード時のスクロールイベント
    window.addEventListener('wheel', (event) => {
      if (!this.isFullscreenMode || this.isRippleTransitioning) return;

      this.rippleScrollAccumulator += Math.abs(event.deltaY);

      if (this.rippleScrollAccumulator >= this.rippleScrollThreshold) {
        this.rippleScrollAccumulator = 0;
        const direction = event.deltaY > 0 ? 1 : -1;
        this.startRippleTransition(direction);
      }
    }, { passive: true });

    // タッチスクロール対応
    let rippleTouchStartY = 0;
    window.addEventListener('touchstart', (event) => {
      if (!this.isFullscreenMode) return;
      if (event.touches.length > 0) {
        rippleTouchStartY = event.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (event) => {
      if (!this.isFullscreenMode || this.isRippleTransitioning) return;
      if (event.touches.length > 0) {
        const deltaY = rippleTouchStartY - event.touches[0].clientY;
        this.rippleScrollAccumulator += Math.abs(deltaY);
        rippleTouchStartY = event.touches[0].clientY;

        if (this.rippleScrollAccumulator >= this.rippleScrollThreshold) {
          this.rippleScrollAccumulator = 0;
          const direction = deltaY > 0 ? 1 : -1;
          this.startRippleTransition(direction);
        }
      }
    }, { passive: true });
  }

  /**
   * フルスクリーンモードに入る
   */
  enterFullscreenMode() {
    this.isFullscreenMode = true;
    this.isCameraMoved = true;

    // 既存のメッシュを非表示
    this.meshes.forEach(mesh => {
      mesh.visible = false;
    });

    // 最初のテクスチャを設定
    this.currentSlideIndex = 0;
    const currentAspect = this.textures[this.currentSlideIndex]?.userData?.aspect || 1;

    // プレーンのサイズを画像のアスペクト比に合わせて更新
    this.updateFullscreenPlaneSize(currentAspect);

    // フルスクリーンメッシュを表示
    this.fullscreenMesh.visible = true;
    this.fullscreenMesh.position.set(0, 0, 0);

    // カメラを正面に移動
    this.cameraTargetPosition = new THREE.Vector3(0, 0, 3);
    this.isCameraAnimating = true;

    // テクスチャをシェーダーに設定
    this.rippleMaterial.uniforms.uTexture1.value = this.textures[this.currentSlideIndex];
    this.rippleMaterial.uniforms.uTexture1Aspect.value = currentAspect;
    this.rippleMaterial.uniforms.uTexture1Flipped.value = this.textures[this.currentSlideIndex]?.userData?.isVideo ? 0.0 : 1.0;
    this.rippleMaterial.uniforms.uProgress.value = 0;

    // ボタンのテキストを変更
    const cameraMoveBtn = document.querySelector('#camera-move-btn');
    if (cameraMoveBtn) {
      cameraMoveBtn.style.display = 'none';
    }
    const cameraResetBtn = document.querySelector('#camera-reset-btn');
    if (cameraResetBtn) {
      cameraResetBtn.style.display = 'block';
    }
  }

  /**
   * フルスクリーンモードから戻る
   */
  exitFullscreenMode() {
    // フルスクリーンメッシュを非表示
    this.fullscreenMesh.visible = false;

    // 既存のメッシュを表示
    this.meshes.forEach(mesh => {
      mesh.visible = true;
    });

    // カメラを通常モードの位置に戻す
    this.cameraTargetPosition = new THREE.Vector3(-2.0, 0.8, 3.0);
    this.isCameraAnimating = true;

    // フラグをリセット（順序が重要）
    this.isFullscreenMode = false;
    this.isReturning = true;
    // isCameraMovedはカメラアニメーション完了時にfalseにする

    // ボタンを元に戻す
    const cameraMoveBtn = document.querySelector('#camera-move-btn');
    if (cameraMoveBtn) {
      cameraMoveBtn.style.display = 'block';
    }
    const cameraResetBtn = document.querySelector('#camera-reset-btn');
    if (cameraResetBtn) {
      cameraResetBtn.style.display = 'none';
    }
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
    const imagePath = ['img/good_portforio.png','video/sakaba.mp4','img/sankou.webp','img/podcast.png','img/app.png','video/arcraft.mp4','img/attcraft_4th.png','img/x_post_nami.webp','img/x_post_kuu.webp','img/about.jpg'];
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
            // 動画の端の黒線をクロップ（UVを少し内側に縮小）
            const cropAmount = 0.02; // 2%クロップ
            tex.offset.set(cropAmount, cropAmount);
            tex.repeat.set(1 - cropAmount * 2, 1 - cropAmount * 2);
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
    this.texture1 = this.textures[0];
    this.texture2 = this.textures[1];
    this.texture3 = this.textures[2];
    this.texture4 = this.textures[3];
    this.texture5 = this.textures[4];
    this.texture6 = this.textures[5];
    this.texture7 = this.textures[6];
    this.texture8 = this.textures[7];
    this.texture9 = this.textures[8];
    this.texture10 = this.textures[9];
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

    // シーンとフォグ
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      App3.FOG_PARAM.fogColor,
      App3.FOG_PARAM.fogNear,
      App3.FOG_PARAM.fogFar
    );

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      App3.CAMERA_PARAM.fovy,
      App3.CAMERA_PARAM.aspect,
      App3.CAMERA_PARAM.near,
      App3.CAMERA_PARAM.far,
    );
    this.camera.position.set(
      App3.CAMERA_PARAM.x,
      App3.CAMERA_PARAM.y,
      App3.CAMERA_PARAM.z,
    );
    this.camera.lookAt(App3.CAMERA_PARAM.lookAt);

    // ディレクショナルライト（平行光源）
    // this.directionalLight = new THREE.DirectionalLight(
    //   App3.DIRECTIONAL_LIGHT_PARAM.color,
    //   App3.DIRECTIONAL_LIGHT_PARAM.intensity
    // );
    // this.directionalLight.position.set(
    //   App3.DIRECTIONAL_LIGHT_PARAM.x,
    //   App3.DIRECTIONAL_LIGHT_PARAM.y,
    //   App3.DIRECTIONAL_LIGHT_PARAM.z,
    // );
    // this.scene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      App3.AMBIENT_LIGHT_PARAM.color,
      App3.AMBIENT_LIGHT_PARAM.intensity,
    );
    this.scene.add(this.ambientLight);

    // マテリアル
    this.materials = [
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
      new THREE.MeshBasicMaterial(App3.MATERIAL_PARAM),
    ];
    this.materials[0].map = this.texture1;
    this.materials[1].map = this.texture2;
    this.materials[2].map = this.texture3;
    this.materials[3].map = this.texture4;
    this.materials[4].map = this.texture5;
    this.materials[5].map = this.texture6;
    this.materials[6].map = this.texture7;
    this.materials[7].map = this.texture8;
    this.materials[8].map = this.texture9;
    this.materials[9].map = this.texture10;
    // 交差時に表示するためのマテリアルを定義 @@@
    this.hitMaterial = new THREE.MeshBasicMaterial(App3.INTERSECTION_MATERIAL_PARAM);


    // グループ
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // メッシュを配列で管理
    this.planeGeometries = []; // 各テクスチャ用のジオメトリ配列
    this.meshes = [];

    // 各画像の遷移先URL
    const urls = [
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

    const planeHeight = 1.5; // 高さを1.5に拡大
    for (let i = 0; i < this.materials.length; i++) {
      // テクスチャのアスペクト比に合わせたジオメトリを作成
      const aspect = this.textures[i].userData.aspect || 1;
      const geometry = new THREE.PlaneGeometry(aspect * planeHeight, planeHeight);
      this.planeGeometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, this.materials[i]);
      const targetX = i * this.width; // 最終的な目標位置
      // 初期位置は真ん中（カメラの前）に重ねて配置、画面外から開始
      mesh.position.x = 0;
      mesh.position.y = 0;
      mesh.position.z = 10; // 画面外（奥）から開始
      mesh.rotation.y = Math.PI / 2 + this.meshTilt;

      // userData はオブジェクトに任意のデータを保存できるプロパティ
      // ここではアニメーション用のデータを保存
      mesh.userData.targetX = targetX;  // 目標のX座標
      mesh.userData.currentX = targetX;  // 現在のX座標（スクロール用）
      mesh.userData.originalY = 0;      // 元のY座標
      mesh.userData.originalZ = 0;      // 元のZ座標（lerp の戻り先として使用）
      mesh.userData.originalQuaternion = mesh.quaternion.clone();  // 元の角度
      mesh.userData.isHovered = false;  // ホバー状態のフラグ（mousemove で更新）
      mesh.userData.isClick = false;  // クリック状態のフラグ
      mesh.userData.delay = (this.materials.length - 1 - i) * 0.2;  // 奥（最後）から順番にアニメーション
      mesh.userData.phase2Delay = i * 0.15; // フェーズ2の遅延
      mesh.userData.url = urls[i];  // 遷移先URL
      this.meshes.push(mesh);
      this.scene.add(mesh);
    }
    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;

    // ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);

    // 波紋トランジション用のシェーダーマテリアルとメッシュを作成
    this.createRippleFullscreen();

    // イベントリスナーを設定（カメラとメッシュの初期化後に実行）
    this.setupEventListeners();
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
      uniform float uTexture1Flipped; // 1.0 = 画像（反転必要）, 0.0 = 動画（反転不要）
      uniform float uTexture2Flipped;

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

        // UVをそのまま使用（元の画像のアスペクト比を維持）
        vec2 uv1 = distortedUv;
        vec2 uv2 = distortedUv;

        // 画像テクスチャのみX反転（動画は反転不要）
        if (uTexture1Flipped > 0.5) uv1.x = 1.0 - uv1.x;
        if (uTexture2Flipped > 0.5) uv2.x = 1.0 - uv2.x;

        // テクスチャサンプリング
        vec4 tex1 = texture2D(uTexture1, uv1);
        vec4 tex2 = texture2D(uTexture2, uv2);

        // 中心から外側に向かって徐々に切り替わる
        // progressが進むにつれて、より外側まで新しい画像が広がる
        float radius = uProgress * 1.2; // 切り替わりの半径（progressに比例）
        float mixFactor = smoothstep(radius - 0.3, radius, dist);
        mixFactor = 1.0 - mixFactor; // 中心が1、外側が0

        // 画像テクスチャにのみガンマ補正を適用（動画は適用しない）
        // 画像の場合: uTextureXFlipped > 0.5 なのでガンマ補正を適用
        if (uTexture1Flipped > 0.5) {
          tex1.rgb = pow(tex1.rgb, vec3(1.0 / 2.2));
        }
        if (uTexture2Flipped > 0.5) {
          tex2.rgb = pow(tex2.rgb, vec3(1.0 / 2.2));
        }

        // 色を混合（tex1が古い画像、tex2が新しい画像）
        vec4 finalColor = mix(tex1, tex2, mixFactor);

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
      },
      transparent: true,
    });

    // 初期プレーンジオメトリ（後で画像に合わせてサイズ更新）
    const fullscreenGeometry = new THREE.PlaneGeometry(1, 1); // 仮のサイズ
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
      // render()内でカメラをアニメーション
      if (this.isCameraAnimating && this.cameraTargetPosition) {
        // lerpで滑らかに移動（0.05は補間係数、小さいほどゆっくり）
        this.camera.position.lerp(this.cameraTargetPosition, 0.09);

        // 戻り中はカメラを原点に向ける
        if (this.isReturning) {
          this.camera.lookAt(App3.CAMERA_PARAM.lookAt);
          // メッシュの回転を元に戻す
          this.meshes.forEach((mesh) => {
            mesh.rotation.x = 0;
            mesh.rotation.z = 0;
            mesh.rotation.y += (Math.PI / 2 + this.meshTilt - mesh.rotation.y) * 0.1;
          });
        }
        // 初期アニメーション中はカメラだけ移動、メッシュの向きは変えない
        // ボタンによるカメラ移動モード（isCameraMoved）の場合のみメッシュの回転を変更
        else if (!this.isInitialAnimation && this.isCameraMoved && !this.isFullscreenMode) {
          // カメラ移動中は正面を向ける
          this.camera.lookAt(0, 0, -1);

          this.meshes.forEach((mesh) => {
            // メッシュを正面（Z軸方向）に向ける
            mesh.rotation.x = 0;
            mesh.rotation.z = 0;
            mesh.rotation.y += (0 - mesh.rotation.y) * 0.1;
          });
        }

        // 目標位置に十分近づいたらアニメーション終了
        if (this.camera.position.distanceTo(this.cameraTargetPosition) < 0.01) {
          this.isCameraAnimating = false;
          if (this.isReturning) {
            this.isCameraMoved = false;
            this.isReturning = false;
            // カメラの向きを完全に元に戻す
            this.camera.lookAt(App3.CAMERA_PARAM.lookAt);
          }
        }
      }

    // 波紋トランジションのアニメーション処理
    if (this.isFullscreenMode && this.rippleMaterial) {
      // 時間を更新
      this.rippleMaterial.uniforms.uTime.value += 0.016;
      this.rippleMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

      // カメラをフルスクリーンメッシュに向ける
      this.camera.lookAt(this.fullscreenMesh.position);

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

    // 破棄済みならアニメーションループを停止
    if (this.isDisposed) return;

    requestAnimationFrame(this.render);
    this.controls.update();
    // if (this.isDown === true) {
    //   this.group.rotation.y += 0.05;
    // }

    // 初期アニメーション処理
    if (this.isInitialAnimation) {
      this.initialAnimationProgress += 0.019; // 約60fpsで1秒間で約1.0になる

      // イージング関数（easeOutCubic）を適用
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      if (this.initialAnimationPhase === 1) {
        // フェーズ1: 画面外（奥）から真ん中に順番に並ぶ
        let allPhase1Completed = true;
        this.meshes.forEach((mesh) => {
          const delayedProgress = Math.max(0, this.initialAnimationProgress - mesh.userData.delay);

          if (delayedProgress > 0) {
            const easedProgress = easeOutCubic(Math.min(delayedProgress, 1));

            // 下から上がってきて立ち上がる
            const startY = -10;
            const index = this.meshes.indexOf(mesh);
            mesh.position.z = 0;// 後のカードほど手前（カメラに近い）
            mesh.position.x =  index *.2;
            mesh.position.y = startY + (0 - startY) * easedProgress;

            // カメラを向く + 傾き（回転順序をZYXに変更）
            const tiltAngle = Math.PI * 2 * (1 - easedProgress);
            mesh.rotation.order = 'ZYX';
            mesh.rotation.y = Math.PI / 2;  // カメラを向く
            mesh.rotation.z = tiltAngle;    // 傾き（正面から見て回転）
            mesh.rotation.x = 0;
            if (easedProgress < 1) {
              allPhase1Completed = false;
            }
          } else {
            allPhase1Completed = false;
          }
        });

        // フェーズ1完了後、フェーズ2へ移行
        if (allPhase1Completed) {
          this.initialAnimationPhase = 2;
          this.initialAnimationProgress = -0.3; // 少し待機してから開始
          // 回転順序をデフォルトに戻し、回転を確定
          this.meshes.forEach((mesh, index) => {
            mesh.rotation.order = 'XYZ';
            mesh.rotation.set(0, Math.PI / 2, 0);
            // 円状配置の目標位置を計算（X軸中心、YZ平面上の円）
            const radius = 1.5;
            const count = this.meshes.length;
            const angle = (index / count) * Math.PI * 2;
            // Zファイティング防止：各カードに微妙なX方向オフセット
            mesh.userData.circleTargetX = index * 0.02;
            mesh.userData.circleTargetY = Math.sin(angle) * radius;
            mesh.userData.circleTargetZ = Math.cos(angle) * radius;
            // 現在位置を保存（円状配置の開始位置）
            mesh.userData.phase2StartX = mesh.position.x;
            mesh.userData.phase2StartY = mesh.position.y;
            mesh.userData.phase2StartZ = mesh.position.z;
          });
          // カメラを横から見る位置へ移動開始（X軸方向から）
          this.cameraTargetPosition = new THREE.Vector3(-6.0, 0, 0);
          this.isCameraAnimating = true;
        }
      } else if (this.initialAnimationPhase === 2) {
        // フェーズ2: 重なった状態からX軸を起点に円状に展開（YZ平面上の円）
        let allPhase2Completed = true;
        const radius = 1.5;
        const count = this.meshes.length;

        // よりスムーズなイージング関数（ゆっくり開始）
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        this.meshes.forEach((mesh, index) => {
          const delayedProgress = Math.max(0, this.initialAnimationProgress - index * 0.02);

          if (delayedProgress > 0) {
            const easedProgress = easeOutQuart(Math.min(delayedProgress, 1));

            // 開始位置から円状配置の目標位置へ補間
            mesh.position.x = mesh.userData.phase2StartX + (mesh.userData.circleTargetX - mesh.userData.phase2StartX) * easedProgress;
            mesh.position.y = mesh.userData.phase2StartY + (mesh.userData.circleTargetY - mesh.userData.phase2StartY) * easedProgress;
            mesh.position.z = mesh.userData.phase2StartZ + (mesh.userData.circleTargetZ - mesh.userData.phase2StartZ) * easedProgress;

            // 現在位置から中心への角度を計算し、下辺が中心を向く
            mesh.rotation.y = Math.PI / 2; // カメラ方向を向く
            mesh.rotation.x = 0;
            mesh.rotation.z = Math.atan2(mesh.position.z, mesh.position.y);

            if (easedProgress < 1) {
              allPhase2Completed = false;
            }
          } else {
            allPhase2Completed = false;
          }
        });

        // フェーズ2完了後、少し回転させてからフェーズ3へ
        if (allPhase2Completed) {
          // 回転進捗を更新（イージング用）
          if (!this.circleRotationProgress) this.circleRotationProgress = 0;
          this.circleRotationProgress += 0.008;

          // イージング関数を適用してスムーズに加速・減速
          const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
          const targetRotation = Math.PI * 0.5; // 90度
          const easedProgress = easeInOutSine(Math.min(this.circleRotationProgress, 1));
          this.circleAnimationRotation = easedProgress * targetRotation;

          // X軸周りに回転しながら待機（テクスチャの下辺が中心を向く）
          this.meshes.forEach((mesh, index) => {
            const baseAngle = (index / count) * Math.PI * 2;
            const currentAngle = baseAngle + this.circleAnimationRotation;
            // Zファイティング防止：オフセットを維持
            mesh.position.x = index * 0.02;
            mesh.position.y = Math.sin(currentAngle) * radius;
            mesh.position.z = Math.cos(currentAngle) * radius;
            // 現在位置から中心への角度を計算し、下辺が中心を向く
            mesh.rotation.y = Math.PI / 2;
            mesh.rotation.x = 0;
            mesh.rotation.z = Math.atan2(mesh.position.z, mesh.position.y);
          });

          // 一定量回転したらフェーズ3へ移行
          if (this.circleRotationProgress >= 1) {
            this.initialAnimationPhase = 3;
            this.initialAnimationProgress = 0;
            this.circleRotationProgress = 0; // リセット
            // 円状配置の終了位置を保存
            this.meshes.forEach((mesh) => {
              mesh.userData.phase3StartX = mesh.position.x;
              mesh.userData.phase3StartY = mesh.position.y;
              mesh.userData.phase3StartZ = mesh.position.z;
              mesh.userData.phase3StartRotationY = mesh.rotation.y;
              mesh.userData.phase3StartRotationZ = mesh.rotation.z;
            });
            // カメラを横から見る位置へ移動
            this.cameraTargetPosition = new THREE.Vector3(-2.0, .8, 3.0);
            this.isCameraAnimating = true;
          }
        }
      } else if (this.initialAnimationPhase === 3) {
        // フェーズ3: 円状から横一列に展開
        let allPhase3Completed = true;
        this.meshes.forEach((mesh) => {
          const delayedProgress = Math.max(0, this.initialAnimationProgress);

          if (delayedProgress > 0) {
            const easedProgress = easeOutCubic(Math.min(delayedProgress, 1));

            // 円状配置から横一列へ補間
            mesh.position.x = mesh.userData.phase3StartX + (mesh.userData.targetX - mesh.userData.phase3StartX) * easedProgress;
            mesh.position.y = mesh.userData.phase3StartY + (0 - mesh.userData.phase3StartY) * easedProgress;
            mesh.position.z = mesh.userData.phase3StartZ + (0 - mesh.userData.phase3StartZ) * easedProgress;

            // 回転も横一列用に補間（Z軸回転を0に戻す）
            const targetRotationY = Math.PI / 2 + this.meshTilt;
            const targetRotationZ = 0;
            mesh.rotation.y = mesh.userData.phase3StartRotationY + (targetRotationY - mesh.userData.phase3StartRotationY) * easedProgress;
            mesh.rotation.z = mesh.userData.phase3StartRotationZ + (targetRotationZ - mesh.userData.phase3StartRotationZ) * easedProgress;

            if (easedProgress < 1) {
              allPhase3Completed = false;
            }
          } else {
            allPhase3Completed = false;
          }
        });

        // 全てのアニメーションが完了したら通常モードへ
        if (allPhase3Completed) {
          this.isInitialAnimation = false;
          this.meshes.forEach((mesh) => {
            mesh.position.x = mesh.userData.targetX;
            mesh.position.y = 0;
            mesh.position.z = 0;

            mesh.userData.currentX = mesh.userData.targetX;
            // 回転順序をデフォルトに戻し、回転を確定
            mesh.rotation.order = 'XYZ';
            mesh.rotation.set(0, Math.PI / 2 + this.meshTilt, 0);
            // quaternionも更新（通常モードでslerpに使われる）
            mesh.userData.originalQuaternion = mesh.quaternion.clone();
          });
        }
      }

      this.renderer.render(this.scene, this.camera);
      return; // 初期アニメーション中はスクロール処理をスキップ
    }

    // フルスクリーンモード中はスクロール処理をスキップ
    if (this.isFullscreenMode) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.scrollOffset += 0.01;
    // ホイールスクロールに合わせて位置を更新
    this.meshes.forEach((mesh, index) => {
      // スクロールオフセットに基づいてX座標を更新
      mesh.userData.currentX -= this.scrollOffset;

      // 無限ループの処理（左端を超えたら右端に移動）
      const totalWidth = this.width * this.meshes.length;
      while (mesh.userData.currentX < -this.width - 3) {
        mesh.userData.currentX += totalWidth;
      }
      // 右端を超えたら左端に移動（逆スクロール対応）
      while (mesh.userData.currentX > totalWidth - this.width) {
        mesh.userData.currentX -= totalWidth;
      }
    });

    // スクロールオフセットをリセット（次フレームで使用するため）
    this.scrollOffset = 0;

    // 円状配置モード中は自動回転
    if (this.isCameraMoved && !this.isReturning) {
      this.circleRotation += 0.005; // 回転速度
    }

    // メッシュをホバー時に滑らかに浮かせる（lerp による補間アニメーション）
    // lerp（線形補間）とは、現在の値から目標値へ徐々に近づける手法
    // 計算式: 現在値 += (目標値 - 現在値) * 補間係数
    // 補間係数が小さいほど、ゆっくりと滑らかに移動する
    this.meshes.forEach((mesh) => {
      // ホバー中なら元の位置 + 0.3、そうでなければ元の位置を目標値とする
      if (!mesh.userData.isClick) {
        const targetZ = mesh.userData.isHovered ? mesh.userData.originalZ + 0.3 : mesh.userData.originalZ;
        mesh.position.y += (targetZ - mesh.position.y) * 0.1;
      }

      // 現在のZ座標から目標値へ、毎フレーム10%ずつ近づける（補間係数 0.1）
      // 例: 現在0、目標0.3の場合
      //   1フレーム目: 0 + (0.3 - 0) * 0.1 = 0.03
      //   2フレーム目: 0.03 + (0.3 - 0.03) * 0.1 = 0.057
      //   ...徐々に0.3に近づく（イージングアウト効果）

      if (mesh.userData.isClick) {
            // カメラ基準の位置（例: camera.position.z - 2 など）
            const targetZ = this.camera.position.z - 2; // カメラから2単位手前
            mesh.position.x += (0 - mesh.position.x) * 0.1; // 画面中央のx
            mesh.position.y += (0 - mesh.position.y) * 0.1; // 画面中央のy
            mesh.position.z += (targetZ - mesh.position.z) * 0.1; // カメラの前
            const targetQuaternion = this.camera.quaternion.clone();
            mesh.quaternion.slerp(targetQuaternion, 0.5);
      } else if (this.isCameraMoved && !this.isReturning) {
        // 円状配置を回転
        const radius = 2;
        const count = this.meshes.length;
        const index = this.meshes.indexOf(mesh);
        const baseAngle = (index / count) * Math.PI * 2;
        const currentAngle = baseAngle + this.circleRotation;

        // 回転後の目標位置を計算
        const targetX = Math.sin(currentAngle) * radius;
        const targetZ = Math.cos(currentAngle) * radius;

        // カメラ移動モード中は円状配置へ補間
        mesh.position.x += (targetX - mesh.position.x) * 0.1;
        mesh.position.y += (mesh.userData.circleY - mesh.position.y) * 0.1;
        mesh.position.z += (targetZ - mesh.position.z) * 0.1;
        // カメラを正面（Z軸マイナス方向）に向ける
        this.camera.lookAt(0, 0, -1);
      } else if (this.isReturning) {
        // 戻り中は補間で元の位置へ
        mesh.position.x += (mesh.userData.currentX - mesh.position.x) * 0.1;
        mesh.position.y += (mesh.userData.originalY - mesh.position.y) * 0.1;
        mesh.position.z += (mesh.userData.originalZ - mesh.position.z) * 0.1;
      } else {
        // 通常時はX座標を直接代入（無限ループ対応）、Y/Zは補間
        mesh.position.x = mesh.userData.currentX;
        mesh.position.y += (mesh.userData.originalY - mesh.position.y) * 0.1;
        mesh.position.z += (mesh.userData.originalZ - mesh.position.z) * 0.1;
      }
      // カメラ移動モード中はメッシュをカメラ（原点）に向ける、それ以外は元の回転
      if (this.isCameraMoved && !this.isReturning) {
        // カメラを向くようにY軸回転を計算（+Math.PIで表面をカメラに向ける）
        const targetRotationY = Math.atan2(
          this.camera.position.x - mesh.position.x,
          this.camera.position.z - mesh.position.z
        ) + Math.PI;
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        mesh.rotation.y += (targetRotationY - mesh.rotation.y) * 0.1;
      } else if (!this.isReturning) {
        const Rotate = mesh.userData.isClick ? 0 : Math.PI / 2 + this.meshTilt;
        // Y軸の回転を滑らかに補間
        mesh.rotation.y += (Rotate - mesh.rotation.y) * 0.1;
      }
      // 戻り中は上のカメラアニメーション部分で回転を処理
      // クリック時にスケールも拡大
      const targetScale = mesh.userData.isClick ? 3.0 : 1.0;
      mesh.scale.lerp(this._tempVec3.set(targetScale, targetScale, targetScale), 0.1);
    });

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * リソースの破棄
   */
  dispose() {
    // アニメーションループを停止
    this.isDisposed = true;

    // SVGマウスストーカーを非表示
    const textureStalker = document.querySelector('.js-texture-stalker');
    if (textureStalker) {
      textureStalker.classList.remove('is-active');
    }

    // イベントリスナーは自動的にページ遷移で破棄される

    // Three.jsリソースの破棄
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }

    this.planeGeometries?.forEach((geometry) => {
      geometry.dispose();
    });

    this.materials?.forEach((material) => {
      material.dispose();
    });

    this.textures?.forEach((texture) => {
      texture.dispose();
    });

    // 動画要素の破棄
    this.videoElements?.forEach((video) => {
      video.pause();
      video.src = '';
      video.load();
    });

    if (this.hitMaterial) {
      this.hitMaterial.dispose();
    }

    // 波紋シェーダーマテリアルの破棄
    if (this.rippleMaterial) {
      this.rippleMaterial.dispose();
    }

    // フルスクリーンメッシュのジオメトリ破棄
    if (this.fullscreenMesh) {
      this.fullscreenMesh.geometry.dispose();
    }
  }
}
