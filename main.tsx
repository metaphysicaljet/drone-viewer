import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useGLTF } from '@react-three/drei';
import DroneViewer from './Drone Viewer';

// Preload the model as soon as main.tsx loads
useGLTF.preload('/drone.glb');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DroneViewer />
  </StrictMode>
);
