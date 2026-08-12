if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

let heroChart = null;
let budgetChart = null;

let mapInstance = null;
let mapMarkersLayer = null;

const BOROUGH_CENTERS = {
  'ALL': [40.7128, -74.0060, 11],
  'MANHATTAN': [40.7831, -73.9712, 12],
  'BROOKLYN': [40.6501, -73.9495, 11],
  'QUEENS': [40.7282, -73.7949, 11],
  'BRONX': [40.8448, -73.8648, 12],
  'STATEN ISLAND': [40.5795, -74.1502, 11]
};

document.addEventListener('DOMContentLoaded', () => {
  initMapIfNeeded();
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
    const mapPromise = fetch(`/api/map?borough=${borough}&year=${year}`).then(res => res.json());

    const [kpiResult, chartResult, mapResult] = await Promise.all([kpiPromise, chartPromise, mapPromise]);

    if (kpiResult.success) {
      updateInsightSection(kpiResult.kpi);
    }

    if (chartResult.success) {
      renderHeroChart(chartResult.metrics);
      renderBudgetChart(chartResult.metrics);
    }

    if (mapResult.success) {
      renderMapPoints(mapResult.points, borough);
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

function initMapIfNeeded() {
  if (!mapInstance && typeof L !== 'undefined') {
    mapInstance = L.map('mapView').setView([40.7128, -74.0060], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(mapInstance);

    mapMarkersLayer = L.layerGroup().addTo(mapInstance);
  }
}

function renderMapPoints(points, borough) {
  if (!mapInstance || !mapMarkersLayer) return;

  mapMarkersLayer.clearLayers();

  const centerConfig = BOROUGH_CENTERS[borough.toUpperCase()] || BOROUGH_CENTERS['ALL'];
  mapInstance.setView([centerConfig[0], centerConfig[1]], centerConfig[2]);

  points.forEach(pt => {
    const circle = L.circleMarker([pt.lat, pt.lng], {
      radius: 5,
      fillColor: '#ef4444',
      color: '#b91c1c',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.6
    });

    circle.bindPopup(`
      <div style="font-size: 0.85rem; font-family: sans-serif; color: #0f172a;">
        <strong>Factor:</strong> ${pt.factor}<br/>
        <strong>Date:</strong> ${pt.date}
      </div>
    `);

    mapMarkersLayer.addLayer(circle);
  });
}