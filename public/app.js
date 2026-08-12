let comparisonChart = null;

document.addEventListener('DOMContentLoaded', () => {
  // Execute initial load on startup
  fetchAndRenderChart();

  // Attach click event handler to the analysis button
  const updateBtn = document.getElementById('update-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', fetchAndRenderChart);
  }
});

async function fetchAndRenderChart() {
  const borough = document.getElementById('borough-select').value;
  const year = document.getElementById('year-select').value;
  const loadingEl = document.getElementById('loading');

  // Show loading indicator
  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    const response = await fetch(`/api/collisions/comparison?borough=${borough}&year=${year}`);
    const result = await response.json();

    if (result.success) {
      renderChart(result.metrics, borough, year);
    } else {
      console.error('Backend API Error:', result.error);
      alert('Error fetching data: ' + result.error);
    }
  } catch (error) {
    console.error('Fetch Error:', error);
    alert('Failed to connect to the server API.');
  } finally {
    // Hide loading indicator
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

function renderChart(metrics, borough, year) {
  const ctx = document.getElementById('comparisonChart').getContext('2d');

  // Safely destroy previous chart instance before redrawing
  if (comparisonChart) {
    comparisonChart.destroy();
  }

  const boroughLabel = borough === 'ALL' ? 'All NYC Boroughs' : borough;
  const yearLabel = year === 'ALL' ? '2012–Present' : year;

  comparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [
        'Infrastructure-Bound (Driver Inattention)', 
        'Enforceable Offenses (Cell Phone / Alcohol / Speeding)'
      ],
      datasets: [{
        label: `Collisions in ${boroughLabel} (${yearLabel})`,
        data: [metrics.infrastructure_bound, metrics.enforceable],
        backgroundColor: [
          '#ef4444', // Red for Infrastructure Need
          '#3b82f6'  // Blue for Enforcement Target
        ],
        borderColor: [
          '#dc2626',
          '#2563eb'
        ],
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: `Root Cause Comparison: Infrastructure Need vs. Ticketable Offenses (${yearLabel})`,
          color: '#f8fafc',
          font: {
            size: 15,
            weight: '600'
          },
          padding: {
            bottom: 20
          }
        },
        legend: {
          labels: {
            color: '#cbd5e1'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` Total Incidents: ${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 11 } },
          grid: { color: '#334155' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8' },
          grid: { color: '#334155' }
        }
      }
    }
  });
}