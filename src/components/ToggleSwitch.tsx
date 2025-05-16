import React from 'react';

interface ToggleSwitchProps {
  isActive: boolean;
  onChange: () => void;
  label: string;
  tooltipText?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isActive, onChange, label, tooltipText }) => {
  return (
    <div className="control-group" title={tooltipText}>
      <label>{label}</label>
      <div
        className={`toggle-switch ${isActive ? 'active' : ''}`}
        onClick={onChange}
        title={tooltipText}
      >
        <span className="toggle-icon toggle-on">⦿</span>
        <span className="toggle-icon toggle-off">○</span>
      </div>
    </div>
  );
};

export default ToggleSwitch; 