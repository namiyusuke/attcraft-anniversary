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
      far: 20.0,
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

    this.isDown = false;
    this.speed = 0.01; // 移動速度
    this.width = 1; // メッシュ間の幅
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
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // ホバー/タッチ処理を共通化する関数
    const handlePointerMove = (clientX, clientY) => {
      const x = clientX / window.innerWidth * 2.0 - 1.0;
      const y = clientY / window.innerHeight * 2.0 - 1.0;
      const v = new THREE.Vector2(x, -y);

      this.raycaster.setFromCamera(v, this.camera);
      const intersects = this.raycaster.intersectObjects(this.meshes);

      this.meshes.forEach((mesh, index) => {
        mesh.material = this.materials[index];
        mesh.userData.isHovered = false;
      });

      if (intersects.length > 0) {
        intersects[0].object.userData.isHovered = true;
      }
    };

    // クリック/タッチ処理を共通化する関数
    let isNavigating = false; // 遷移中フラグ（二重遷移防止）

    const handlePointerClick = (clientX, clientY) => {
      // 既に遷移中なら何もしない
      if (isNavigating) return;

      const x = clientX / window.innerWidth * 2.0 - 1.0;
      const y = clientY / window.innerHeight * 2.0 - 1.0;
      const v = new THREE.Vector2(x, -y);
      this.raycaster.setFromCamera(v, this.camera);
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
    // カメラ移動ボタン
    const cameraMoveBtn = document.querySelector('#camera-move-btn');
    if (cameraMoveBtn) {
      cameraMoveBtn.addEventListener('click', () => {
        // 目標位置を原点の上に設定（メッシュを見下ろす）
        this.cameraTargetPosition = new THREE.Vector3(0, 0, 0);
        this.isCameraAnimating = true;
        this.isCameraMoved = true; // カメラ移動モードON
        // 円状配置の目標位置を計算
        const radius = 2; // 円の半径
        const count = this.meshes.length;
        this.meshes.forEach((mesh, i) => {
          const angle = (i / count) * Math.PI * 2; // 360度を均等に分割
          mesh.userData.circleX = Math.sin(angle) * radius;
          mesh.userData.circleZ = Math.cos(angle) * radius;
          mesh.userData.circleY = 0;
        });
      });
    }

    // 元に戻るボタン
    const cameraResetBtn = document.querySelector('#camera-reset-btn');
    if (cameraResetBtn) {
      cameraResetBtn.addEventListener('click', () => {
        // 初期位置に戻す
        this.cameraTargetPosition = this.cameraInitialPosition.clone();
        this.isCameraAnimating = true;
        this.isReturning = true; // 戻り中フラグ
      });
    }
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  async load() {
    // 読み込む画像のパス
    const imagePath = ['img/good_portforio.png','img/sakaba.png','img/sankou.webp','img/podcast.webp','img/app.png','img/arcraft.png','img/attcraft_4th.png','img/x_post_nami.png','img/x_post_kuu.png'];
    const loader = new THREE.TextureLoader();
    this.textures = await Promise.all(imagePath.map((texture) => {
      return new Promise((resolve) => {
        loader.load(texture, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1;  // 水平反転
        tex.offset.x = 1;   // 反転後の位置調整
        // テクスチャのアスペクト比を保存
        tex.userData = { aspect: tex.image.width / tex.image.height };
        resolve(tex);
          });
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
  }

  /**
   * 初期化処理
   */

  init() {
    // レンダラー
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setClearColor(new THREE.Color(App3.RENDERER_PARAM.clearColor), 0);
    this.renderer.setSize(App3.RENDERER_PARAM.width, App3.RENDERER_PARAM.height);
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
    this.controls.enabled = true;

    // ヘルパー
    const axesBarLength = 5.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);

    // イベントリスナーを設定（カメラとメッシュの初期化後に実行）
    this.setupEventListeners();
  }

  /**
   * 描画処理
   */
  render() {
      // render()内でカメラをアニメーション
      if (this.isCameraAnimating && this.cameraTargetPosition) {
        // lerpで滑らかに移動（0.05は補間係数、小さいほどゆっくり）
        this.camera.position.lerp(this.cameraTargetPosition, 0.09);

        // 初期アニメーション中はカメラだけ移動、メッシュの向きは変えない
        // ボタンによるカメラ移動モード（isCameraMoved）の場合のみメッシュの回転を変更
        if (!this.isInitialAnimation && this.isCameraMoved) {
          // カメラ移動中は正面を向ける
          if (!this.isReturning) {
            this.camera.lookAt(0, 0, -1);
          }

          this.meshes.forEach((mesh) => {
            if (this.isReturning) {
              // 戻り中は元の回転へ滑らかに補間
              mesh.rotation.x = 0;
              mesh.rotation.z = 0;
              mesh.rotation.y += (Math.PI / 2 + this.meshTilt - mesh.rotation.y) * 0.1;
            } else {
              // メッシュを正面（Z軸方向）に向ける
              mesh.rotation.x = 0;
              mesh.rotation.z = 0;
              mesh.rotation.y += (0 - mesh.rotation.y) * 0.1;
            }
          });
        }

        // 目標位置に十分近づいたらアニメーション終了
        if (this.camera.position.distanceTo(this.cameraTargetPosition) < 0.01) {
          this.isCameraAnimating = false;
          if (this.isReturning) {
            this.isCameraMoved = false;
            this.isReturning = false;
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
            this.cameraTargetPosition = new THREE.Vector3(-1.0, .8, 3.0);
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
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    });

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * リソースの破棄
   */
  dispose() {
    // アニメーションループを停止
    this.isDisposed = true;

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

    if (this.hitMaterial) {
      this.hitMaterial.dispose();
    }
  }
}
