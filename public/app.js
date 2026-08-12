function renderHeroChart(metrics) {
  const ctx = document.getElementById('heroChart').getContext('2d');
  const yearSelect = document.getElementById('year-select');
  const selectedYear = yearSelect ? yearSelect.value : '2025';

  if (heroChart) heroChart.destroy();

  const periodLabel = selectedYear === '2026' ? 'YTD COLLISIONS' : 'ANNUAL COLLISIONS';
  const combinedTotal = (metrics.alcohol_count || 0) + (metrics.phone_count || 0);

  heroChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['DRIVER INATTENTION', 'ALCOHOL + PHONE USE'],
      datasets: [
        // Dataset 0: Driver Inattention (Left Bar)
        {
          label: 'Inattention',
          data: [metrics.infrastructure_bound, 0],
          backgroundColor: '#ef4444',
          borderRadius: 4,
          barThickness: 65,
          stack: 'stack1'
        },
        // Dataset 1: Phone Use Segment (Bottom of Right Stack)
        {
          label: 'Cell Phone Use',
          data: [0, metrics.phone_count || 0],
          backgroundColor: '#3b82f6',
          borderRadius: 0,
          barThickness: 65,
          stack: 'stack1'
        },
        // Dataset 2: Alcohol Segment (Top of Right Stack)
        {
          label: 'Alcohol Involvement',
          data: [0, metrics.alcohol_count || 0],
          backgroundColor: '#a855f7',
          borderRadius: 4,
          barThickness: 65,
          stack: 'stack1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 55, bottom: 10 }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          offset: 4,
          color: '#ffffff',
          font: { family: 'Oswald', size: 13, weight: 'bold' },
          formatter: function(value, ctx) {
            // Label over the Left Bar
            if (ctx.datasetIndex === 0 && ctx.dataIndex === 0) {
              return `${value.toLocaleString()}\n${periodLabel}`;
            }
            // Stacked Total Label over the Right Bar (Only render on top segment)
            if (ctx.datasetIndex === 2 && ctx.dataIndex === 1) {
              return `COMBINED\n< ${combinedTotal.toLocaleString()}\nCOLLISIONS`;
            }
            return '';
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#ffffff', font: { family: 'Oswald', size: 12 } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          display: false,
          beginAtZero: true
        }
      }
    }
  });
}