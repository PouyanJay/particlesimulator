/// <reference types="vite/client" />

// Declare modules for CSS imports
declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Make sure TypeScript knows about JSX
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
