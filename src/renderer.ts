declare const Chart: any;  // TypeScript declaration

const formatTimeLabel = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    minute: '2-digit',
    hour: '2-digit',
    hour12: true
  });
};

const minuteData = {
  labels: Array(0).fill(0),
  datasets: [
    {
      label: 'Meas. Diameter',
      data: Array(0).fill(null),
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.2,
      fill: false
    },
    {
      label: 'Nom. Diameter',
      data: Array(0).fill(3.7),
      borderColor: 'rgb(63, 235, 48)',
      // borderDash: [5, 5],
      tension: 0,
      fill: false
    },
    {
      label: 'Upper Bound',
      data: Array(0).fill(3.9),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      // borderDash: [5, 5],
      tension: 0,
      fill: false
    },
    {
      label: 'Lower Bound',
      data: Array(0).fill(3.7),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      // borderDash: [5, 5],
      tension: 0,
      fill: false
    }
  ]
};

const hourData = {
  labels: Array(0).fill(0),
  datasets: [
    {
      label: 'Meas. Diameter',
      data: Array(0).fill(0),
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.2,
      fill: false
    },
    {
      label: 'Nom. Diamter',
      data: Array(0).fill(3.7),
      borderColor: 'rgb(63, 235, 48)',
      // borderDash: [5, 5],
      tension: 0,
      fill: false
    },
    {
      label: 'Upper Bound',
      data: Array(0).fill(3.9),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      // borderDash: [5, 5],
      tension: 0,
      fill: false
    },
    {
      label: 'Lower Bound',
      data: Array(0).fill(3.7),
      borderColor: 'rgba(255, 0, 0, 0.5)',
      // borderDash: [5, 5],
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
        ticks: {
          maxTicksLimit: 5
        }
        // min: 0,
        // max: 10
      },
      x: {
        // title: {
        //   display: true,
        //   text: 'Time'
        // },
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
    },
    elements: {
      point: {
        radius: 0  
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
        ticks: {
          maxTicksLimit: 5
        }
        // min: 0,
        // max: 10
      },
      x: {
        // title: {
        //   display: true,
        //   text: 'Time'
        // },
        ticks: {
          maxRotation: 0,
          minRotation: 0,

          maxTicksLimit: 5
        }
      }
    },
    animation: {
      duration: 0
    },
    plugins: {
      legend: {
        display: false,
        align: 'start'
      }
    },
    elements: {
      point: {
        radius: 0  // This removes the points
      }
    }
  }
});

let lastTenPoints: number[] = []
let lastState: SerialState | null= null;
let elapsedTime = 0;
let timer: NodeJS.Timeout | null;

interface SerialState {
  connected: boolean;
  recording: boolean;
  max: number;
  min: number;
  spoolNumber: number;
  batchNumber: number;
  upperLimit: number;
  lowerLimit: number;
  target: number;
  saveLocation: string;
  description: string;
}

interface Window {
  serialApi: {
      connectPort: (portName: string) => Promise<{ success: boolean; error?: string }>;
      onDiameterChange: (callback: (diameter: string) => void) => void;
      onStateChange: (callback: (state: SerialState) => void) => void;
      removeListeners: () => void;
      sendCommand: (command: string) => Promise<{ success: boolean; error?: string }>;
      setState: (command: SerialState) => Promise<{ success: boolean; error?: string }>;
      openFolder: () => Promise<{ success: boolean; error?: string }>;
      chooseFolder: () => Promise<{ success: boolean; error?: string }>;
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

function hideErrorDialog() {
  (document.getElementById('errorDialog')as HTMLInputElement).style.display = 'none'
}



window.serialApi.onDiameterChange((diameter) => {
  const diameterValue = parseFloat(diameter);
  // console.log()
  // console.log(`${lastState!.upperLimit} ${lastState!.target} ${lastState!.lowerLimit} ${minuteData.datasets[3].data.length} ${hourData.datasets[3].data.length}`);
  
  (document.getElementById('filamentDiameterText') as HTMLElement).textContent = `${diameterValue} mm`;
  if (!isNaN(diameterValue)) {
    const currentTime = new Date();
    const timeLabel = formatTimeLabel(currentTime);

    // Update minute data
    if (minuteData.datasets[0].data.length < 60) {
      minuteData.datasets[0].data.push(diameterValue);
      minuteData.datasets[1].data.push(lastState?.target || 0);
      minuteData.datasets[2].data.push(lastState?.lowerLimit || 0);
      minuteData.datasets[3].data.push(lastState?.upperLimit || 0);
      minuteData.labels.push("");
    } else {
      minuteData.datasets[0].data.shift();
      minuteData.datasets[0].data.push(diameterValue);
      minuteData.datasets[1].data.shift();
      minuteData.datasets[1].data.push(lastState?.target || 0);
      minuteData.datasets[2].data.shift();
      minuteData.datasets[2].data.push(lastState?.lowerLimit || 0);
      minuteData.datasets[3].data.shift();
      minuteData.datasets[3].data.push(lastState?.upperLimit || 0);
      minuteData.labels.shift();
      minuteData.labels.push("");
    }
    minuteChart.update();
    
    if(lastTenPoints.length >= 20) {
      const average = lastTenPoints.reduce((acc, val) => acc + val, 0) / lastTenPoints.length;
      hourData.datasets[0].data.push(diameterValue);
      hourData.labels.push(timeLabel);
      hourData.datasets[1].data.push(lastState?.target || 0);
      hourData.datasets[2].data.push(lastState?.lowerLimit || 0);
      hourData.datasets[3].data.push(lastState?.upperLimit || 0);
      
      hourChart.update();
      lastTenPoints = []
    } else {
      lastTenPoints.push(diameterValue)
    }
  }
});

window.serialApi.onStateChange((state) => {
  // console.log(state)
  if (state.recording == true && (lastState == null || lastState.recording == false)){
    console.log("start recording")
    minuteData.datasets[0].data = []
    minuteData.datasets[1].data = []
    minuteData.datasets[2].data = []
    minuteData.datasets[3].data = []
    minuteData.labels = [];
    minuteChart.update();
    hourData.datasets[0].data = []
    hourData.datasets[1].data = []
    hourData.datasets[2].data = []
    hourData.datasets[3].data = []

    hourData.labels = []
    elapsedTime = 0
    // console.log(`${lastState!.upperLimit} ${lastState!.target} ${lastState!.lowerLimit} ${minuteData.datasets[3].data.length} ${hourData.datasets[3].data.length}`);

    timer = setInterval(tick, 1000);
    hourChart.update();
    (document.getElementById('startBtn')as HTMLInputElement).disabled = true;
    (document.getElementById('stopBtn')as HTMLInputElement).disabled = false;
  }

  if (state.recording == false && (lastState == null || lastState.recording == true)) {
    if (timer) clearInterval(timer);
    timer = null;
    if(state.connected) {
      (document.getElementById('startBtn')as HTMLInputElement).disabled = false;
    }
    (document.getElementById('stopBtn')as HTMLInputElement).disabled = true;
  }
  // console.log(state)
  if (state.connected == true && (lastState == null || lastState.connected == false)) {
    
    (document.getElementById('errorMessage')as HTMLInputElement).style.display = 'none';
    (document.getElementById('startBtn')as HTMLInputElement).disabled = false;
  } 

  if (state.connected == false && (lastState == null || lastState.connected == true)) {
    (document.getElementById('errorMessage')as HTMLInputElement).style.display = 'block';
    (document.getElementById('startBtn')as HTMLInputElement).disabled = true;
    if(lastState?.recording) {
      (document.getElementById('errorDialog')as HTMLInputElement).style.display = 'block';
    }
  } 

  if(lastState == null) {
    setFormValues({
      ...state!,
      target: state.target,
      upperLimit: state.upperLimit,
      lowerLimit: state.lowerLimit,
      spoolNumber: state.spoolNumber,
      batchNumber: state.batchNumber
    });

    (document.getElementById('fileLocation') as HTMLElement).textContent = state.saveLocation;
  } else if(lastState.min != state.min) {
    setFormValues({
      ...state!,
      min: state.min
    })
  } else if(lastState.max != state.max) {
    setFormValues({
      ...state!,
      max: state.max
    })
  } else if(lastState.spoolNumber != state.spoolNumber) {
    setFormValues({
      ...state!,
      spoolNumber: state.spoolNumber
    })
  } else if(lastState.saveLocation != state.saveLocation) {
    (document.getElementById('fileLocation') as HTMLElement).textContent = state.saveLocation;
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

document.getElementById('chooseFolderBtn')?.addEventListener('click', async () => {
  try {
      const result = await window.serialApi.chooseFolder();
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


async function submitSettings() {
  let newState: SerialState = {
      ...lastState!,
      description: (document.getElementById('description') as HTMLTextAreaElement).value,
      target: parseFloat((document.getElementById('filamentDiameter') as HTMLInputElement).value),
      upperLimit: parseFloat((document.getElementById('upperLimit') as HTMLInputElement).value),
      lowerLimit: parseFloat((document.getElementById('lowestLimit') as HTMLInputElement).value),
      spoolNumber: parseInt((document.getElementById('spoolNumber') as HTMLInputElement).value),
      batchNumber: parseInt((document.getElementById('batchNumber') as HTMLInputElement).value)
  };
  console.log(newState)

  const result = await window.serialApi.setState(newState);
      if (!result.success) {
          console.error('Failed to send set state:', result.error);
      }
  toggleSettings()
  // You can add your API call or further processing here
}

// Function to set form values
function setFormValues(state: SerialState) {
  let min = state.min
  
  if (min == Infinity) {
    min = 0
  }
  (document.getElementById('description') as HTMLTextAreaElement).value = state.description || '';
  (document.getElementById('filamentDiameter') as HTMLInputElement).value = String(state.target || 1.75);
  (document.getElementById('upperLimit') as HTMLInputElement).value = String(state.upperLimit || 1.80);
  (document.getElementById('lowestLimit') as HTMLInputElement).value = String(state.lowerLimit || 1.70);
  (document.getElementById('spoolNumber') as HTMLInputElement).value = String(state.spoolNumber || 0);
  (document.getElementById('batchNumber') as HTMLInputElement).value = String(state.batchNumber || 0);
  (document.getElementById('maxText') as HTMLElement).textContent = `${state.max || 0} mm`;
  (document.getElementById('minText') as HTMLElement).textContent = `${min || 0} mm`;
  (document.getElementById('spoolNumberText') as HTMLElement).textContent = String(state.spoolNumber || 0);
  (document.getElementById('batchNumberText') as HTMLElement).textContent = String(state.batchNumber || 0);
}

const tick = () => {
    elapsedTime++;
    (document.getElementById('durationText')as HTMLElement).textContent = 
        `${~~(elapsedTime/3600)}:${(~~(elapsedTime/60)%60).toString().padStart(2,'0')}:${(elapsedTime%60).toString().padStart(2,'0')}`;
}
