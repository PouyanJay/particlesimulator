import React from 'react';

interface ToggleSwitchProps {
  isActive: boolean;
  onChange: () => void;
  label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isActive, onChange, label }) => {
  return (
    <div className="control-group">
      <label>{label}</label>
      <div
        className={`toggle-switch ${isActive ? 'active' : ''}`}
        onClick={onChange}
      >
        <span className="toggle-icon toggle-on">⦿</span>
        <span className="toggle-icon toggle-off">○</span>
      </div>
    </div>
  );
};

export default ToggleSwitch; 