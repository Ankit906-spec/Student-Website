/**
 * Testing Dashboard JavaScript
 * Handles fetching and displaying analytics data
 */

const API_BASE = 'https://woxsen-app-student-backend.onrender.com';

// State
let currentSessions = [];
let currentSummary = null;
let charts = {
  eventTypes: null,
  pageViews: null,
  buttonClicks: null
};
let filters = {
  startDate: null,
  endDate: null,
  userId: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
  setupEventListeners();
  updateLastUpdated();
});

function setupEventListeners() {
  document.getElementById('refresh-btn').addEventListener('click', loadDashboardData);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('filter-btn').addEventListener('click', applyFilters);
  document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
  document.getElementById('close-modal-btn').addEventListener('click', closeModal);

  // Close modal on outside click
  document.getElementById('session-modal').addEventListener('click', (e) => {
    if (e.target.id === 'session-modal') {
      closeModal();
    }
  });
}

async function loadDashboardData() {
  try {
    showLoading();

    // Build query params
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    // Fetch summary
    const summaryRes = await fetch(`${API_BASE}/api/analytics/summary?${params}`);
    const summaryData = await summaryRes.json();
    currentSummary = summaryData;

    // Fetch sessions
    const sessionsParams = new URLSearchParams(params);
    if (filters.userId) sessionsParams.append('userId', filters.userId);
    const sessionsRes = await fetch(`${API_BASE}/api/analytics/sessions?${sessionsParams}`);
    const sessionsData = await sessionsRes.json();
    currentSessions = sessionsData;

    // Render everything
    renderSummaryStats(summaryData);
    renderSessions(sessionsData);
    renderEventTypes(summaryData.eventTypes);
    renderPageViews(summaryData.pageViews);
    renderButtonClicks(summaryData.buttonClicks);

    updateLastUpdated();
    hideLoading();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showError('Failed to load analytics data. Make sure the backend server is running.');
    hideLoading();
  }
}

function showLoading() {
  // Could add a loading spinner overlay
  console.log('Loading...');
}

function hideLoading() {
  console.log('Loading complete');
}

function showError(message) {
  alert(message);
}

function renderSummaryStats(data) {
  document.getElementById('total-events').textContent = (data.summary.totalEvents || 0).toLocaleString();
  document.getElementById('total-sessions').textContent = (data.summary.totalSessions || 0).toLocaleString();
  document.getElementById('unique-users').textContent = (data.summary.uniqueUsers || 0).toLocaleString();
  document.getElementById('avg-session-time').textContent = data.summary.avgSessionDuration || '0m';
}

function renderSessions(sessions) {
  const container = document.getElementById('sessions-list');

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">No sessions found</div>
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.map(session => `
    <div class="session-item" onclick="viewSessionDetails('${session.sessionId}')">
      <div class="session-header">
        <div class="session-id">📍 ${session.sessionId.substring(0, 30)}...</div>
        <div class="session-time">${new Date(session.startTime).toLocaleString()}</div>
      </div>
      <div class="session-stats">
        <div class="session-stat">
          <span>📊</span>
          <span>${session.eventCount || 0} events</span>
        </div>
        <div class="session-stat">
          <span>👤</span>
          <span>${session.userId || 'Anonymous'}</span>
        </div>
        <div class="session-stat">
          <span>🌐</span>
          <span>${session.userAgent ? session.userAgent.split(' ')[0] : 'Unknown'}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderEventTypes(eventTypes) {
  const ctx = document.getElementById('event-types-chart').getContext('2d');

  if (charts.eventTypes) charts.eventTypes.destroy();

  if (!eventTypes || eventTypes.length === 0) {
    document.getElementById('event-types-chart').innerHTML = '<div class="empty-state-text">No event data available</div>';
    return;
  }

  charts.eventTypes = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: eventTypes.map(e => e._id || 'Unknown'),
      datasets: [{
        data: eventTypes.map(e => e.count),
        backgroundColor: [
          '#667eea', '#764ba2', '#6b8dd6', '#8e37d7', '#4facfe', '#00f2fe'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

function renderPageViews(pageViews) {
  const ctx = document.getElementById('page-views-chart').getContext('2d');

  if (charts.pageViews) charts.pageViews.destroy();

  if (!pageViews || pageViews.length === 0) {
    document.getElementById('page-views-chart').innerHTML = '<div class="empty-state-text">No page view data available</div>';
    return;
  }

  charts.pageViews = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: pageViews.map(p => (p._id || '/').substring(0, 20)),
      datasets: [{
        label: 'Views',
        data: pageViews.map(p => p.count),
        backgroundColor: '#764ba2',
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function renderButtonClicks(buttonClicks) {
  const ctx = document.getElementById('button-clicks-chart').getContext('2d');

  if (charts.buttonClicks) charts.buttonClicks.destroy();

  if (!buttonClicks || buttonClicks.length === 0) {
    document.getElementById('button-clicks-chart').innerHTML = '<div class="empty-state-text">No button click data available</div>';
    return;
  }

  charts.buttonClicks = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buttonClicks.map(b => (b._id || 'Unknown').substring(0, 15)),
      datasets: [{
        label: 'Clicks',
        data: buttonClicks.map(b => b.count),
        backgroundColor: '#667eea',
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

async function viewSessionDetails(sessionId) {
  try {
    const response = await fetch(`${API_BASE}/api/analytics/sessions/${sessionId}`);
    const data = await response.json();

    // Render session info
    const sessionInfo = document.getElementById('session-info');
    sessionInfo.innerHTML = `
      <div class="session-info-grid">
        <div class="info-item">
          <div class="info-label">Session ID</div>
          <div class="info-value">${data.session.sessionId}</div>
        </div>
        <div class="info-item">
          <div class="info-label">User ID</div>
          <div class="info-value">${data.session.userId || 'Anonymous'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Start Time</div>
          <div class="info-value">${new Date(data.session.startTime).toLocaleString()}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Events</div>
          <div class="info-value">${data.eventCount}</div>
        </div>
        <div class="info-item">
          <div class="info-label">User Agent</div>
          <div class="info-value" style="font-size: 0.9rem">${data.session.userAgent || 'Unknown'}</div>
        </div>
      </div>
    `;

    // Check for participant info in events
    const startEvent = data.events.find(e => e.eventType === 'session_start');
    const participantContainer = document.getElementById('participant-info-container');
    const participantGrid = document.getElementById('participant-info-grid');

    if (startEvent && startEvent.eventData) {
      const p = startEvent.eventData;
      participantGrid.innerHTML = `
                <div class="info-item">
                    <div class="info-label">Participant ID</div>
                    <div class="info-value">${p.participantId || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Role</div>
                    <div class="info-value">${p.role || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Age Range</div>
                    <div class="info-value">${p.ageRange || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Proficiency</div>
                    <div class="info-value">${p.techProficiency || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">First Time?</div>
                    <div class="info-value">${p.firstTime || 'N/A'}</div>
                </div>
            `;
      participantContainer.classList.remove('hidden');
    } else {
      participantContainer.classList.add('hidden');
    }

    // Render events timeline
    const eventsContainer = document.getElementById('session-events');
    eventsContainer.innerHTML = '<h3 style="margin-bottom: 20px">Event Timeline</h3>';

    if (data.events.length === 0) {
      eventsContainer.innerHTML += '<div class="empty-state-text">No events recorded</div>';
    } else {
      eventsContainer.innerHTML += data.events.map(event => `
        <div class="event-item">
          <div class="event-type">🎯 ${event.eventType}</div>
          <div class="event-timestamp">⏰ ${new Date(event.timestamp).toLocaleString()}</div>
          <div class="event-data">
            <strong>URL:</strong> ${event.pathname || event.url}<br>
            ${event.eventData && Object.keys(event.eventData).length > 0 ?
          `<strong>Data:</strong> ${JSON.stringify(event.eventData, null, 2)}` :
          ''
        }
          </div>
        </div>
      `).join('');
    }

    // Show modal
    document.getElementById('session-modal').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading session details:', error);
    alert('Failed to load session details');
  }
}

function closeModal() {
  document.getElementById('session-modal').classList.add('hidden');
}

function applyFilters() {
  filters.startDate = document.getElementById('start-date').value;
  filters.endDate = document.getElementById('end-date').value;
  filters.userId = document.getElementById('search-user').value.trim();

  loadDashboardData();
}

function clearFilters() {
  filters = { startDate: null, endDate: null, userId: null };
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  document.getElementById('search-user').value = '';

  loadDashboardData();
}

async function exportData() {
  try {
    // Build query params
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    // Ask user for format
    const format = confirm('Export as CSV? (Cancel for JSON)') ? 'csv' : 'json';
    params.append('format', format);

    // Trigger download
    window.open(`${API_BASE}/api/analytics/export?${params}`, '_blank');
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Failed to export data');
  }
}

function updateLastUpdated() {
  document.getElementById('last-updated').textContent = new Date().toLocaleString();
}

// Auto-refresh every 30 seconds
setInterval(() => {
  loadDashboardData();
}, 30000);
