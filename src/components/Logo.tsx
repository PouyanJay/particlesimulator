import React from 'react';
import '../styles/Logo.css';

const Logo: React.FC = () => {
  return (
    <div className="app-logo">
      <h1 className="app-title">Particle Simulator</h1>
      <p className="app-subtitle">3D Physics Engine</p>
      <div className="logo-underline"></div>
      <div className="particle-decoration">
        <div className="particle-dot"></div>
        <div className="particle-dot"></div>
        <div className="particle-dot"></div>
        <div className="particle-dot"></div>
        <div className="particle-dot"></div>
        <div className="particle-dot"></div>
      </div>
    </div>
  );
};

export default Logo; 