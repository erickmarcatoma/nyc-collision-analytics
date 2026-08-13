if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

let heroChart = null;
let budgetChart = null;

let mapInstance = null;
let mapMarkersLayer = null;
let currentMapPoints = []; // Stores latest points globally for instant client-side filtering

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

  // Primary Dropdown Listeners
  const boroughSelect = document.getElementById('borough-select');
  const yearSelect = document.getElementById('year-select');

  if (boroughSelect) boroughSelect.addEventListener('change', fetchAndRenderDashboard);
  if (yearSelect) yearSelect.addEventListener('change', fetchAndRenderDashboard);

  // Secondary Dropdown Listeners (Dataset B)
  const boroughSelectB = document.getElementById('borough-select-b');
  const yearSelectB = document.getElementById('year-select-b');

  if (boroughSelectB) boroughSelectB.addEventListener('change', fetchAndRenderDashboard);
  if (yearSelectB) yearSelectB.addEventListener('change', fetchAndRenderDashboard);

  // Compare Toggle Listener
  const compareToggle = document.getElementById('compare-toggle');
  const compareControlsRow = document.getElementById('compare-controls-row');

  if (compareToggle) {
    compareToggle.addEventListener('change', () => {
      if (compareControlsRow) {
        compareControlsRow.style.display = compareToggle.checked ? 'flex' : 'none';
      }
      fetchAndRenderDashboard();
    });
  }
});

async function fetchAndRenderDashboard() {
  const boroughSelect = document.getElementById('borough-select');
  const yearSelect = document.getElementById('year-select');
  const compareToggle = document.getElementById('compare-toggle');

  if (!boroughSelect || !yearSelect) return;

  const boroughA = boroughSelect.value;
  const yearA = yearSelect.value;
  const isCompareMode = compareToggle ? compareToggle.checked : false;

  showLoadingState(true);

  try {
    // Dataset A Queries
    const kpiPromiseA = fetch(`/api/kpi?borough=${boroughA}&year=${yearA}`).then(res => res.json());
    const chartPromiseA = fetch(`/api/collisions/comparison?borough=${boroughA}&year=${yearA}`).then(res => res.json());
    const mapPromiseA = fetch(`/api/map?borough=${boroughA}&year=${yearA}`).then(res => res.json());

    // Dataset B Queries (if Compare Mode enabled)
    let chartPromiseB = Promise.resolve(null);
    if (isCompareMode) {
      const boroughSelectB = document.getElementById('borough-select-b');
      const yearSelectB = document.getElementById('year-select-b');
      const boroughB = boroughSelectB ? boroughSelectB.value : 'MANHATTAN';
      const yearB = yearSelectB ? yearSelectB.value : '2021';

      chartPromiseB = fetch(`/api/collisions/comparison?borough=${boroughB}&year=${yearB}`).then(res => res.json());
    }

    const [kpiResultA, chartResultA, mapResultA, chartResultB] = await Promise.all([
      kpiPromiseA, chartPromiseA, mapPromiseA, chartPromiseB
    ]);

    if (kpiResultA.success && kpiResultA.kpi.total_volume === 0) {
      showEmptyState();
      return;
    }

    if (kpiResultA.success) {
      updateInsightSection(kpiResultA.kpi);
    }

    if (chartResultA.success) {
      const metricsB = (chartResultB && chartResultB.success) ? chartResultB.metrics : null;
      renderHeroChart(chartResultA.metrics, metricsB, isCompareMode);
      renderBudgetChart(chartResultA.metrics);
    }

    if (mapResultA.success) {
      currentMapPoints = mapResultA.points;
      renderMapPoints(currentMapPoints, boroughA);
      resetMapFilterButtons();
    }

  } catch (error) {
    console.error('Advocacy Engine Error:', error);
    showErrorState();
  } finally {
    showLoadingState(false);
  }
}

/* =========================================================
   INTERACTIVE MAP FILTER TOGGLES
========================================================= */
function filterMapPoints(userCategory) {
  const boroughSelect = document.getElementById('borough-select');
  const borough = boroughSelect ? boroughSelect.value : 'ALL';

  updateMapFilterButtonStyles(userCategory);

  if (userCategory === 'ALL') {
    drawMapMarkers(currentMapPoints, borough);
    return;
  }

  const filteredPoints = currentMapPoints.filter(pt => pt.user_type.includes(userCategory));
  drawMapMarkers(filteredPoints, borough);
}

function updateMapFilterButtonStyles(selectedCategory) {
  const btnAll = document.getElementById('btn-map-all');
  const btnPed = document.getElementById('btn-map-ped');
  const btnCyc = document.getElementById('btn-map-cyc');
  const btnDrv = document.getElementById('btn-map-drv');

  const allBtns = [btnAll, btnPed, btnCyc, btnDrv];
  allBtns.forEach(btn => {
    if (btn) btn.className = 'map-btn-filter';
  });

  if (selectedCategory === 'ALL' && btnAll) btnAll.className = 'map-btn-filter active-all';
  if (selectedCategory === 'Pedestrian' && btnPed) btnPed.className = 'map-btn-filter active-ped';
  if (selectedCategory === 'Cyclist' && btnCyc) btnCyc.className = 'map-btn-filter active-cyc';
  if (selectedCategory === 'Driver' && btnDrv) btnDrv.className = 'map-btn-filter active-drv';
}

function resetMapFilterButtons() {
  updateMapFilterButtonStyles('ALL');
}

/* =========================================================
   UI STATE HANDLERS (Spinner, Empty, Error)
========================================================= */
function showLoadingState(isLoading) {
  const heroContainer = document.querySelector('.hero-chart-container');
  if (!heroContainer) return;

  let overlay = document.getElementById('hero-loading-overlay');
  if (isLoading) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hero-loading-overlay';
      overlay.className = 'chart-loading-overlay';
      overlay.innerHTML = `
        <div class="spinner"></div>
        <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.6rem; font-family:'Oswald', sans-serif; letter-spacing:0.05em;">FETCHING LIVE CITY DATA...</div>
      `;
      heroContainer.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  } else if (overlay) {
    overlay.style.display = 'none';
  }
}

function showEmptyState() {
  const inattentionEl = document.getElementById('kpi-inattention');
  if (inattentionEl) inattentionEl.textContent = '0';

  const sliderTextEl = document.getElementById('slider-inattention-text');
  if (sliderTextEl) sliderTextEl.textContent = '0 INATTENTION';

  if (heroChart) heroChart.destroy();
  if (budgetChart) budgetChart.destroy();
  if (mapMarkersLayer) mapMarkersLayer.clearLayers();
}

function showErrorState() {
  const inattentionEl = document.getElementById('kpi-inattention');
  if (inattentionEl) inattentionEl.textContent = 'N/A';

  const sliderTextEl = document.getElementById('slider-inattention-text');
  if (sliderTextEl) sliderTextEl.textContent = 'NO DATA AVAILABLE';
}

/* =========================================================
   DASHBOARD COMPONENT RENDERERS
========================================================= */
function updateInsightSection(kpi) {
  const count = kpi.infrastructure_count || 0;
  const formattedCount = count.toLocaleString();

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

  // 3. Smoothly animate Column 2 slider handle position
  const sliderHandle = document.getElementById('redesign-slider-handle');
  if (sliderHandle) {
    const maxVolume = 25000;
    const offset = Math.max(10, Math.min(85, 100 - (count / maxVolume * 75)));
    sliderHandle.style.transition = 'left 0.6s ease-in-out';
    sliderHandle.style.left = `${offset}%`;
  }

  // 4. Dynamic Solutions Scope update based on crash volume
  const scopeTitleEl = document.getElementById('solution-scope-title');
  const scopeDescEl = document.getElementById('solution-scope-desc');

  if (scopeTitleEl && scopeDescEl) {
    if (count > 10000) {
      scopeTitleEl.textContent = "Scope: City-Wide Corridor Overhauls";
      scopeDescEl.innerHTML = `High annual crash volume requires systemic road diets and concrete pedestrian medians across main arterial avenues. Physical redesigns reduce conflict points by up to <strong>70%</strong>.`;
    } else {
      scopeTitleEl.textContent = "Scope: Targeted Intersection Hardening";
      scopeDescEl.innerHTML = `Moderate crash volume calls for localized daylighting, corner bulb-outs, and hardened left-turn bays at high-injury hotspots. Physical redesigns reduce conflict points by up to <strong>70%</strong>.`;
    }
  }
}

function renderHeroChart(metricsA, metricsB, isCompareMode) {
  const ctx = document.getElementById('heroChart').getContext('2d');
  
  const yearSelectA = document.getElementById('year-select');
  const selectedYearA = yearSelectA ? yearSelectA.value : '2025';

  if (heroChart) heroChart.destroy();

  const combinedTotalA = (metricsA.alcohol_count || 0) + (metricsA.phone_count || 0);

  // Default Standard View (Dataset A Only)
  let chartDatasets = [
    {
      label: 'Dataset A: Inattention',
      data: [metricsA.infrastructure_bound, 0],
      backgroundColor: '#ef4444',
      borderRadius: 4,
      barThickness: isCompareMode ? 40 : 65,
      stack: 'stackA'
    },
    {
      label: 'Dataset A: Cell Phone Use',
      data: [0, metricsA.phone_count || 0],
      backgroundColor: '#38bdf8',
      borderRadius: 4,
      barThickness: isCompareMode ? 40 : 65,
      stack: 'stackA'
    },
    {
      label: 'Dataset A: Alcohol Involvement',
      data: [0, metricsA.alcohol_count || 0],
      backgroundColor: '#a855f7',
      borderRadius: 4,
      barThickness: isCompareMode ? 40 : 65,
      stack: 'stackA'
    }
  ];

  // If Compare Mode is Active: Append Dataset B Stacked Bars
  if (isCompareMode && metricsB) {
    chartDatasets.push(
      {
        label: 'Dataset B: Inattention',
        data: [metricsB.infrastructure_bound, 0],
        backgroundColor: '#f59e0b', // Amber/Gold for Dataset B
        borderRadius: 4,
        barThickness: 40,
        stack: 'stackB'
      },
      {
        label: 'Dataset B: Phone Use',
        data: [0, metricsB.phone_count || 0],
        backgroundColor: '#fbbf24',
        borderRadius: 4,
        barThickness: 40,
        stack: 'stackB'
      },
      {
        label: 'Dataset B: Alcohol',
        data: [0, metricsB.alcohol_count || 0],
        backgroundColor: '#d97706',
        borderRadius: 4,
        barThickness: 40,
        stack: 'stackB'
      }
    );
  }

  heroChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['DRIVER INATTENTION', 'ALCOHOL + PHONE USE'],
      datasets: chartDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 65, bottom: 10 }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          offset: 4,
          color: '#ffffff',
          font: { family: 'Oswald', size: 12, weight: 'bold' },
          formatter: function(value, ctx) {
            if (ctx.datasetIndex === 0 && ctx.dataIndex === 0) {
              return isCompareMode ? `[A] ${value.toLocaleString()}` : `${value.toLocaleString()}\n${selectedYearA === '2026' ? 'YTD' : 'ANNUAL'}`;
            }
            if (ctx.datasetIndex === 2 && ctx.dataIndex === 1) {
              return isCompareMode ? `[A] < ${combinedTotalA.toLocaleString()}` : `COMBINED\n< ${combinedTotalA.toLocaleString()}\nCOLLISIONS`;
            }
            if (isCompareMode && ctx.datasetIndex === 3 && ctx.dataIndex === 0) {
              return `[B] ${value.toLocaleString()}`;
            }
            if (isCompareMode && ctx.datasetIndex === 5 && ctx.dataIndex === 1) {
              const combinedTotalB = (metricsB.alcohol_count || 0) + (metricsB.phone_count || 0);
              return `[B] < ${combinedTotalB.toLocaleString()}`;
            }
            return '';
          }
        }
      },
      scales: {
        x: {
          stacked: false,
          ticks: { color: '#ffffff', font: { family: 'Oswald', size: 12 } },
          grid: { display: false }
        },
        y: {
          stacked: false,
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

  const enforcementVal = metrics.enforceable || 1;
  const redesignVal = metrics.infrastructure_bound || 0;
  const ratioMultiple = (redesignVal / enforcementVal).toFixed(1);

  const ratioBadge = document.getElementById('budget-ratio-badge');
  if (ratioBadge) {
    ratioBadge.textContent = `RECOMMENDED CAPITAL ALLOCATION: ${ratioMultiple}x TO REDESIGN`;
  }

  budgetChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['ENFORCEMENT', 'STREET REDESIGN'],
      datasets: [{
        data: [metrics.enforceable, metrics.infrastructure_bound],
        backgroundColor: ['#475569', '#10b981'],
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
  drawMapMarkers(points, borough);
}

function drawMapMarkers(pointsToDraw, borough) {
  if (!mapInstance || !mapMarkersLayer) return;

  mapMarkersLayer.clearLayers();

  const centerConfig = BOROUGH_CENTERS[borough.toUpperCase()] || BOROUGH_CENTERS['ALL'];
  mapInstance.setView([centerConfig[0], centerConfig[1]], centerConfig[2]);

  pointsToDraw.forEach(pt => {
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