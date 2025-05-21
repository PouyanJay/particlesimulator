import React, { useState, useEffect, useRef } from 'react'
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
import '../styles/SpeedGraph.css'

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

interface SpeedGraphProps {
  data: number[] // Array of speed values
  currentSpeed: number // Current average speed
  initialVelocity: number // Initial velocity value to scale the y-axis
  isVisible?: boolean // Whether the graph is currently visible
  onVisibilityChange?: (visible: boolean) => void // Callback when visibility changes
  isMobileView?: boolean; // To adapt options for mobile
}

const SpeedGraph: React.FC<SpeedGraphProps> = ({ 
  data,
  currentSpeed,
  initialVelocity,
  isVisible = true,
  onVisibilityChange,
  isMobileView = false // Default to false if not provided
}) => {
  // Use local state but sync with parent through callback
  const [localVisible, setLocalVisible] = useState<boolean>(isVisible);
  const chartRef = useRef<any>(null);
  
  // Keep local state in sync with prop
  useEffect(() => {
    setLocalVisible(isVisible);
  }, [isVisible]);
  
  // Add window resize listener & initial resize trigger
  useEffect(() => {
    const chartInstance = chartRef.current?.current; // Direct reference to Chart.js instance

    const handleWindowResize = () => {
      if (localVisible && chartInstance) {
        chartInstance.resize(); // Just tell the chart to resize itself. onResize in options will handle the rest.
      }
    };

    window.addEventListener('resize', handleWindowResize);

    let timerId: NodeJS.Timeout | undefined;
    if (localVisible && chartInstance) {
      timerId = setTimeout(() => {
        if (chartInstance) { // Check if instance still exists
          chartInstance.resize(); // Trigger resize, which in turn triggers onResize in options
          // Forcefully apply y-axis settings after initial resize
          if (chartInstance.options && chartInstance.options.scales && chartInstance.options.scales.y) {
            chartInstance.options.scales.y.min = 0;
            chartInstance.options.scales.y.beginAtZero = true;
          }
          chartInstance.update('none'); // Update without animation
        }
      }, 100); // Increased delay slightly for more stability on initial load
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [localVisible]); // Re-run if visibility changes
  
  // Calculate y-axis limits based on initialVelocity
  const maxDataValue = Math.max(...data, initialVelocity * 1.3);
  const maxYValue = Math.max(initialVelocity * 1.3, maxDataValue * 1.1);
  const midYValue = maxYValue * 0.5;
  
  // Format y-axis tick values to 2 decimal places
  const formatTickValue = (value: number): string => value.toFixed(2);
  
  // Toggle graph visibility
  const toggleVisibility = (): void => {
    const newVisibility = !localVisible;
    setLocalVisible(newVisibility);
    // Notify parent component about the visibility change
    if (onVisibilityChange) {
      onVisibilityChange(newVisibility);
    }
  };

  // If not visible, show the toggle button
  if (!localVisible) {
    return (
      <button 
        className="speed-graph-toggle-minimized"
        onClick={toggleVisibility}
        title="Show Speed Graph"
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
              {/* Line chart icon */}
              <path 
                d="M3 16L7 12L11 14L21 4" 
                stroke="#38bdf8" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              {/* Bottom line */}
              <path 
                d="M3 20H21" 
                stroke="#38bdf8" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </svg>
          </div>
          <span className="toggle-label">SPD</span>
        </div>
      </button>
    );
  }

  // Process data with fixed limit of 100 points
  const processedData: number[] = (() => {
    if (data.length <= 1) {
      return [0, 0.5, 1, 0.8, 0.6]; // Default data for empty input
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
        label: 'Speed',
        data: processedData,
        backgroundColor: 'rgba(56, 189, 248, 0.3)',
        borderColor: '#38bdf8',
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
  
  type ContextWithTickValue = {
    tick: {
      value: number;
    };
  };
  
  // Simple chart options focused on visibility
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // Disable animation by setting duration to 0
    },
    devicePixelRatio: window.devicePixelRatio || 1, // Use proper device pixel ratio
    onResize: function(chart: any /*, size: {width: number, height: number} // Removed unused size parameter */) {
      // Ensure y-axis starts at 0 after Chart.js internal resize handling
      if (chart.options && chart.options.scales && chart.options.scales.y) {
        chart.options.scales.y.min = 0; 
        chart.options.scales.y.beginAtZero = true; 
      }
      chart.update('none'); // Force update after applying options
    },
    scales: {
      x: {
        grid: {
          display: false, // Hide x-axis grid lines
        },
        ticks: {
          display: false, // Hide x-axis labels
        }
      },
      y: {
        beginAtZero: true, // Always start y-axis at 0
        min: 0, // Explicitly set minimum to 0
        max: maxYValue, // Dynamic max value based on initialVelocity
        border: {
          display: true,
          width: 1
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: isMobileView ? 9 : 10 // Slightly smaller font for mobile ticks
          },
          precision: 2, // Force 2 decimal precision
          // Force specific values to appear
          callback: function(tickValue: number | string) {
            const numValue = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
            const targetValues = [0, midYValue, maxYValue];
            const isTargetValue = targetValues.some(target => 
              Math.abs(numValue - target) < 0.001
            );
            // On mobile, show all target values if they are generated, otherwise it might look too sparse.
            // On desktop, only show the formatted ones, hiding intermediate auto-generated ticks.
            return isMobileView ? (isTargetValue ? formatTickValue(numValue) : formatTickValue(numValue)) : (isTargetValue ? formatTickValue(numValue) : '');
          },
          // Generate enough ticks to include our target values
          count: isMobileView ? 5 : 7 // Fewer ticks on mobile
        },
        // Grid line configuration to ensure consistent display
        grid: {
          color: function(context: ContextWithTickValue) {
            // Only draw grid lines for specific values
            const value = context.tick.value;
            const targetValues = [0, midYValue, maxYValue];
            // Check if value is close to any target value (floating point comparison)
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
          },
          drawTicks: true,
          drawOnChartArea: true
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
    <div className="speed-graph-container">
      <div className="speed-graph-header" style={{position: 'relative'}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <div className="speed-graph-title">AVERAGE PARTICLE SPEED</div>
          <div className="speed-graph-value">{currentSpeed.toFixed(2)}</div>
        </div>
        <button 
          className="speed-graph-toggle"
          onClick={toggleVisibility}
          title="Hide Speed Graph"
          style={{position: 'absolute', top: 0, right: 0}}
        >
          ×
        </button>
      </div>
      <div className="speed-graph">
        <Line 
          ref={chartRef}
          data={chartData}
          options={options}
          redraw={true}
          fallbackContent={<div className="chart-fallback">Loading chart...</div>}
        />
      </div>
    </div>
  );
};

export default SpeedGraph; 