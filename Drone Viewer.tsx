import { Canvas } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import '@react-three/fiber';
/** @jsxImportSource react */

// Preload GLB file for performance
useGLTF.preload('/drone.glb');

type AnimationMode = 'step_by_step' | 'exploded_view' | 'auto';

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

function DroneModel({ animationMode }: { animationMode: AnimationMode }) {
  const modelUrl = '/drone.glb';
  const group = useRef<any>(null);
  
  const gltf = useGLTF(modelUrl);
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

  useEffect(() => {
    const syncModeFromQuery = () => setAnimationMode(getAnimationModeFromQuery());
    syncModeFromQuery();

    const handlePopState = () => syncModeFromQuery();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const resolvedMode: AnimationMode = animationMode ?? 'step_by_step';
  const cameraConfig =
    resolvedMode === 'exploded_view'
      ? { position: [0, 1.8, 4.0] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
      : { position: [0, 0.8, 2.2] as [number, number, number], target: [0, 0.6, 0] as [number, number, number] };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }} data-name="Drone Viewer">
      <Canvas
        key={resolvedMode}
        camera={{
          position: cameraConfig.position,
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        style={{ width: '100%', height: '100%' }}
        shadows
      >
        <color attach="background" args={['#fafafb']} />
        
        <DroneModel animationMode={resolvedMode} />
        <OrbitControls 
          enableZoom 
          enablePan 
          enableRotate 
          target={cameraConfig.target}
          minDistance={0.1}
          maxDistance={1000}
        />
        
        {/* Minimal lighting for instructional clarity */}
        <ambientLight intensity={2} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={3} 
          castShadow 
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-3, 2, -2]} intensity={2} />
        <directionalLight position={[0, 5, 0]} intensity={1.5} />
      </Canvas>
    </div>
  );
}