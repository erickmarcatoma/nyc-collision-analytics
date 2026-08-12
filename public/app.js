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

  // AUTO-UPDATE: Re-fetch whenever Borough or Year dropdown selection changes
  const boroughSelect = document.getElementById('borough-select');
  const yearSelect = document.getElementById('year-select');

  if (boroughSelect) {
    boroughSelect.addEventListener('change', fetchAndRenderDashboard);
  }
  if (yearSelect) {
    yearSelect.addEventListener('change', fetchAndRenderDashboard);
  }
});

async function fetchAndRenderDashboard() {
  const boroughSelect = document.getElementById('borough-select');
  const yearSelect = document.getElementById('year-select');

  if (!boroughSelect || !yearSelect) return;

  const borough = boroughSelect.value;
  const year = yearSelect.value;

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
  const formattedCount = kpi.infrastructure_count ? kpi.infrastructure_count.toLocaleString() : '0';

  // 1. Update Col 1 Big Number
  const inattentionEl = document.getElementById('kpi-inattention');
  if (inattentionEl) {
    inattentionEl.textContent = `${formattedCount}+`;
  }

  // 2. Update Col 2 Red text under the slider
  const sliderTextEl = document.getElementById('slider-inattention-text');
  if (sliderTextEl) {
    sliderTextEl.textContent = `${formattedCount}+ INATTENTION`;
  }
}

function renderHeroChart(metrics) {
  const ctx = document.getElementById('heroChart').getContext('2d');
  const yearSelect = document.getElementById('year-select');
  const selectedYear = yearSelect ? yearSelect.value : '2025';

  if (heroChart) heroChart.destroy();

  // Dynamic period label: Uses YTD for current year (2026), ANNUAL for past full years
  const periodLabel = selectedYear === '2026' ? 'YTD COLLISIONS' : 'ANNUAL COLLISIONS';

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
      layout: {
        // Increased top padding ensures the datalabel numbers and subtext never overlap
        padding: { top: 45, bottom: 10 }
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
            if (ctx.dataIndex === 0) {
              return `${value.toLocaleString()}\n${periodLabel}`;
            }
            return `< ${value.toLocaleString()}\nCOMBINED`;
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
      layout: {
        padding: { top: 25 }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          color: '#0f172a',
          font: { family: 'Oswald', size: 12, weight: 'bold' },
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
    let color = '#ef4444';
    if (pt.user_type.includes('Pedestrian')) color = '#38bdf8';
    else if (pt.user_type.includes('Cyclist')) color = '#10b981';

    const circle = L.circleMarker([pt.lat, pt.lng], {
      radius: 5,
      fillColor: color,
      color: '#000000',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.7
    });

    circle.bindPopup(`
      <div style="font-size: 0.85rem; font-family: sans-serif; color: #0f172a; line-height: 1.4;">
        <strong>Impact:</strong> ${pt.user_type}<br/>
        <strong>Root Cause:</strong> ${pt.factor}<br/>
        <strong>Date:</strong> ${pt.date}
      </div>
    `);

    mapMarkersLayer.addLayer(circle);
  });
}