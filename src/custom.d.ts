// For modules without type definitions
declare module '@react-three/fiber' {
  import { ReactThreeFiber } from '@react-three/fiber'
  export const Canvas: React.FC<any>;
  export default ReactThreeFiber;
}

declare module '@react-three/rapier' {
  export const Physics: React.FC<any>;
}

declare module '@react-three/drei' {
  export const OrbitControls: React.FC<any>;
} 