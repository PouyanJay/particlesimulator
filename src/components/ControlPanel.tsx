import React, { useState } from 'react'
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
  collisionFadeDuration: number
  setCollisionFadeDuration: (value: number) => void
  dynamicContainerSize: boolean
  setDynamicContainerSize: (value: boolean) => void
  maxParticleCount?: number
  isCompactMode: boolean
  setIsCompactMode: (value: boolean) => void
}

const CustomSlider = ({ 
  value, 
  onChange, 
  label, 
  min, 
  max, 
  step = 0.01, 
  disabled = false,
  formatValue = (v: number) => v.toFixed(2),
  tooltipText
}: { 
  value: number
  onChange: (value: number) => void
  label: string
  min: number
  max: number
  step?: number
  disabled?: boolean
  formatValue?: (value: number) => string
  tooltipText?: string
}) => {
  const combinedTooltip = disabled && label === "Restitution" ? "Controls bounciness. Requires friction to be enabled." 
                        : disabled && label === "Friction Coefficient" ? "Controls friction amount. Requires friction to be enabled." 
                        : tooltipText;
  return (
    <div className={`slider-container ${disabled ? 'slider-disabled' : ''}`} title={combinedTooltip}>
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

const GradientChevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`chevron-svg${expanded ? ' expanded' : ''}`}
    width="22" height="22" viewBox="0 0 22 22" fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ display: 'inline', verticalAlign: 'middle', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}
  >
    <defs>
      <linearGradient id="chevron-gradient" x1="0" y1="0" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38bdf8" />
        <stop offset="1" stopColor="#818cf8" />
      </linearGradient>
    </defs>
    <polyline
      points="7 10 11 14 15 10"
      stroke="url(#chevron-gradient)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      filter="drop-shadow(0 1px 2px rgba(56,189,248,0.15))"
    />
  </svg>
);

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
  collisionFadeDuration,
  setCollisionFadeDuration,
  dynamicContainerSize,
  setDynamicContainerSize,
  maxParticleCount = 1000,
  isCompactMode,
  setIsCompactMode,
}) => {
  // Check if any friction is enabled
  const isFrictionEnabled = particleParticleFriction || particleWallFriction;
  
  // State for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    physics: false,
    particles: false,
    simulation: false
  });
  
  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => {
      const updated = { ...prev, [section]: !prev[section] };
      console.log('Toggling section:', section, 'New state:', updated);
      return updated;
    });
  };

  // Keyboard accessibility for toggles
  const handleToggleKey = (e: React.KeyboardEvent, section: keyof typeof expandedSections) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSection(section);
    }
  };
  
  // Helper for glassy header
  const SectionHeader = ({
    title,
    expanded,
    onToggle,
    ariaControls,
    onKeyDown
  }: {
    title: string,
    expanded: boolean,
    onToggle: () => void,
    ariaControls: string,
    onKeyDown: (e: React.KeyboardEvent) => void
  }) => (
    <div className="section-header-glass">
      <div className="accent-bar" />
      <h3 className="section-title-glass">{title}</h3>
      <button
        className="section-toggle-btn-glass"
        aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        aria-expanded={expanded}
        aria-controls={ariaControls}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={onKeyDown}
      >
        <GradientChevron expanded={expanded} />
      </button>
    </div>
  );

  // Debug log
  console.log('expandedSections:', expandedSections);

  return (
    <>
      {/* PHYSICS CONTROLS */}
      <div className={`control-section-glass ${isCompactMode ? 'compact' : ''}`}>  
        <div className={`section-header-glass${!expandedSections.physics ? ' collapsed' : ''}`}>
          <div className="accent-bar" />
          <h3 className="section-title-glass">Physics Controls</h3>
          <button
            className="section-toggle-btn-glass"
            aria-label={expandedSections.physics ? 'Collapse Physics Controls' : 'Expand Physics Controls'}
            aria-expanded={expandedSections.physics}
            aria-controls="physics-controls"
            tabIndex={0}
            onClick={() => toggleSection('physics')}
            onKeyDown={e => handleToggleKey(e, 'physics')}
          >
            <GradientChevron expanded={expandedSections.physics} />
          </button>
        </div>
        {expandedSections.physics && (
          <div
            id="physics-controls"
            className="collapsible-content-glass expanded"
          >
            <div className="control-group">
              <ToggleSwitch
                isActive={particleParticleFriction}
                onChange={() => setParticleParticleFriction(!particleParticleFriction)}
                label="Particle-Particle Friction"
                tooltipText="Enable/disable friction between particles."
              />
              <ToggleSwitch
                isActive={particleWallFriction}
                onChange={() => setParticleWallFriction(!particleWallFriction)}
                label="Particle-Wall Friction"
                tooltipText="Enable/disable friction between particles and container walls."
              />
              <div className={`control-subgroup ${isFrictionEnabled ? '' : 'control-subgroup-disabled'}`}> 
                <CustomSlider
                  label="Restitution"
                  value={restitution}
                  onChange={setRestitution}
                  min={0.1}
                  max={1.0}
                  disabled={!isFrictionEnabled}
                  tooltipText="Controls bounciness of particles. Higher values = more bouncy."
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
                  tooltipText="Controls the amount of friction. Higher values = more friction."
                />
              </div>
              <ToggleSwitch
                isActive={gravity}
                onChange={() => setGravity(!gravity)}
                label="Gravity"
                tooltipText="Enable/disable gravitational force pulling particles down."
              />
            </div>
          </div>
        )}
      </div>

      {/* PARTICLE PARAMETERS */}
      <div className={`control-section-glass ${isCompactMode ? 'compact' : ''}`}>  
        <div className={`section-header-glass${!expandedSections.particles ? ' collapsed' : ''}`}>
          <div className="accent-bar" />
          <h3 className="section-title-glass">Particle Parameters</h3>
          <button
            className="section-toggle-btn-glass"
            aria-label={expandedSections.particles ? 'Collapse Particle Parameters' : 'Expand Particle Parameters'}
            aria-expanded={expandedSections.particles}
            aria-controls="particle-controls"
            tabIndex={0}
            onClick={() => toggleSection('particles')}
            onKeyDown={e => handleToggleKey(e, 'particles')}
          >
            <GradientChevron expanded={expandedSections.particles} />
          </button>
        </div>
        {expandedSections.particles && (
          <div
            id="particle-controls"
            className="collapsible-content-glass expanded"
          >
            <div className="control-group">
              <CustomSlider
                label={`Particle Count (Max: ${maxParticleCount})`}
                value={particleCount}
                onChange={(value) => setParticleCount(Math.min(value, maxParticleCount))}
                min={10}
                max={500}
                step={10}
                formatValue={(v) => Math.round(v).toString()}
                tooltipText="Set the total number of particles in the simulation."
              />
              <ToggleSwitch
                isActive={dynamicContainerSize}
                onChange={() => setDynamicContainerSize(!dynamicContainerSize)}
                label="Scale Container with Particle Count"
                tooltipText="Automatically adjust container size based on particle count."
              />
              <CustomSlider
                label="Particle Size"
                value={particleSize}
                onChange={setParticleSize}
                min={0.02}
                max={0.2}
                tooltipText="Set the radius of each particle."
              />
              <CustomSlider
                label="Initial Velocity"
                value={initialVelocity}
                onChange={setInitialVelocity}
                min={0.1}
                max={5.0}
                tooltipText="Set the starting speed of particles."
              />
            </div>
          </div>
        )}
      </div>

      {/* SIMULATION CONTROLS */}
      <div className={`control-section-glass ${isCompactMode ? 'compact' : ''}`}>  
        <div className={`section-header-glass${!expandedSections.simulation ? ' collapsed' : ''}`}>
          <div className="accent-bar" />
          <h3 className="section-title-glass">Simulation Controls</h3>
          <button
            className="section-toggle-btn-glass"
            aria-label={expandedSections.simulation ? 'Collapse Simulation Controls' : 'Expand Simulation Controls'}
            aria-expanded={expandedSections.simulation}
            aria-controls="simulation-controls"
            tabIndex={0}
            onClick={() => toggleSection('simulation')}
            onKeyDown={e => handleToggleKey(e, 'simulation')}
          >
            <GradientChevron expanded={expandedSections.simulation} />
          </button>
        </div>
        {expandedSections.simulation && (
          <div
            id="simulation-controls"
            className="collapsible-content-glass expanded"
          >
            <div className="control-group">
              <CustomSlider
                label="δt (Simulation Speed)"
                value={deltaTime}
                onChange={setDeltaTime}
                min={0.01}
                max={5.0}
                step={0.01}
                formatValue={(v) => v.toFixed(2)}
                tooltipText="Control the speed of the simulation. Higher values are faster."
              />
              <CustomSlider
                label="Collision Color Fade Duration"
                value={collisionFadeDuration}
                onChange={setCollisionFadeDuration}
                min={0.1}
                max={2.0}
                step={0.1}
                formatValue={(v) => v.toFixed(1) + 's'}
                tooltipText="How long particle color changes after a collision (in seconds)."
              />
              <div className="button-group">
                <button className="button" onClick={onReset} title="Reset simulation to initial parameters (R)">
                  Reset
                </button>
                <button className="button" onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? "Pause the simulation (Space)" : "Resume the simulation (Space)"}>
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default ControlPanel 