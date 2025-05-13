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
  maxDataPoints?: number // Maximum number of data points to display
}

const SpeedGraph: React.FC<SpeedGraphProps> = ({ 
  data = [],
  currentSpeed = 0,
  maxDataPoints = 100
}) => {
  const [isVisible, setIsVisible] = useState(true);
  
  // Toggle graph visibility
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  // If not visible, show the toggle button
  if (!isVisible) {
    return (
      <button 
        className="speed-graph-toggle-minimized"
        onClick={toggleVisibility}
        title="Show Speed Graph"
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ margin: 'auto' }}
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
      </button>
    );
  }

  // Create dummy data for testing if data is empty
  const processedData = data.length > 1 ? data : [0, 0.5, 1, 0.8, 0.6];
  
  // Create labels (timestamps)
  const labels = Array.from({ length: processedData.length }, (_, i) => `${(i*0.5).toFixed(1)}s`);

  // Configure chart data with big, visible elements
  const chartData = {
    labels: labels,
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
  
  // Simple chart options focused on visibility
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // Disable animation by setting duration to 0
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 1,
        grid: {
          color: function(context: any) {
            // Only draw grid lines for 0, 0.5, and 1
            const value = context.tick.value;
            const targetValues = [0, 0.5, 1];
            return targetValues.includes(value) ? 
              'rgba(255, 255, 255, 0.2)' : // Brighter lines for main grid
              'rgba(0, 0, 0, 0)'; // Transparent for other lines
          },
          lineWidth: (context: any) => {
            const value = context.tick.value;
            return [0, 0.5, 1].includes(value) ? 1 : 0;
          }
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 10
          },
          // Force specific values to appear
          callback: function(tickValue: number | string) {
            return [0, 0.5, 1].includes(Number(tickValue)) ? tickValue : '';
          },
          // Explicitly set the tick values we want
          stepSize: 0.5
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
    <div className="speed-graph-container">
      <div className="speed-graph-header">
        <div className="speed-graph-title">AVERAGE PARTICLE SPEED</div>
        <div className="speed-graph-value">{currentSpeed.toFixed(2)}</div>
      </div>
      <div className="speed-graph">
        <Line 
          data={chartData}
          options={options}
          redraw={false}
        />
      </div>
      <button 
        className="speed-graph-toggle"
        onClick={toggleVisibility}
        title="Hide Speed Graph"
      >
        ×
      </button>
    </div>
  );
};

export default SpeedGraph; 