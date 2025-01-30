declare const Chart: any;  // TypeScript declaration

const formatTimeLabel = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

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
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          maxTicksLimit: 3
        }
      }
    },
    animation: {
      duration: 0
    },
    plugins: {
      legend: {
        display: true,
        align: 'start'
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
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          maxTicksLimit: 3
        }
      }
    },
    animation: {
      duration: 0
    },
    plugins: {
      legend: {
        display: true,
        align: 'start'
      }
    }
  }
});

let lastTenPoints: number[] = []
let lastState: SerialState | null= null;

interface SerialState {
  recording: boolean;
  max: number;
  min: number;
  spoolNumber: number;
  batchNumber: number;
  upperLimit: number;
  lowerLimit: number;
  target: number;
}

interface Window {
  serialApi: {
      connectPort: (portName: string) => Promise<{ success: boolean; error?: string }>;
      onDiameterChange: (callback: (diameter: string) => void) => void;
      onStateChange: (callback: (state: SerialState) => void) => void;
      removeListeners: () => void;
      sendCommand: (command: string) => Promise<{ success: boolean; error?: string }>;
      openFolder: () => Promise<{ success: boolean; error?: string }>;
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



window.serialApi.onDiameterChange((diameter) => {
  const diameterValue = parseFloat(diameter);
  if (!isNaN(diameterValue)) {
    const currentTime = new Date();
    const timeLabel = formatTimeLabel(currentTime);

    // Update minute data
    if (minuteData.datasets[0].data.length < 60) {
      minuteData.datasets[0].data.push(diameterValue);
      minuteData.labels.push(timeLabel);
    } else {
      minuteData.datasets[0].data.shift();
      minuteData.datasets[0].data.push(diameterValue);
      minuteData.labels.shift();
      minuteData.labels.push(timeLabel);
    }
    minuteChart.update();
    
    if(lastTenPoints.length >= 10) {
      const average = lastTenPoints.reduce((acc, val) => acc + val, 0) / lastTenPoints.length;
      hourData.datasets[0].data.push(diameterValue);
      hourData.labels.push(timeLabel);
      hourChart.update();
      lastTenPoints = []
    } else {
      lastTenPoints.push(diameterValue)
    }
  }
});

window.serialApi.onStateChange((state) => {
  if (state.recording == true && (lastState == null || lastState.recording == false)){
    minuteData.datasets[0].data = []
    minuteData.labels = [];
    minuteChart.update();
    hourData.datasets[0].data = []
    hourData.labels = []
    hourChart.update();
  }
  lastState = state

});

// Clean up listeners when window is closed
window.addEventListener('beforeunload', () => {
  window.serialApi.removeListeners();
});
 

document.getElementById('startBtn')?.addEventListener('click', async () => {
  try {
      const result = await window.serialApi.sendCommand('start');
      if (!result.success) {
          console.error('Failed to send start command:', result.error);
      }
  } catch (error) {
      console.error('Error sending start command:', error);
  }
});

document.getElementById('openFolderBtn')?.addEventListener('click', async () => {
  try {
      const result = await window.serialApi.openFolder();
      if (!result.success) {
          console.error('Failed to send start command:', result.error);
      }
  } catch (error) {
      console.error('Error sending start command:', error);
  }
});

document.getElementById('stopBtn')?.addEventListener('click', async () => {
  try {
      const result = await window.serialApi.sendCommand('stop');
      if (!result.success) {
          console.error('Failed to send stop command:', result.error);
      }
  } catch (error) {
      console.error('Error sending stop command:', error);
  }
});