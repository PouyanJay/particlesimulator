import React from 'react'
import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'
import '../styles/Slider.css'
import ToggleSwitch from './ToggleSwitch'

interface ControlPanelProps {
  particleParticleFriction: boolean
  setParticleParticleFriction: (value: boolean) => void
  particleWallFriction: boolean
  setParticleWallFriction: (value: boolean) => void
  gravity: boolean
  setGravity: (value: boolean) => void
  deltaTime: number
  setDeltaTime: (value: number) => void
  isPlaying: boolean
  setIsPlaying: (value: boolean) => void
  onReset: () => void
  restitution: number
  setRestitution: (value: number) => void
  particleCount: number
  setParticleCount: (value: number) => void
  particleSize: number
  setParticleSize: (value: number) => void
  initialVelocity: number
  setInitialVelocity: (value: number) => void
}

const CustomSlider = ({ 
  value, 
  onChange, 
  label, 
  min, 
  max, 
  step = 0.01, 
  formatValue = (v: number) => v.toFixed(2) 
}: { 
  value: number
  onChange: (value: number) => void
  label: string
  min: number
  max: number
  step?: number
  formatValue?: (value: number) => string
}) => {
  return (
    <div className="slider-container">
      <div className="slider-header">
        <span>{label}</span>
        <span className="slider-value">{formatValue(value)}</span>
      </div>
      <Slider 
        className="rc-slider"
        value={value}
        onChange={onChange as (value: number | number[]) => void}
        min={min}
        max={max}
        step={step}
        railStyle={{ backgroundColor: 'var(--slider-track)' }}
        trackStyle={{ background: 'var(--accent-gradient)' }}
        handleStyle={{
          borderColor: 'var(--accent-primary)',
          backgroundColor: 'var(--accent-primary)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          opacity: 1
        }}
      />
    </div>
  );
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  particleParticleFriction,
  setParticleParticleFriction,
  particleWallFriction,
  setParticleWallFriction,
  gravity,
  setGravity,
  deltaTime,
  setDeltaTime,
  isPlaying,
  setIsPlaying,
  onReset,
  restitution,
  setRestitution,
  particleCount,
  setParticleCount,
  particleSize,
  setParticleSize,
  initialVelocity,
  setInitialVelocity,
}) => {
  return (
    <>
      <h2>Physics Controls</h2>
      
      <ToggleSwitch
        isActive={particleParticleFriction}
        onChange={() => setParticleParticleFriction(!particleParticleFriction)}
        label="Particle-Particle Friction"
      />
      <ToggleSwitch
        isActive={particleWallFriction}
        onChange={() => setParticleWallFriction(!particleWallFriction)}
        label="Particle-Wall Friction"
      />
      <ToggleSwitch
        isActive={gravity}
        onChange={() => setGravity(!gravity)}
        label="Gravity"
      />

      <h2>Simulation Parameters</h2>
      
      <CustomSlider
        label="Restitution"
        value={restitution}
        onChange={setRestitution}
        min={0.1}
        max={1.0}
      />
      
      <CustomSlider
        label="Particle Count"
        value={particleCount}
        onChange={setParticleCount}
        min={10}
        max={500}
        step={10}
        formatValue={(v) => Math.round(v).toString()}
      />
      
      <CustomSlider
        label="Particle Size"
        value={particleSize}
        onChange={setParticleSize}
        min={0.02}
        max={0.2}
      />
      
      <CustomSlider
        label="Initial Velocity"
        value={initialVelocity}
        onChange={setInitialVelocity}
        min={0.1}
        max={5.0}
      />
      
      <CustomSlider
        label="δt (Simulation Speed)"
        value={deltaTime}
        onChange={setDeltaTime}
        min={0.01}
        max={1.0}
      />

      <h2>Simulation Controls</h2>
      
      <div className="button-group">
        <button className="button" onClick={onReset}>
          Reset
        </button>

        <button className="button" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
    </>
  )
}

export default ControlPanel 