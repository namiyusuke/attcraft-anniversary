import * as THREE from "three";

// 頂点シェーダー（紙めくりエフェクト - 斜め下から）
const vertexShader = `
  uniform float uCurl;
  uniform float uRadius;
  uniform float uAspect;
  uniform float uAngle;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // アスペクト比を適用
    pos.x *= uAspect;

    // 斜めめくりの方向ベクトル（右下から左上へ）
    float angle = uAngle; // ラジアン（例: 0.785 = 45度）
    vec2 dir = vec2(cos(angle), sin(angle)); // めくり方向
    vec2 normal = vec2(-sin(angle), cos(angle)); // 境界線に垂直

    // 右下の角を起点
    vec2 corner = vec2(0.5 * uAspect, -0.5);

    // 境界線の位置（右下から斜めに移動）
    float maxDist = length(vec2(uAspect, 1.0)); // 対角線の長さ
    vec2 linePos = corner - dir * uCurl * maxDist;

    // 頂点から境界線までの距離（符号付き）
    vec2 toVertex = vec2(pos.x, pos.y) - linePos;
    float dist = dot(toVertex, dir);

    // 境界より外側（右下側）を円筒状に巻く
    if (dist > 0.0) {
      float theta = dist / uRadius;

      // 円筒に沿って移動
      float newDist = sin(theta) * uRadius;
      pos.z = (1.0 - cos(theta)) * uRadius;

      // 元の位置から境界線方向に移動
      pos.x = linePos.x + dir.x * newDist + normal.x * dot(toVertex, normal);
      pos.y = linePos.y + dir.y * newDist + normal.y * dot(toVertex, normal);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// フラグメントシェーダー
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uCurl;

  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(uTexture, vUv);
    gl_FragColor = vec4(color.rgb, 1.0);
  }
`;

class DetailCanvas {
  canvas: HTMLCanvasElement | null = null;
  imgElement: HTMLImageElement | null = null;
  scene: THREE.Scene | null = null;
  camera: THREE.OrthographicCamera | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  mesh: THREE.Mesh | null = null;
  material: THREE.ShaderMaterial | null = null;
  animationId: number | null = null;
  isHovering: boolean = false;
  targetCurl: number = 0.7;
  currentCurl: number = 0.7;
  aspect: number = 1;
  resizeHandler: (() => void) | null = null;

  constructor() {
    this.init();
  }

  init() {
    this.canvas = document.getElementById("detail-canvas") as HTMLCanvasElement;
    this.imgElement = document.getElementById("detail-canvas-img") as HTMLImageElement;
    if (!this.canvas || !this.imgElement) return;

    // シーン作成
    this.scene = new THREE.Scene();

    // カメラ作成（正投影）
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    this.camera.position.z = 1;

    // レンダラー作成
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // img要素のsrcからテクスチャを読み込み
    const loader = new THREE.TextureLoader();
    loader.load(this.imgElement.src, (texture) => {
      this.setupMesh(texture);
      this.resize();
      this.animate();
      // ページ遷移後、少し遅延してから紙を開くアニメーション
      setTimeout(() => {
        this.targetCurl = 0;
      }, 500);
    });

    // ホバーイベント(確認用)
    // this.canvas.addEventListener("mouseenter", () => {
    //   this.isHovering = true;
    //   this.targetCurl = 0;
    // });
    // this.canvas.addEventListener("mouseleave", () => {
    //   this.isHovering = false;
    //   this.targetCurl = 0.7;
    // });

    this.resizeHandler = () => this.resize();
    window.addEventListener("resize", this.resizeHandler);
  }

  setupMesh(texture: THREE.Texture) {
    if (!this.scene) return;

    const geometry = new THREE.PlaneGeometry(1, 1, 64, 64);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uCurl: { value: 0.7 },
        uRadius: { value: 0.15 },
        uAspect: { value: 1 },
        uAngle: { value: -Math.PI / 3 },
      },
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  resize() {
    if (!this.canvas || !this.renderer || !this.camera || !this.imgElement) return;

    const width = this.imgElement.clientWidth;
    const height = this.imgElement.clientHeight;

    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.aspect = width / height;
    this.camera.left = -0.5 * this.aspect;
    this.camera.right = 0.5 * this.aspect;
    this.camera.top = 0.5;
    this.camera.bottom = -0.5;
    this.camera.updateProjectionMatrix();

    if (this.material) {
      this.material.uniforms.uAspect.value = this.aspect;
    }
  }

  animate() {
    if (!this.renderer || !this.scene || !this.camera || !this.material) return;

    this.currentCurl += (this.targetCurl - this.currentCurl) * 0.03;
    this.material.uniforms.uCurl.value = this.currentCurl;

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
  }
}

// グローバルインスタンス
let detailCanvas: DetailCanvas | null = null;

export function initDetailCanvas() {
  if (detailCanvas) {
    detailCanvas.destroy();
  }
  if (document.getElementById("detail-canvas")) {
    detailCanvas = new DetailCanvas();
  }
}

export function destroyDetailCanvas() {
  if (detailCanvas) {
    detailCanvas.destroy();
    detailCanvas = null;
  }
}

// 初回実行
initDetailCanvas();

// swupページ遷移時に再初期化
window.addEventListener("swup:pageview", () => {
  initDetailCanvas();
});
