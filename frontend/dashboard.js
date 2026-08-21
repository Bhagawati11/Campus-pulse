let chart;

function renderChart(locations) {
  const ctx = document.getElementById('occupancyChart');
  const labels = locations.map((l) => l.name);
  const data = locations.map((l) => l.occupancy);
  const colors = locations.map((l) => {
    const s = occupancyStatus(l.percent_full);
    return { low: '#4ade80', moderate: '#facc15', high: '#fb923c', full: '#f87171' }[
      s.className.replace('status-', '')
    ];
  });

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Current occupancy', data, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: '#262a3a' } }, x: { grid: { display: false } } },
    },
  });
}

function renderStats(locations, events) {
  const totalPeople = locations.reduce((sum, l) => sum + l.occupancy, 0);
  document.getElementById('statTotalPeople').textContent = totalPeople;

  if (locations.length) {
    const busiest = [...locations].sort((a, b) => b.percent_full - a.percent_full)[0];
    const quietest = [...locations].sort((a, b) => a.percent_full - b.percent_full)[0];
    document.getElementById('statBusiest').textContent = busiest.name;
    document.getElementById('statQuietest').textContent = quietest.name;
  }

  const upcoming = events.filter((e) => new Date(e.starts_at) > new Date());
  document.getElementById('statEventsToday').textContent = upcoming.length;
}

function renderUpcomingEvents(events) {
  const container = document.getElementById('upcomingEvents');
  const upcoming = events
    .filter((e) => new Date(e.starts_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 3);

  container.innerHTML = '';
  if (!upcoming.length) {
    container.innerHTML = '<p class="empty-state">No upcoming events yet — be the first to post one.</p>';
    return;
  }

  upcoming.forEach((ev) => {
    const card = document.createElement('div');
    card.className = 'card event-card';
    card.innerHTML = `
      <h3>${ev.title}</h3>
      <div class="event-meta">${formatEventTime(ev.starts_at)} · ${ev.location || 'TBA'}</div>
      <div class="event-rsvp">${ev.rsvp_count} going</div>
    `;
    container.appendChild(card);
  });
}

async function loadDashboard() {
  const [locations, events] = await Promise.all([
    CampusPulseAPI.getLocations(),
    CampusPulseAPI.getEvents(),
  ]);
  renderChart(locations);
  renderStats(locations, events);
  renderUpcomingEvents(events);
}

socket.on('occupancy-update', loadDashboard);
socket.on('rsvp-update', loadDashboard);

loadDashboard();
setInterval(loadDashboard, 15000);
