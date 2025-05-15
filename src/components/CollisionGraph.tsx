import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import '../styles/CollisionGraph.css'

// Register the components needed for Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface CollisionGraphProps {
  data: number[] // Array of collision count values
  currentCollisionCount: number // Current number of collisions
  initialVelocity: number // Used to help scale the y-axis
  isVisible?: boolean // Whether the graph is currently visible
  onVisibilityChange?: (visible: boolean) => void // Callback when visibility changes
  speedGraphVisible?: boolean // Whether the speed graph is currently visible, for positioning
}

// Type for context with tick value
type ContextWithTickValue = {
  tick: {
    value: number;
  };
};

// Type for position style
type PositionStyle = {
  top: string;
};

const CollisionGraph: React.FC<CollisionGraphProps> = ({ 
  data,
  currentCollisionCount,
  initialVelocity,
  isVisible = true,
  onVisibilityChange,
  speedGraphVisible = true
}) => {
  const [localVisible, setLocalVisible] = useState<boolean>(isVisible);
  const chartRef = useRef<any>(null);
  
  // Keep local state in sync with prop
  useEffect(() => {
    setLocalVisible(isVisible);
  }, [isVisible]);
  
  // Add window resize listener
  useEffect(() => {
    const handleResize = () => {
      // Force resize of chart if visible
      if (localVisible && chartRef.current) {
        const chart = chartRef.current;
        try {
          // Updated access to chart instance - modern react-chartjs-2 API
          if (chart && chart.current) {
            chart.current.resize();
          }
        } catch (err) {
          console.error("Error resizing collision chart:", err);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [localVisible]);
  
  // Calculate y-axis limits based on initialVelocity and particle count
  // Scale expected collision count with the square of initialVelocity (collision probability increases with speed^2)
  const velocityFactor: number = Math.max(1, initialVelocity * initialVelocity);
  const baseMaxValue: number = Math.ceil(10 * velocityFactor);
  
  // Safe calculation for maxYValue that handles empty arrays
  const maxYValue: number = (() => {
    if (!data.length) return baseMaxValue;
    
    try {
      return Math.max(baseMaxValue, Math.ceil(Math.max(...data) * 1.2));
    } catch (err) {
      // Fallback if Math.max(...data) fails
      return baseMaxValue;
    }
  })();
  
  const midYValue: number = Math.floor(maxYValue / 2);
  
  // Format y-axis tick values as integers (collisions are whole numbers)
  const formatTickValue = (value: number): string => Math.round(value).toString();
  
  // Toggle graph visibility
  const toggleVisibility = (): void => {
    const newVisibility = !localVisible;
    setLocalVisible(newVisibility);
    // Notify parent component about the visibility change
    if (onVisibilityChange) {
      onVisibilityChange(newVisibility);
    }
  };

  // Calculate position based on speed graph visibility - shared between graph and toggle
  const getPositionStyle = (isSpeedVisible: boolean): PositionStyle => {
    return {
      top: isSpeedVisible ? '260px' : '70px', // Below speed graph or icon
    };
  };
  
  // Apply position style to main graph container
  const graphStyle = useMemo<PositionStyle>(() => {
    return getPositionStyle(speedGraphVisible);
  }, [speedGraphVisible]);

  // Apply position style to toggle button when minimized
  const toggleButtonStyle = useMemo<PositionStyle>(() => {
    return getPositionStyle(speedGraphVisible);
  }, [speedGraphVisible]);

  // If not visible, show the toggle button
  if (!localVisible) {
    return (
      <button 
        className="collision-graph-toggle-minimized"
        onClick={toggleVisibility}
        title="Show Collision Graph"
        style={toggleButtonStyle}
      >
        <div className="graph-toggle-content">
          <div className="graph-toggle-icon">
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Line chart icon with different color for collision graph */}
              <path 
                d="M3 16L7 12L11 14L21 4" 
                stroke="#f87171" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              {/* Bottom line */}
              <path 
                d="M3 20H21" 
                stroke="#f87171" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </svg>
          </div>
          <span className="toggle-label">COLL</span>
        </div>
      </button>
    );
  }

  // Process data with fixed limit of 100 points
  const processedData: number[] = (() => {
    if (!data || data.length <= 1) {
      return [0, 1, 2, 1, 0]; // Default data for empty input
    }
    
    if (data.length > 100) {
      return data.slice(-100); // Hard limit to 100 data points
    }
    
    return [...data];
  })();
  
  // Create labels (timestamps)
  const labels: string[] = Array.from(
    { length: processedData.length }, 
    (_, i) => `${(i*0.5).toFixed(1)}s`
  );

  // Configure chart data with big, visible elements
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Collisions',
        data: processedData,
        backgroundColor: 'rgba(248, 113, 113, 0.3)', // Red for collisions
        borderColor: '#f87171', // Red for collisions
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0, // No points/dots
        pointHoverRadius: 0, // No hover effect
        pointBorderWidth: 0,
        pointBackgroundColor: 'transparent',
        pointBorderColor: 'transparent',
      }
    ]
  };
  
  // Simple chart options focused on visibility
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    responsiveAnimationDuration: 0, // Disable animation on resize
    animation: {
      duration: 0 // Disable animation by setting duration to 0
    },
    resizeDelay: 0, // Don't delay resize operations
    devicePixelRatio: window.devicePixelRatio || 1, // Use proper device pixel ratio
    // Make sure the resize listener is enabled
    onResize: function(chart: any) {
      // Simple resize without additional logic
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: maxYValue,
        grid: {
          color: function(context: ContextWithTickValue) {
            // Only draw grid lines for specific values
            const value = context.tick.value;
            const targetValues = [0, midYValue, maxYValue];
            // Check if value is close to any target value (integer comparison)
            const isTargetValue = targetValues.some(target => 
              Math.abs(value - target) < 0.001
            );
            return isTargetValue ? 
              'rgba(255, 255, 255, 0.2)' : // Brighter lines for main grid
              'rgba(0, 0, 0, 0)'; // Transparent for other lines
          },
          lineWidth: (context: ContextWithTickValue) => {
            const value = context.tick.value;
            const targetValues = [0, midYValue, maxYValue];
            // Check if value is close to any target value
            const isTargetValue = targetValues.some(target => 
              Math.abs(value - target) < 0.001
            );
            return isTargetValue ? 1 : 0;
          }
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 10
          },
          // Force specific values to appear
          callback: function(tickValue: number | string) {
            const numValue = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
            const targetValues = [0, midYValue, maxYValue];
            const isTargetValue = targetValues.some(target => 
              Math.abs(numValue - target) < 0.001
            );
            return isTargetValue ? formatTickValue(numValue) : '';
          },
          // Generate enough ticks to include our target values
          count: 7 // Should generate enough ticks to include our 3 target values
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 8
          },
          maxTicksLimit: 6
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true
      }
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2.5,
        borderCapStyle: "round" as CanvasLineCap,
        fill: true
      },
      point: {
        radius: 0,
        hoverRadius: 0,
        hitRadius: 0
      }
    }
  };

  return (
    <div className="collision-graph-container" style={graphStyle}>
      <div className="collision-graph-header">
        <div className="collision-graph-title">COLLISIONS PER SECOND</div>
        <div className="collision-graph-value">{Math.round(currentCollisionCount)}</div>
      </div>
      <div className="collision-graph">
        <Line 
          ref={chartRef}
          data={chartData}
          options={options}
          redraw={false}
          fallbackContent={<div className="chart-fallback">Loading chart...</div>}
        />
      </div>
      <button 
        className="collision-graph-toggle"
        onClick={toggleVisibility}
        title="Hide Collision Graph"
      >
        ×
      </button>
    </div>
  );
};

export default CollisionGraph; 