import { useEffect, useRef } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
// @ts-ignore
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
// @ts-ignore
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
// @ts-ignore
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
// @ts-ignore
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader';
// @ts-ignore
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader';

export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Elite Nova Colors
    const bgColor       = '#020b1f';  // Deep dark blue
    const flameColor    = '#b08d57';  // Gold
    const flameColor2   = '#e8d9b5';  // Light gold
    const flameAmt      = 0.25;       // corner-flame intensity
    const atmoColor     = '#e8d9b5';  // ambient motes color
    const atmoCount     = 300;        // mote count
    const atmoSize      = 24;         // mote base size
    const atmoSpeed     = 1.0;        // mote warp speed
    const colorLow      = '#020b1f';  // points low color
    const colorHigh     = '#b08d57';  // points high color
    const opacity       = 0.35;       // point opacity
    const pointSize     = 5.5;        // point base size
    const brightness    = 0.55;       // point color multiplier
    const waveHeight    = 3;          // base swell amplitude
    const flow          = 1;          // noise scroll speed
    const tilt          = 0;          // sheet X rotation (negated)
    const scale         = 0.275;      // shrinks the sheet to frame
    const scrollRise    = 1.0;        // swell amplitude growth on scroll
    const camStartY     = 7,  camStartZ = 16;
    const camEndY       = 0.8, camEndZ  = -2;
    const lookStartZ    = 2,  lookEndZ  = -16;
    const parallax      = 1.2;
    const pointerRadius   = 7.0;
    const pointerStrength = 0.9;

    const Lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    function hexToVec3(hex: string) {
      const n = parseInt(hex.slice(1), 16);
      return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    }

    const sceneObj = {
      scrollCurrent: 0,
      scrollSmooth: 0,
      scrollTarget: 0,
      mouse: { x: 0, y: 0 },
      mouseTarget: { x: 0, y: 0 },
      POINTER: { world: new THREE.Vector3(), activity: 0, active: false, lastMove: performance.now() },
      stream: 0,
      t0: performance.now() / 1000,
      appearStart: performance.now()
    };

    // --- SETUP SCENE ---
    const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    
    // Configurar color de fondo directamente en el CSS del renderer/canvas
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '-1';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    renderer.domElement.style.background = bgColor;
    
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 0, 15);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 7, 16);
    camera.layers.enable(LAYERS.TORUS_SCENE);
    camera.layers.enable(LAYERS.BLOOM_SCENE);
    camera.layers.enable(LAYERS.ENTIRE_SCENE);
    scene.add(camera);

    // --- POSTPROCESSING ---
    const renderPass = new RenderPass(scene, camera);

    const torusComposer = new EffectComposer(renderer);
    torusComposer.renderToScreen = false;
    torusComposer.addPass(renderPass);
    torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
    torusComposer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.2, 0));
    torusComposer.addPass(new ShaderPass(CopyShader));

    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderPass);
    bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.55, 0));
    bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));

    const finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderPass);

    // Final Pass Shader
    const finalPassShader = {
      uniforms: {
        iTime: { value: 0 },
        tDiffuse: { value: null },
        torusTexture: { value: torusComposer.renderTarget1.texture },
        bloomTexture: { value: bloomComposer.renderTarget1.texture },
        haloTexture: { value: null }, 
        uBg: { value: hexToVec3(bgColor) },
        uFlameA: { value: hexToVec3(flameColor) },
        uFlameB: { value: hexToVec3(flameColor2) },
        uFlameAmt: { value: flameAmt }
      },
      vertexShader: `
        varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float iTime; uniform sampler2D tDiffuse; uniform sampler2D bloomTexture; uniform sampler2D torusTexture; uniform sampler2D haloTexture;
        uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
        varying vec2 vUv;
        vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
          pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
          pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
          pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
          return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
        void main(){
          vec2 uv = 2.*vUv - 1.;
          vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
          vec3 flame = 1.5*uFlameA*w.x; flame*=w.y; flame += uFlameB*w.z;
          flame *= smoothstep(0.25, 1., abs(uv.y));
          float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
          vec3 bg = uBg * (1.0 - 0.4 * length(uv));
          
          vec4 diff = texture2D(tDiffuse, vUv);
          vec4 bloom = texture2D(bloomTexture, vUv);
          vec4 torus = texture2D(torusTexture, vUv);
          
          gl_FragColor = vec4(bg + flame*uFlameAmt + bloom.xyz + torus.xyz + diff.xyz, 1.0);
        }
      `
    };
    const finalPass = new ShaderPass(finalPassShader);
    finalComposer.addPass(finalPass);

    // --- GEOMETRY ---
    const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

    const pointGeometry = new THREE.SphereGeometry(4.2, 200, 600);
    const pointMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uStream: { value: 0 },
        uAppear: { value: 0 },
        uColLow: { value: hexToVec3(colorLow) },
        uColHigh: { value: hexToVec3(colorHigh) },
        uOpacity: { value: opacity },
        uSize: { value: pointSize },
        uBrightness: { value: brightness },
        uWaveHeight: { value: waveHeight },
        uFlow: { value: flow },
        uScale: { value: scale },
        uCursor: { value: new THREE.Vector3() },
        uRepelRadius: { value: pointerRadius },
        uRepelStrength: { value: pointerStrength },
        uActivity: { value: 0 }
      },
      vertexShader: `
        uniform float uTime; uniform float uStream; uniform float uSize; uniform float uWaveHeight; uniform float uFlow; uniform float uScale;
        uniform vec3 uColLow; uniform vec3 uColHigh;
        uniform vec3 uCursor; uniform float uRepelRadius; uniform float uRepelStrength; uniform float uActivity;
        varying float vFade; varying vec3 vColor;
        ${SNOISE}
        void main() {
          vec3 wp = vec3(position.x * 13.0, 0.0, position.z * 25.0);
          wp.x += position.y * 6.0;
          float zc = wp.z + uStream;
          float wn = snoise(vec3(wp.x * 0.08, zc * 0.08, uTime * 0.15 * uFlow)) * 2.0;
          wn += snoise(vec3(wp.x * 0.16, zc * 0.16, uTime * 0.3 * uFlow)) * 0.8;
          wp.y += wn * uWaveHeight;

          vec3 finalPos = wp * uScale;
          vec4 modelPosition = modelMatrix * vec4(finalPos, 1.0);
          vec3 toP = modelPosition.xyz - uCursor;
          float cd = length(toP);
          float fall = smoothstep(uRepelRadius, 0.0, cd);
          modelPosition.xyz += normalize(toP + vec3(0.0001)) * fall * uRepelStrength * uActivity;
          vec4 mvPosition = viewMatrix * modelPosition;

          float colMix = smoothstep(-3.0, 3.0, position.y + position.x * 0.5);
          vColor = mix(uColLow, uColHigh, clamp(colMix, 0.0, 1.0));
          vFade = 1.0;

          gl_PointSize = uSize * (10.0 / -mvPosition.z);
          gl_PointSize = max(gl_PointSize, 1.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity; uniform float uBrightness; uniform float uAppear;
        varying float vFade; varying vec3 vColor;
        void main() {
          vec2 xy = gl_PointCoord - 0.5;
          float ll = length(xy);
          if (ll > 0.5) discard;
          float a = smoothstep(0.5, 0.1, ll);
          gl_FragColor = vec4(vColor * uBrightness, vFade * a * uOpacity * uAppear);
        }
      `
    });

    const points = new THREE.Points(pointGeometry, pointMaterial);
    points.frustumCulled = false;
    points.layers.enable(LAYERS.ENTIRE_SCENE);
    const group = new THREE.Group();
    group.add(points);
    scene.add(group);

    // --- ATMOSPHERE (Motes) ---
    const N = Math.round(atmoCount);
    const positions = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const seeds = new Float32Array(N);
    for(let i = 0; i < N; i++) {
      positions[i*3]   = 2*Math.random()-1;
      positions[i*3+1] = 2*Math.random()-1;
      positions[i*3+2] = 2*Math.random()-1;
      sizes[i] = atmoSize * (0.4 + Math.random());
      seeds[i] = Math.random();
    }
    const atmoGeo = new THREE.BufferGeometry();
    atmoGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    atmoGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    atmoGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

    const atmoMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: hexToVec3(atmoColor) },
        uRes: { value: new THREE.Vector2(window.innerWidth*window.devicePixelRatio, window.innerHeight*window.devicePixelRatio) }
      },
      vertexShader: `
        attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
        varying float vA;
        vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
          p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
          p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
          return cos(p+vec3(1,2,4)); }
        void main(){
          vec3 v = position*4.0 + warp(position, uTime)*1.2;
          vec4 mv = modelViewMatrix * vec4(v, 1.0);
          float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
          vA = farF * nearF;
          gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor; varying float vA;
        void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
          float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.6); }
      `
    });

    const motes = new THREE.Points(atmoGeo, atmoMat);
    motes.frustumCulled = false;
    motes.layers.enable(LAYERS.ENTIRE_SCENE);
    scene.add(motes);

    // --- EVENTS ---
    const handleMouseMove = (e: MouseEvent) => {
      sceneObj.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      sceneObj.mouseTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
      sceneObj.POINTER.active = true;
      sceneObj.POINTER.lastMove = performance.now();
    };

    const handleMouseOut = () => {
      sceneObj.POINTER.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseout', handleMouseOut, { passive: true });

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      
      torusComposer.setPixelRatio(dpr);
      torusComposer.setSize(w, h);
      bloomComposer.setPixelRatio(dpr);
      bloomComposer.setSize(w, h);
      finalComposer.setPixelRatio(dpr);
      finalComposer.setSize(w, h);
      
      atmoMat.uniforms.uRes.value.set(w * dpr, h * dpr);
    };
    window.addEventListener('resize', handleResize);

    // --- ANIMATION LOOP ---
    const _ndc = new THREE.Vector3(), _dir = new THREE.Vector3(), _tgt = new THREE.Vector3();
    let animationFrameId: number;

    const renderLoop = () => {
      const t = performance.now() / 1000;
      const dt = Math.min(0.05, t - sceneObj.t0);
      sceneObj.t0 = t;

      pointMaterial.uniforms.uTime.value = t;
      
      sceneObj.stream += dt * (flow * 2.0) * 4.0;
      pointMaterial.uniforms.uStream.value = sceneObj.stream;
      
      sceneObj.scrollSmooth = Lerp(sceneObj.scrollSmooth, sceneObj.scrollTarget, 0.10);
      sceneObj.scrollCurrent = Lerp(sceneObj.scrollCurrent, sceneObj.scrollSmooth, 0.06);
      sceneObj.mouse.x = Lerp(sceneObj.mouse.x, sceneObj.mouseTarget.x, 0.06);
      sceneObj.mouse.y = Lerp(sceneObj.mouse.y, sceneObj.mouseTarget.y, 0.06);

      pointMaterial.uniforms.uWaveHeight.value = waveHeight * (1 + sceneObj.scrollCurrent * scrollRise);

      const ea = Math.min(sceneObj.scrollCurrent / 0.35, 1.0);
      const e = ea * ea * (3 - 2 * ea);
      const camY = Lerp(camStartY, camEndY, e);
      const camZ = Lerp(camStartZ, camEndZ, e);
      camera.position.set(sceneObj.mouse.x * parallax, camY + sceneObj.mouse.y * parallax * 0.3, camZ);
      camera.lookAt(sceneObj.mouse.x * parallax * 0.5, Lerp(0.0, 0.6, e), Lerp(lookStartZ, lookEndZ, e));
      group.rotation.x = -tilt;
      group.rotation.y = 0;

      // Update Pointer World
      _tgt.set(0, 0, 0);
      if (sceneObj.POINTER.active) {
        _ndc.set(sceneObj.mouse.x, sceneObj.mouse.y, 0.5).unproject(camera);
        _dir.copy(_ndc).sub(camera.position).normalize();
        const dn = _dir.z;
        if (Math.abs(dn) > 1e-4) { 
          const tt = -camera.position.z / dn; 
          if (tt > 0 && Number.isFinite(tt)) _tgt.copy(camera.position).addScaledVector(_dir, tt); 
        }
      }
      sceneObj.POINTER.world.lerp(_tgt, 0.12);
      const idle = (performance.now() - sceneObj.POINTER.lastMove) / 1000;
      sceneObj.POINTER.activity += (((sceneObj.POINTER.active && idle < 3) ? 1 : 0) - sceneObj.POINTER.activity) * 0.06;

      pointMaterial.uniforms.uCursor.value.copy(sceneObj.POINTER.world);
      pointMaterial.uniforms.uActivity.value = sceneObj.POINTER.activity;
      
      const elapsed = (performance.now() - sceneObj.appearStart) / 1000;
      pointMaterial.uniforms.uAppear.value = Math.max(0, Math.min(1, (elapsed - 0.2) / 1.4));

      // Motes
      atmoMat.uniforms.uTime.value = t * atmoSpeed * 8.0;
      motes.position.copy(camera.position);
      finalPass.uniforms.iTime.value = t;

      // Render Layers
      camera.layers.set(LAYERS.TORUS_SCENE);  torusComposer.render();
      camera.layers.set(LAYERS.BLOOM_SCENE);  bloomComposer.render();
      camera.layers.set(LAYERS.ENTIRE_SCENE); finalComposer.render();

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    handleResize();
    renderLoop();

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      pointGeometry.dispose();
      pointMaterial.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      
      // En r143, para limpiar composers no existe .dispose(), pero sí podemos limpiar los renderTargets
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, zIndex: -1 }} />;
}
