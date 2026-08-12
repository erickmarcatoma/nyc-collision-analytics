if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

let heroChart = null;
let budgetChart = null;

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

  try {
    const kpiPromise = fetch(`/api/kpi?borough=${borough}&year=${year}`).then(res => res.json());
    const chartPromise = fetch(`/api/collisions/comparison?borough=${borough}&year=${year}`).then(res => res.json());

    const [kpiResult, chartResult] = await Promise.all([kpiPromise, chartPromise]);

    if (kpiResult.success) {
      updateInsightSection(kpiResult.kpi);
    }

    if (chartResult.success) {
      renderHeroChart(chartResult.metrics);
      renderBudgetChart(chartResult.metrics);
    }

  } catch (error) {
    console.error('Advocacy Engine Error:', error);
  }
}

function updateInsightSection(kpi) {
  const inattentionEl = document.getElementById('kpi-inattention');
  if (inattentionEl && kpi.infrastructure_count !== undefined) {
    inattentionEl.textContent = `${kpi.infrastructure_count.toLocaleString()}+`;
  }
}

function renderHeroChart(metrics) {
  const ctx = document.getElementById('heroChart').getContext('2d');

  if (heroChart) heroChart.destroy();

  heroChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['DRIVER INATTENTION', 'ALCOHOL + PHONE USE'],
      datasets: [{
        data: [metrics.infrastructure_bound, metrics.enforceable],
        backgroundColor: ['#ef4444', '#a855f7'],
        borderRadius: 4,
        barThickness: 65
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#ffffff',
          font: { family: 'Oswald', size: 14, weight: 'bold' },
          formatter: function(value, ctx) {
            return ctx.dataIndex === 0 ? `${value.toLocaleString()}\nANNUAL COLLISIONS` : `< ${value.toLocaleString()}\nCOMBINED`;
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#ffffff', font: { family: 'Oswald', size: 12 } },
          grid: { display: false }
        },
        y: {
          display: false,
          beginAtZero: true
        }
      }
    }
  });
}

function renderBudgetChart(metrics) {
  const ctx = document.getElementById('budgetChart').getContext('2d');

  if (budgetChart) budgetChart.destroy();

  budgetChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['ENFORCEMENT', 'STREET REDESIGN'],
      datasets: [{
        data: [metrics.enforceable, metrics.infrastructure_bound],
        backgroundColor: ['#475569', '#6ee7b7'],
        borderRadius: 4,
        barThickness: 45
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#0f172a',
          font: { family: 'Oswald', size: 11, weight: 'bold' },
          formatter: function(value) {
            return value.toLocaleString();
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#0f172a', font: { family: 'Oswald', size: 10 } },
          grid: { display: false }
        },
        y: {
          display: false,
          beginAtZero: true
        }
      }
    }
  });
}