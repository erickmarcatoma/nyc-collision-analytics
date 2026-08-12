let comparisonChart = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchAndRenderDashboard();

  const updateBtn = document.getElementById('update-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', fetchAndRenderDashboard);
  }
});

async function fetchAndRenderDashboard() {
  const borough = document.getElementById('borough-select').value;
  const year = document.getElementById('year-select').value;
  const loadingEl = document.getElementById('loading');

  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    // 1. Fetch Part A: Executive KPI Summary
    const kpiPromise = fetch(`/api/kpi?borough=${borough}&year=${year}`).then(res => res.json());

    // 2. Fetch Comparative Chart Data
    const chartPromise = fetch(`/api/collisions/comparison?borough=${borough}&year=${year}`).then(res => res.json());

    const [kpiResult, chartResult] = await Promise.all([kpiPromise, chartPromise]);

    // Render Part A
    if (kpiResult.success) {
      renderKPICards(kpiResult.kpi);
    }

    // Render Chart
    if (chartResult.success) {
      renderChart(chartResult.metrics, borough, year);
    }

  } catch (error) {
    console.error('Dashboard Engine Error:', error);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

// PART A: Executive KPI Renderer
function renderKPICards(kpi) {
  document.getElementById('kpi-volume').textContent = kpi.total_volume.toLocaleString();
  document.getElementById('kpi-top-cause').textContent = kpi.leading_cause;
  document.getElementById('kpi-top-count').textContent = `${kpi.leading_cause_count.toLocaleString()} incidents`;
  document.getElementById('kpi-share').textContent = `${kpi.primary_cause_share}%`;

  // Dynamically update the insight banner number
  const inattentionEl = document.getElementById('inattention-count-text');
  if (inattentionEl && kpi.infrastructure_count !== undefined) {
    inattentionEl.textContent = `${kpi.infrastructure_count.toLocaleString()}+`;
  }
}

// Chart Renderer
function renderChart(metrics, borough, year) {
  const ctx = document.getElementById('comparisonChart').getContext('2d');

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
        backgroundColor: ['#ef4444', '#3b82f6'],
        borderColor: ['#dc2626', '#2563eb'],
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
          font: { size: 15, weight: '600' },
          padding: { bottom: 20 }
        },
        legend: { labels: { color: '#cbd5e1' } },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` Total Incidents: ${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#334155' } },
        y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}