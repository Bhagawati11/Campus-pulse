let allLocations = [];
let currentFilter = 'all';
let searchTerm = '';

function matchesFilter(loc) {
  const status = occupancyStatus(loc.percent_full).className.replace('status-', '');
  const matchesChip = currentFilter === 'all' || status === currentFilter;
  const matchesSearch = loc.name.toLowerCase().includes(searchTerm.toLowerCase());
  return matchesChip && matchesSearch;
}

function renderLocationCards() {
  const container = document.getElementById('locationCards');
  const emptyState = document.getElementById('emptyState');
  const filtered = allLocations.filter(matchesFilter);

  container.innerHTML = '';
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((loc) => {
    const status = occupancyStatus(loc.percent_full);
    const card = document.createElement('div');
    card.className = 'card location-card';
    card.innerHTML = `
      <div class="location-card-top">
        <h3>${loc.name}</h3>
        <span class="badge ${status.className}">${status.label}</span>
      </div>
      <div class="occupancy-count">${loc.occupancy}${loc.capacity ? ' / ' + loc.capacity : ''} people</div>
      <div class="occupancy-bar"><div class="occupancy-fill ${status.className}" style="width:${loc.percent_full}%"></div></div>
      <div class="card-actions">
        <button data-action="checkin" data-id="${loc.id}">Check in</button>
        <button class="secondary" data-action="checkout" data-id="${loc.id}">Check out</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function loadLocations() {
  allLocations = await CampusPulseAPI.getLocations();
  renderLocationCards();
}

document.getElementById('locationCards').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  btn.disabled = true;
  try {
    if (action === 'checkin') {
      await CampusPulseAPI.checkin(id);
      showToast('Checked in');

      // Refetch so we have up-to-date occupancy before suggesting an alternative.
      const freshLocations = await CampusPulseAPI.getLocations();
      allLocations = freshLocations;
      const alternative = suggestQuieterAlternative(freshLocations, id);
      if (alternative) {
        showToast(`That spot's packed — ${alternative.name} is quieter right now`);
      }
      renderLocationCards();
    } else {
      const res = await CampusPulseAPI.checkout(id);
      if (res && res.error) {
        showToast("You haven't checked in here from this tab");
      } else {
        showToast('Checked out');
      }
    }
  } catch (err) {
    showToast('Something went wrong');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderLocationCards();
});

document.getElementById('filterChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  currentFilter = chip.dataset.filter;
  renderLocationCards();
});

socket.on('occupancy-update', loadLocations);

loadLocations();
setInterval(loadLocations, 15000);
