import { Canvas } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
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

function getAnimationModeFromQuery(): AnimationMode {
  if (typeof window === 'undefined') return 'step_by_step';

  const value = new URLSearchParams(window.location.search).get('state');
  const normalized = (value ?? '').trim().toLowerCase().replace(/[-\s]+/g, '_');

  if (normalized === 'exploded_view' || normalized === 'exploded') return 'exploded_view';
  if (normalized === 'auto' || normalized === 'default') return 'auto';
  return 'step_by_step';
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

function DroneModel({ animationMode, config }: { animationMode: AnimationMode; config: ModelConfig }) {
  const group = useRef<any>(null);
  
  const gltf = useGLTF(config.modelPath);
  const { actions, names } = useAnimations(gltf.animations, group);

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

  const modelKey = getModelFromQuery();

  // Load model config on mount and when model changes
  useEffect(() => {
    setLoading(true);
    const loadConfig = async () => {
      const config = await loadModelConfig(modelKey);
      if (config) {
        setModelConfig(config);
        useGLTF.preload(config.modelPath);
      } else {
        console.error(`Model config not found for "${modelKey}"`);
      }
      setLoading(false);
    };
    loadConfig();
  }, [modelKey]);

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

  if (loading || !modelConfig) {
    return (
      <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafb' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading 3D model...</div>
      </div>
    );
  }

  const resolvedMode: AnimationMode = animationMode ?? 'step_by_step';
  
  // Get camera preset from config, with fallback defaults
  const animationConfig = modelConfig.animations[resolvedMode] || modelConfig.animations[modelConfig.defaultAnimation];
  const cameraConfig = animationConfig?.camera || {
    position: [0, 0.8, 2.2] as [number, number, number],
    target: [0, 0.6, 0] as [number, number, number]
  };

  // Allow background override via query parameter
  const bgColor = new URLSearchParams(window.location.search).get('background') || modelConfig.background;

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }} data-name="Model Viewer">
      <Canvas
        key={resolvedMode}
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
        
        <DroneModel animationMode={resolvedMode} config={modelConfig} />
        <OrbitControls 
          enableZoom 
          enablePan 
          enableRotate 
          target={cameraConfig.target}
          minDistance={0.1}
          maxDistance={1000}
        />
        
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
    </div>
  );
}
