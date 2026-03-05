import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import '@react-three/fiber';
/** @jsxImportSource react */

type AnimationMode = 'step_by_step' | 'exploded_view' | 'auto';

interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

interface ModelConfig {
  name: string;
  modelPath: string;
  background: string;
  defaultAnimation: string;
  animations: Record<string, { camera: CameraPreset }>;
  lighting: {
    ambient: number;
    directional: Array<{ position: [number, number, number]; intensity: number; castShadow?: boolean }>;
  };
  camera: { fov: number; near: number; far: number };
}

async function loadModelConfig(modelKey: string): Promise<ModelConfig | null> {
  try {
    const response = await fetch('/models.json');
    const configs: Record<string, ModelConfig> = await response.json();
    return configs[modelKey] || null;
  } catch (error) {
    console.warn(`Failed to load config for model "${modelKey}":`, error);
    return null;
  }
}

function getModelFromQuery(): string {
  if (typeof window === 'undefined') return 'drone';
  const params = new URLSearchParams(window.location.search);
  return params.get('model') || 'drone';
}

function getCustomGlbUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  let url = params.get('glbUrl') || params.get('modelUrl') || null;
  
  // If URL was appended twice (e.g., both parameter name and value encoded), try to extract it
  if (url && url.includes('glbUrl=')) {
    url = url.split('glbUrl=')[1] || url;
  }
  
  if (url) {
    console.log(`🔍 Custom GLB URL from params:`, url);
  }
  
  return url;
}

function createConfigFromGlbUrl(glbUrl: string): ModelConfig {
  return {
    name: 'Custom Model',
    modelPath: glbUrl,
    background: new URLSearchParams(window.location.search).get('background') || '#fafafb',
    defaultAnimation: 'auto',
    animations: {
      auto: {
        camera: {
          position: [0, 1.5, 3.5],
          target: [0, 0.5, 0]
        }
      },
      step_by_step: {
        camera: {
          position: [0, 0.8, 2.2],
          target: [0, 0.6, 0]
        }
      },
      exploded_view: {
        camera: {
          position: [0, 1.8, 4.0],
          target: [0, 0, 0]
        }
      }
    },
    lighting: {
      ambient: 2,
      directional: [
        { position: [5, 5, 5], intensity: 3, castShadow: true },
        { position: [-3, 2, -2], intensity: 2 },
        { position: [0, 5, 0], intensity: 1.5 }
      ]
    },
    camera: {
      fov: 50,
      near: 0.1,
      far: 1000
    }
  };
}

function getAnimationModeFromQuery(): AnimationMode {
  if (typeof window === 'undefined') return 'step_by_step';

  const value = new URLSearchParams(window.location.search).get('state');
  const normalized = (value ?? '').trim().toLowerCase().replace(/[-\s]+/g, '_');

  if (normalized === 'exploded_view' || normalized === 'exploded') return 'exploded_view';
  if (normalized === 'auto' || normalized === 'default') return 'auto';
  return 'step_by_step';
}

function shouldUseSceneCameraFromQuery(): boolean {
  if (typeof window === 'undefined') return false;
  const value = new URLSearchParams(window.location.search).get('useSceneCamera') ??
    new URLSearchParams(window.location.search).get('sceneCamera') ??
    '';
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function findAnimationName(names: string[], candidates: string[], requiredKeywords?: string[]) {
  const lower = (text: string) => text.toLowerCase();

  const exact = names.find((name) => candidates.includes(name));
  if (exact) return exact;

  const normalizedExact = names.find((name) => candidates.includes(lower(name)));
  if (normalizedExact) return normalizedExact;

  if (!requiredKeywords || requiredKeywords.length === 0) return null;

  return (
    names.find((name) => requiredKeywords.every((keyword) => lower(name).includes(keyword))) ?? null
  );
}

function choosePreferredAnimatedCamera(cameras: THREE.Camera[], animations: THREE.AnimationClip[]): THREE.Camera | null {
  if (!cameras || cameras.length === 0) return null;

  const cameraTrackCounts = new Map<string, number>();

  for (const clip of animations ?? []) {
    for (const track of clip.tracks ?? []) {
      const trackName = track.name ?? '';
      const dotIndex = trackName.lastIndexOf('.');
      if (dotIndex <= 0) continue;
      const objectName = trackName.slice(0, dotIndex);
      const property = trackName.slice(dotIndex + 1);
      if (property === 'position' || property === 'quaternion' || property === 'rotation' || property === 'scale') {
        cameraTrackCounts.set(objectName, (cameraTrackCounts.get(objectName) ?? 0) + 1);
      }
    }
  }

  let bestCamera: THREE.Camera | null = null;
  let bestScore = -1;

  for (const camera of cameras) {
    const score = cameraTrackCounts.get(camera.name) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestCamera = camera;
    }
  }

  return bestCamera ?? cameras[0];
}

// Component that auto-adjusts camera to frame the model (runs once per model)
function CameraController({ bounds, isCustomModel }: { bounds: { box: THREE.Box3; center: THREE.Vector3 } | null; isCustomModel: boolean }) {
  const { camera } = useThree();
  const hasFramedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!bounds || !camera || !isCustomModel) return;
    
    // Use bounds center as unique identifier - only frame once per unique model
    const boundsId = `${bounds.center.x},${bounds.center.y},${bounds.center.z}`;
    if (hasFramedRef.current === boundsId) {
      return; // Already framed this model
    }
    
    hasFramedRef.current = boundsId;
    
    const box = bounds.box;
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera as THREE.PerspectiveCamera).fov || 50;
    
    // Calculate distance needed to frame the entire model
    const vFOV = THREE.MathUtils.degToRad(fov);
    const distance = (maxDim / 2) / Math.tan(vFOV / 2);
    
    // Position camera away from center at an angle
    const angle = Math.PI / 4; // 45 degrees
    const newPos = new THREE.Vector3(
      Math.sin(angle) * distance * 0.8,
      maxDim * 0.4,
      Math.cos(angle) * distance * 0.8
    );
    newPos.add(bounds.center);
    
    camera.position.copy(newPos);
    camera.updateProjectionMatrix();
    
    console.log(`📷 Auto-framed camera for model`);
  }, [bounds, isCustomModel, camera]);
  
  return null;
}

function Controls({ target, enabled }: { target: [number, number, number]; enabled: boolean }) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!controlsRef.current) return;
    controlsRef.current.target.set(target[0], target[1], target[2]);
    controlsRef.current.update();
  }, [target, enabled]);

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={enabled}
      enableZoom
      enablePan
      enableRotate
      minDistance={0.1}
      maxDistance={1000}
      autoRotate={false}
    />
  );
}

function SceneCameraHandoffListener({ enabled, onHandoff }: { enabled: boolean; onHandoff: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = () => onHandoff();
    const handleWheel = () => onHandoff();

    gl.domElement.addEventListener('pointerdown', handlePointerDown, { passive: true });
    gl.domElement.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      gl.domElement.removeEventListener('pointerdown', handlePointerDown);
      gl.domElement.removeEventListener('wheel', handleWheel);
    };
  }, [enabled, gl, onHandoff]);

  return null;
}

function SceneCameraBinder({ cameraObject, enabled }: { cameraObject: THREE.Camera | null; enabled: boolean }) {
  const { camera, set, size } = useThree();
  const previousCameraRef = useRef<THREE.Camera | null>(null);

  useEffect(() => {
    if (!enabled || !cameraObject) return;

    previousCameraRef.current = camera;
    set({ camera: cameraObject as any });

    return () => {
      if (previousCameraRef.current) {
        set({ camera: previousCameraRef.current as any });
      }
    };
  }, [enabled, cameraObject, camera, set]);

  useEffect(() => {
    if (!enabled || !cameraObject) return;
    const perspective = cameraObject as THREE.PerspectiveCamera;
    if (perspective.isPerspectiveCamera) {
      perspective.aspect = size.width / size.height;
      perspective.updateProjectionMatrix();
    }
  }, [enabled, cameraObject, size.width, size.height]);

  return null;
}

function DroneModel({ animationMode, config, onBoundsComputed, onModelReady, onSceneCameraDetected }: { animationMode: AnimationMode; config: ModelConfig; onBoundsComputed?: (bounds: THREE.Box3, center: THREE.Vector3) => void; onModelReady?: () => void; onSceneCameraDetected?: (camera: THREE.Camera | null) => void }) {
  const group = useRef<any>(null);
  
  const gltf = useGLTF(config.modelPath);
  const { actions, names } = useAnimations(gltf.animations, group);

  useEffect(() => {
    if (!gltf.scene) return;
    onModelReady?.();
  }, [gltf.scene, onModelReady]);

  useEffect(() => {
    if (!gltf.scene) return;
    const sceneCamera = choosePreferredAnimatedCamera(gltf.cameras ?? [], gltf.animations ?? []);
    onSceneCameraDetected?.(sceneCamera);
    if (sceneCamera) {
      console.log('🎥 Embedded camera selected for playback:', sceneCamera.name || '(unnamed camera)');
    }
  }, [gltf.scene, gltf.cameras, gltf.animations, onSceneCameraDetected]);

  // Log model diagnostics and compute bounds
  useEffect(() => {
    if (!gltf.scene) return;
    
    let meshCount = 0;
    const box = new THREE.Box3();
    
    gltf.scene.traverse((child: any) => {
      if (child.isMesh) {
        meshCount++;
        if (child.geometry) {
          child.geometry.computeBoundingBox?.();
          if (child.geometry.boundingBox) {
            box.expandByObject(child);
          }
        }
      }
    });
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    console.log(`📦 Model loaded: ${meshCount} meshes`);
    console.log(`📏 Bounds:`, { min: box.min, max: box.max, center, size: { x: size.x, y: size.y, z: size.z } });
    console.log(`🎬 Animations available:`, names);
    
    if (onBoundsComputed) {
      onBoundsComputed(box, center);
    }
  }, [gltf.scene, names, onBoundsComputed]);

  // Enable shadows on all meshes
  useEffect(() => {
    if (gltf.scene) {
      gltf.scene.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [gltf.scene]);

  // Temporary diagnostics: backface and frustum-culling checks
  useEffect(() => {
    if (!gltf.scene) return;

    const applyToMaterial = (material: THREE.Material) => {
      const meshMaterial = material as THREE.MeshStandardMaterial;
      meshMaterial.side = THREE.DoubleSide;
      meshMaterial.needsUpdate = true;
    };

    gltf.scene.traverse((child: any) => {
      if (!child.isMesh) return;

      child.frustumCulled = false;

      if (Array.isArray(child.material)) {
        child.material.forEach((material: THREE.Material) => applyToMaterial(material));
      } else if (child.material) {
        applyToMaterial(child.material as THREE.Material);
      }
    });
  }, [gltf.scene]);

  const stepByStepName = useMemo(
    () =>
      findAnimationName(
        names,
        ['step_by_step', 'step-by-step', 'step by step', 'Step_by_step', 'Step_By_Step', 'StepByStep'],
        ['step', 'by', 'step']
      ),
    [names]
  );

  const explodedViewName = useMemo(
    () =>
      findAnimationName(
        names,
        ['exploded_view', 'exploded-view', 'exploded view', 'Exploded_View', 'ExplodedView'],
        ['exploded', 'view']
      ),
    [names]
  );

  useEffect(() => {
    if (!actions) return;

    // Stop all animations first
    Object.values(actions).forEach((a) => a?.stop());

    const selectedAnimationName =
      animationMode === 'exploded_view'
        ? explodedViewName ?? stepByStepName
        : animationMode === 'step_by_step'
          ? stepByStepName ?? explodedViewName
          : stepByStepName ?? explodedViewName;

    if (selectedAnimationName && actions[selectedAnimationName]) {
      actions[selectedAnimationName].reset().play();
      return;
    }

    const first = names?.[0];
    if (first && actions[first]) {
      actions[first].reset().play();
    }
  }, [actions, animationMode, explodedViewName, names, stepByStepName]);

  return (
    <>
      {gltf.scene && <primitive ref={group} object={gltf.scene} />}
    </>
  );
}

export default function DroneViewer() {
  const [animationMode, setAnimationMode] = useState<AnimationMode | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelBounds, setModelBounds] = useState<{ box: THREE.Box3; center: THREE.Vector3 } | null>(null);
  const [controlsTarget, setControlsTarget] = useState<[number, number, number]>([0, 0, 0]);
  const [modelReady, setModelReady] = useState(false);
  const [sceneCamera, setSceneCamera] = useState<THREE.Camera | null>(null);
  const [sceneCameraReleasedToControls, setSceneCameraReleasedToControls] = useState(false);

  const modelKey = getModelFromQuery();
  const customGlbUrl = getCustomGlbUrl();
  const useSceneCamera = shouldUseSceneCameraFromQuery();
  const sceneCameraActive = useSceneCamera && !!sceneCamera && !sceneCameraReleasedToControls;

  // Load model config on mount and when model changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setModelBounds(null); // Reset bounds for new model
    setModelReady(false);
    setSceneCamera(null);
    setSceneCameraReleasedToControls(false);
    // This will cause CameraController to reframe when new bounds are computed
    const loadConfig = async () => {
      let config: ModelConfig | null = null;

      // Priority 1: Custom GLB URL from query parameter
      if (customGlbUrl) {
        try {
          // Validate URL is accessible before creating config
          const headResponse = await fetch(customGlbUrl, { method: 'HEAD' });
          if (!headResponse.ok) {
            throw new Error(`HTTP ${headResponse.status}: ${headResponse.statusText}`);
          }
          config = createConfigFromGlbUrl(customGlbUrl);
          console.log(`✓ Custom GLB URL loaded: ${customGlbUrl}`);
        } catch (error) {
          const errorMsg = `Failed to load GLB from URL: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`✗ ${errorMsg}`);
          setError(errorMsg);
          setLoading(false);
          return;
        }
      } else {
        // Priority 2: Named model from models.json
        config = await loadModelConfig(modelKey);
      }

      if (config) {
        setModelConfig(config);
        // Only preload if it's a local path
        if (config.modelPath.startsWith('/')) {
          useGLTF.preload(config.modelPath);
        }
      } else {
        const errorMsg = `Model config not found for "${modelKey}"`;
        console.error(`✗ ${errorMsg}`);
        setError(errorMsg);
      }
      setLoading(false);
    };
    loadConfig();
  }, [modelKey, customGlbUrl]);

  // Sync animation mode from query parameters
  useEffect(() => {
    const syncModeFromQuery = () => setAnimationMode(getAnimationModeFromQuery());
    syncModeFromQuery();

    const handlePopState = () => syncModeFromQuery();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleBoundsComputed = useCallback((box: THREE.Box3, center: THREE.Vector3) => {
    setModelBounds((prev) => {
      if (
        prev &&
        prev.center.distanceToSquared(center) < 0.000001 &&
        prev.box.min.equals(box.min) &&
        prev.box.max.equals(box.max)
      ) {
        return prev;
      }
      return { box: box.clone(), center: center.clone() };
    });
  }, []);

  const handleSceneCameraDetected = useCallback((camera: THREE.Camera | null) => {
    setSceneCamera((prev) => {
      if (prev === camera) return prev;
      return camera;
    });
  }, []);

  const handleSceneCameraHandoff = useCallback(() => {
    if (sceneCameraActive) {
      setSceneCameraReleasedToControls(true);
    }
  }, [sceneCameraActive]);

  const resolvedMode: AnimationMode = animationMode ?? 'step_by_step';

  const animationConfig = modelConfig?.animations[resolvedMode] || (modelConfig ? modelConfig.animations[modelConfig.defaultAnimation] : undefined);
  const cameraConfig = animationConfig?.camera || {
    position: [0, 0.8, 2.2] as [number, number, number],
    target: [0, 0.6, 0] as [number, number, number]
  };

  const bgColor = new URLSearchParams(window.location.search).get('background') || modelConfig?.background || '#fafafb';
  const autoFocus = customGlbUrl ? true : new URLSearchParams(window.location.search).get('autoFocus') === 'true';

  useEffect(() => {
    if (!modelConfig) return;
    setControlsTarget(cameraConfig.target);
  }, [modelConfig?.modelPath]);

  useEffect(() => {
    if (!autoFocus || !modelBounds) return;
    setControlsTarget([modelBounds.center.x, modelBounds.center.y, modelBounds.center.z]);
  }, [autoFocus, modelBounds]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafb' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading 3D model...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafb', flexDirection: 'column' }}>
        <div style={{ fontSize: '20px', color: '#d32f2f', fontWeight: 'bold', marginBottom: '10px' }}>Error Loading Model</div>
        <div style={{ fontSize: '14px', color: '#666', maxWidth: '500px', textAlign: 'center', whiteSpace: 'pre-wrap' }}>{error}</div>
      </div>
    );
  }

  if (!modelConfig) {
    return (
      <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafb' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>No model configuration found</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }} data-name="Model Viewer">
      <Canvas
        camera={{
          position: cameraConfig.position,
          fov: modelConfig.camera.fov,
          near: modelConfig.camera.near,
          far: modelConfig.camera.far,
        }}
        style={{ width: '100%', height: '100%' }}
        shadows
      >
        <color attach="background" args={[bgColor]} />
        
        <DroneModel 
          animationMode={resolvedMode} 
          config={modelConfig} 
          onBoundsComputed={handleBoundsComputed}
          onModelReady={() => setModelReady(true)}
          onSceneCameraDetected={handleSceneCameraDetected}
        />

        <SceneCameraBinder cameraObject={sceneCamera} enabled={sceneCameraActive} />
        <SceneCameraHandoffListener enabled={sceneCameraActive} onHandoff={handleSceneCameraHandoff} />
        
        <CameraController bounds={modelBounds} isCustomModel={autoFocus && !sceneCameraActive} />
        <Controls target={controlsTarget} enabled={!sceneCameraActive} />
        
        {/* Dynamic lighting from config */}
        <ambientLight intensity={modelConfig.lighting.ambient} />
        {modelConfig.lighting.directional.map((light, idx) => (
          <directionalLight
            key={idx}
            position={light.position}
            intensity={light.intensity}
            castShadow={light.castShadow}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
        ))}
      </Canvas>

      {!modelReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#fafafb',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '3px solid #d8d8dc',
              borderTop: '3px solid #666',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          <div style={{ fontSize: '15px', color: '#666' }}>Loading 3D model...</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
