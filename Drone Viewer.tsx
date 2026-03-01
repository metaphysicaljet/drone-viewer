import { Canvas } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import '@react-three/fiber';
/** @jsxImportSource react */

function DroneModel() {
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

  // Find and play the step_by_step animation
  const stepByStepName = useMemo(() => {
    const candidates = ['step_by_step', 'step-by-step', 'step by step', 'Step_by_step', 'Step_By_Step', 'StepByStep'];
    const lower = (s: string) => s.toLowerCase();

    const found =
      names.find((n) => candidates.includes(n)) ??
      names.find((n) => candidates.includes(lower(n))) ??
      names.find((n) => lower(n).includes('step') && lower(n).includes('by') && lower(n).includes('step'));

    return found ?? null;
  }, [names]);

  useEffect(() => {
    if (!actions) return;

    // Stop all animations first
    Object.values(actions).forEach((a) => a?.stop());

    // Play step_by_step animation if found
    if (stepByStepName && actions[stepByStepName]) {
      actions[stepByStepName].reset().play();
    } else {
      // Fallback: play first available animation
      const first = names?.[0];
      if (first && actions[first]) {
        actions[first].reset().play();
      }
    }
  }, [actions, names, stepByStepName]);

  return (
    <>
      {!gltf.scene && (
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      )}
      {gltf.scene && <primitive ref={group} object={gltf.scene} />}
    </>
  );
}

function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#cccccc" />
    </mesh>
  );
}

export default function DroneViewer() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }} data-name="Drone Viewer">
      <Canvas
        camera={{
          position: [0, 2, 5],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        style={{ width: '100%', height: '100%' }}
        shadows
      >
        <color attach="background" args={['#e9eef2']} />
        
        <Suspense fallback={<Loader />}>
          <DroneModel />
          <OrbitControls 
            enableZoom 
            enablePan 
            enableRotate 
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
        </Suspense>
      </Canvas>
    </div>
  );
}