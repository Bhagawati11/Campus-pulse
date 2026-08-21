let allRooms = [];
let roomFilter = 'all';
let roomSearchTerm = '';

function matchesRoomFilter(room) {
  const matchesChip =
    roomFilter === 'all' || room.status === roomFilter || room.room_type === roomFilter;
  const haystack = `${room.name} ${room.building}`.toLowerCase();
  const matchesSearch = haystack.includes(roomSearchTerm.toLowerCase());
  return matchesChip && matchesSearch;
}

function renderRooms() {
  const container = document.getElementById('roomsList');
  const emptyState = document.getElementById('roomsEmptyState');
  const filtered = allRooms.filter(matchesRoomFilter);

  container.innerHTML = '';
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((room) => {
    const isEmpty = room.status === 'empty';
    const card = document.createElement('div');
    card.className = 'card location-card';
    card.innerHTML = `
      <div class="location-card-top">
        <h3>${room.name}</h3>
        <span class="badge ${isEmpty ? 'status-low' : 'status-full'}">${isEmpty ? 'Empty' : 'Occupied'}</span>
      </div>
      <div class="occupancy-count">${room.building} · ${room.room_type === 'lab' ? 'Lab' : 'Classroom'}</div>
      <div class="event-meta">Updated ${new Date(room.updated_at).toLocaleString()}</div>
    `;
    container.appendChild(card);
  });
}

async function loadRooms() {
  allRooms = await CampusPulseAPI.getRooms();
  renderRooms();
}

document.getElementById('roomSearchInput').addEventListener('input', (e) => {
  roomSearchTerm = e.target.value;
  renderRooms();
});

document.getElementById('roomFilterChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#roomFilterChips .chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  roomFilter = chip.dataset.filter;
  renderRooms();
});

socket.on('room-update', loadRooms);

loadRooms();
setInterval(loadRooms, 15000);
