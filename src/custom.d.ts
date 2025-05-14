// For modules without type definitions
declare module '@react-three/fiber' {
  import { ReactThreeFiber } from '@react-three/fiber'
  export const Canvas: React.FC<any>;
  export const useFrame: (callback: (state: any, delta: number) => void) => void;
  export default ReactThreeFiber;
}

declare module '@react-three/rapier' {
  export const Physics: React.FC<any>;
  export const RigidBody: React.FC<any>;
  export const CuboidCollider: React.FC<any>;
  export const BallCollider: React.FC<any>;
}

declare module '@react-three/drei' {
  export const OrbitControls: React.FC<any>;
} 