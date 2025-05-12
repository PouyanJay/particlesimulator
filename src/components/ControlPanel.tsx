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
  frictionCoefficient: number
  setFrictionCoefficient: (value: number) => void
}

const CustomSlider = ({ 
  value, 
  onChange, 
  label, 
  min, 
  max, 
  step = 0.01,
  disabled = false,
  formatValue = (v: number) => v.toFixed(2)
}: { 
  value: number
  onChange: (value: number) => void
  label: string
  min: number
  max: number
  step?: number
  disabled?: boolean
  formatValue?: (value: number) => string
}) => {
  return (
    <div className={`slider-container ${disabled ? 'slider-disabled' : ''}`} title={disabled ? 'Requires friction to be enabled' : ''}>
      <div className="slider-header">
        <span>{label}</span>
        <span className="slider-value">{formatValue(value)}</span>
      </div>
      <Slider 
        className="rc-slider"
        value={value}
        onChange={disabled ? undefined : (onChange as (value: number | number[]) => void)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        railStyle={{ backgroundColor: 'var(--slider-track)' }}
        trackStyle={{ background: disabled ? 'var(--text-secondary)' : 'var(--accent-gradient)' }}
        handleStyle={{
          borderColor: disabled ? 'var(--text-secondary)' : 'var(--accent-primary)',
          backgroundColor: disabled ? 'var(--text-secondary)' : 'var(--accent-primary)',
          boxShadow: disabled ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.3)',
          opacity: disabled ? 0.6 : 1,
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
  frictionCoefficient,
  setFrictionCoefficient,
}) => {
  // Check if any friction is enabled
  const isFrictionEnabled = particleParticleFriction || particleWallFriction;
  
  return (
    <>
      <h2>Physics Controls</h2>
      
      <div className="control-group">
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

        <div className={`control-subgroup ${isFrictionEnabled ? "" : "control-subgroup-disabled"}`}>
          <CustomSlider
            label="Restitution"
            value={restitution}
            onChange={setRestitution}
            min={0.1}
            max={1.0}
            disabled={!isFrictionEnabled}
          />
          
          <CustomSlider
            label="Friction Coefficient"
            value={frictionCoefficient}
            onChange={setFrictionCoefficient}
            min={0.001}
            max={1.0}
            step={0.001}
            formatValue={(v) => v.toFixed(3)}
            disabled={!isFrictionEnabled}
          />
        </div>
      </div>

      <div className="control-group">
        <ToggleSwitch
          isActive={gravity}
          onChange={() => setGravity(!gravity)}
          label="Gravity"
        />
      </div>

      <h2>Particle Parameters</h2>
      
      <div className="control-group">
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
      </div>
        
      <h2>Simulation Controls</h2>
      
      <div className="control-group">
        <CustomSlider
          label="δt (Simulation Speed)"
          value={deltaTime}
          onChange={setDeltaTime}
          min={0.01}
          max={5.0}
          step={0.01}
          formatValue={(v) => v.toFixed(2)}
        />
      
        <div className="button-group">
          <button className="button" onClick={onReset}>
            Reset
          </button>

          <button className="button" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    </>
  )
}

export default ControlPanel 