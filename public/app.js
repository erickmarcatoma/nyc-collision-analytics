// Register ChartDataLabels plugin for Chart.js
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

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
    const kpiPromise = fetch(`/api/kpi?borough=${borough}&year=${year}`).then(res => res.json());
    const chartPromise = fetch(`/api/collisions/comparison?borough=${borough}&year=${year}`).then(res => res.json());

    const [kpiResult, chartResult] = await Promise.all([kpiPromise, chartPromise]);

    if (kpiResult.success) {
      renderKPICards(kpiResult.kpi);
    }

    if (chartResult.success) {
      renderChart(chartResult.metrics, borough, year);
    }

  } catch (error) {
    console.error('Dashboard Engine Error:', error);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

function renderKPICards(kpi) {
  document.getElementById('kpi-volume').textContent = kpi.total_volume.toLocaleString();
  document.getElementById('kpi-top-cause').textContent = kpi.leading_cause;
  document.getElementById('kpi-top-count').textContent = `${kpi.leading_cause_count.toLocaleString()} incidents`;
  document.getElementById('kpi-share').textContent = `${kpi.primary_cause_share}%`;

  // Update Allocation Ratio KPI Card directly from KPI payload
  const ratioEl = document.getElementById('kpi-ratio');
  if (ratioEl && kpi.allocation_ratio !== undefined) {
    ratioEl.textContent = `${kpi.allocation_ratio}x`;
  }

  // Update Insight Banner count
  const inattentionEl = document.getElementById('inattention-count-text');
  if (inattentionEl && kpi.infrastructure_count !== undefined) {
    inattentionEl.textContent = `${kpi.infrastructure_count.toLocaleString()}+`;
  }
}

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
      layout: {
        padding: { top: 25 }
      },
      plugins: {
        title: {
          display: true,
          text: `Root Cause Comparison: Infrastructure Need vs. Ticketable Offenses (${yearLabel})`,
          color: '#f8fafc',
          font: { size: 15, weight: '600' },
          padding: { bottom: 20 }
        },
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#f8fafc',
          font: { weight: 'bold', size: 12 },
          formatter: function(value) {
            return value.toLocaleString() + ' crashes';
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
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#334155' } },
        y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}