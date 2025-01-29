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
        min: 3.3,
        max: 4.3
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
        min: 3.3,
        max: 4.3
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

setInterval(updateCharts, 1000);




//Khalil Gibran
 