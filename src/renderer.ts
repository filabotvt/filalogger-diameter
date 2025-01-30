// renderer.ts which is added inside index.html
declare const Chart: any;  // TypeScript declaration



const minuteData = {
  labels: Array(0).fill(0),
  datasets: [
    {
      label: 'Last 60 Seconds',
      data: Array(0).fill(null),
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.2,
      fill: false
    },
    {
      label: 'Upper Bound',
      data: Array(0).fill(3.9),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      borderDash: [5, 5],
      tension: 0,
      fill: false
    },
    {
      label: 'Lower Bound',
      data: Array(0).fill(3.7),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      borderDash: [5, 5],
      tension: 0,
      fill: false
    }
  ]
};

const hourData = {
  labels: Array(0).fill(0),
  datasets: [
    {
      label: 'All time',
      data: Array(0).fill(0),
      borderColor: 'rgb(255, 99, 132)',
      tension: 0.2,
      fill: false
    },
    {
      label: 'Upper Bound',
      data: Array(0).fill(3.9),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      borderDash: [5, 5],
      tension: 0,
      fill: false
    },
    {
      label: 'Lower Bound',
      data: Array(0).fill(3.7),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      borderDash: [5, 5],
      tension: 0,
      fill: false
    }
  ]
};

const minuteCanvas = document.getElementById('minuteChart') as HTMLCanvasElement;
const hourCanvas = document.getElementById('hourChart') as HTMLCanvasElement;

const minuteChart = new Chart(minuteCanvas, {
  type: 'line',
  data: minuteData,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        title: {
          display: true,
          text: 'Diameter (mm)'
        },
        min: 0,
        max: 10
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        },
       
      }
    },
    animation: {
      duration: 0
    },
    plugins: {
      legend: {
          display: true,
         align:'start'
      }
  }
  }
});

const hourChart = new Chart(hourCanvas, {
  type: 'line',
  data: hourData,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        title: {
          display: true,
          text: 'Diameter (mm)'
        },
        min: 0,
        max: 10
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        },
       
      }
    },
    animation: {
      duration: 0
    },
    plugins: {
      legend: {
          display: true,
         align:'start'
      }
  }
  }
});

let minuteCounter = 0;
let hourCounter = 0;
let hourAccumulator = 0;

function generateRandomNumber(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const value = 3.8 + (z * 0.1);
  return Math.max(3.0, Math.min(4.0, value));
}

function updateCharts() {
  const newValue = generateRandomNumber();
  
  if (minuteData.datasets[0].data.length < 60) {
    minuteData.datasets[0].data.push(newValue);
    minuteData.datasets[1].data.push(3.7);
    minuteData.datasets[2].data.push(3.9);
    minuteData.labels.push(minuteCounter);
  } else {
    minuteData.datasets[0].data.shift();
    minuteData.datasets[0].data.push(newValue);
    minuteData.labels.shift();
    minuteData.labels.push(minuteCounter);
  }
  minuteChart.update();
  
  // hourAccumulator += newValue;
  
  hourData.datasets[0].data.push(newValue);
  hourData.datasets[1].data.push(3.7);
  hourData.datasets[2].data.push(3.9);
  hourData.labels.push(minuteCounter);
  hourChart.update();

  minuteCounter++;
  // if (minuteCounter === 60) {
  //   const hourlyAverage = hourAccumulator / 60;
  //   hourData.datasets[0].data.shift();
  //   hourData.datasets[0].data.push(hourlyAverage);
  //   hourChart.update();
    
  //   minuteCounter = 0;
  //   hourAccumulator = 0;
  //   hourCounter++;
  // }
}

// setInterval(updateCharts, 1000);

interface Window {
  serialApi: {
      connectPort: (portName: string) => Promise<{ success: boolean; error?: string }>;
      onDiameterChange: (callback: (diameter: string) => void) => void;
      onCommandUpdate: (callback: (command: any) => void) => void;
      removeListeners: () => void;
  };
}

// Set up serial port connection
async function connectToSerial() {
  try {
    const result = await window.serialApi.connectPort('COM3');
    if (!result.success) {
      console.error('Failed to connect:', result.error);
      // Retry connection after 5 seconds if failed
      setTimeout(connectToSerial, 5000);
    }
  } catch (error) {
    console.error('Connection error:', error);
    // Retry connection after 5 seconds if error
    setTimeout(connectToSerial, 5000);
  }
}


// Connect to serial port automatically when page loads
document.addEventListener('DOMContentLoaded', () => {
  connectToSerial();
});



// Set up the diameter change listener
window.serialApi.onDiameterChange((diameter) => {
  const diameterValue = parseFloat(diameter);
  if (!isNaN(diameterValue)) {
    // Update both minute and hour data
    if (minuteData.datasets[0].data.length < 60) {
      minuteData.datasets[0].data.push(diameterValue);
      minuteData.labels.push(minuteCounter);
    } else {
      minuteData.datasets[0].data.shift();
      minuteData.datasets[0].data.push(diameterValue);
      minuteData.labels.shift();
      minuteData.labels.push(minuteCounter);
    }
    minuteChart.update();
    
    hourData.datasets[0].data.push(diameterValue);
    hourData.labels.push(minuteCounter);
    hourChart.update();
    
    minuteCounter++;
  }
});

// Clean up listeners when window is closed
window.addEventListener('beforeunload', () => {
  window.serialApi.removeListeners();
});
 