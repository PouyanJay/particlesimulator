/// <reference types="vite/client" />

// Side-effect CSS imports (`import './x.css'`). React Three Fiber augments the global
// JSX namespace with three.js element types, so no manual JSX declaration is needed.
declare module '*.css'
